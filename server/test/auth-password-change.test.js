import assert from "node:assert/strict";
import { createHash, createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createServer } from "node:http";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
]);

const scrypt = promisify(scryptCallback);
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const currentToken = "a".repeat(43);
const otherToken = "b".repeat(43);
const bobToken = "c".repeat(43);
const currentPassword = "correct horse battery";
const newPassword = "a different strong password";
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const csrfToken = (token) => createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url");
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

async function passwordHash(password) {
  const salt = Buffer.alloc(16, 7);
  const key = await scrypt(password, salt, 64, scryptOptions);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function hashMatches(password, encodedHash) {
  const [, , , , salt, expected] = encodedHash.split("$");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), 64, scryptOptions);
  return timingSafeEqual(key, Buffer.from(expected, "base64url"));
}

async function withServer(app, run) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections?.();
    });
  }
}

function createPasswordChangePool({
  unverifiedUserId = null,
  failOnRevoke = false,
  revokeCurrentAfterAuthentication = false,
} = {}) {
  const users = new Map([
    [ownerA, { password_hash: null, role: "student", status: "active", email_verified_at: new Date() }],
    [ownerB, { password_hash: null, role: "student", status: "active", email_verified_at: new Date() }],
  ]);
  const sessions = new Map([
    ["session-current", {
      id: "session-current",
      user_id: ownerA,
      refresh_token_hash: tokenHash(currentToken),
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      replaced_by_session_id: null,
    }],
    ["session-other", {
      id: "session-other",
      user_id: ownerA,
      refresh_token_hash: tokenHash(otherToken),
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      replaced_by_session_id: null,
    }],
    ["session-bob", {
      id: "session-bob",
      user_id: ownerB,
      refresh_token_hash: tokenHash(bobToken),
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      replaced_by_session_id: null,
    }],
  ]);
  const queries = [];
  let releases = 0;
  let failRollback = false;
  let snapshot;

  const client = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text === "BEGIN") {
        snapshot = {
          users: structuredClone([...users.entries()]),
          sessions: structuredClone([...sessions.entries()]),
        };
        return { rows: [] };
      }
      if (text === "COMMIT") return { rows: [] };
      if (text === "ROLLBACK") {
        if (failRollback) throw new Error("rollback failed");
        users.clear();
        sessions.clear();
        for (const [id, user] of snapshot.users) users.set(id, user);
        for (const [id, session] of snapshot.sessions) sessions.set(id, session);
        return { rows: [] };
      }
      if (text.includes("FROM users") && text.includes("FOR UPDATE")) {
        const user = users.get(values[0]);
        if (!user || (unverifiedUserId === values[0]) || user.role !== "student" || user.status !== "active" || !user.email_verified_at) {
          return { rows: [] };
        }
        return { rows: [{ password_hash: user.password_hash }] };
      }
      if (text.includes("FROM auth_sessions") && text.includes("FOR UPDATE")) {
        const session = sessions.get(values[0]);
        const valid = session
          && session.user_id === values[1]
          && session.refresh_token_hash === values[2]
          && !session.revoked_at
          && new Date(session.expires_at).getTime() > Date.now();
        return { rows: valid ? [{ id: session.id }] : [] };
      }
      if (text.startsWith("UPDATE users SET password_hash")) {
        users.get(values[1]).password_hash = values[0];
        return { rows: [] };
      }
      if (text.includes("UPDATE auth_sessions") && text.includes("id <> $2")) {
        if (failOnRevoke) throw new Error("simulated revoke failure");
        for (const session of sessions.values()) {
          if (session.user_id === values[0]
            && session.id !== values[1]
            && !session.revoked_at
            && new Date(session.expires_at).getTime() > Date.now()) {
            session.revoked_at = new Date();
          }
        }
        return { rows: [] };
      }
      if (text.includes("SET last_used_at = now()")) {
        const session = sessions.get(values[0]);
        const valid = session
          && session.user_id === values[1]
          && session.refresh_token_hash === values[2]
          && !session.revoked_at
          && new Date(session.expires_at).getTime() > Date.now();
        if (valid) session.last_used_at = new Date();
        return { rows: valid ? [{ id: session.id }] : [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
    release(error) {
      releases += 1;
      if (error) failRollback = true;
    },
  };
  const pool = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.includes("FROM auth_sessions s")) {
        const session = [...sessions.values()].find((item) => item.refresh_token_hash === values[0]);
        const user = session && users.get(session.user_id);
        const valid = session
          && !session.revoked_at
          && new Date(session.expires_at).getTime() > Date.now()
          && user?.role === "student"
          && user?.status === "active"
          && user?.email_verified_at
          && unverifiedUserId !== session.user_id;
        if (valid && revokeCurrentAfterAuthentication) session.revoked_at = new Date();
        return { rows: valid ? [{ id: session.id, user_id: session.user_id }] : [] };
      }
      throw new Error(`Unexpected pool query: ${text}`);
    },
    async connect() {
      return client;
    },
  };
  return { pool, users, sessions, queries, get releases() { return releases; } };
}

async function postChange(baseUrl, token = currentToken, body = {
  currentPassword,
  newPassword,
  confirmPassword: newPassword,
}, { csrf = csrfToken(token), origin = "http://localhost:5173" } = {}) {
  return fetch(`${baseUrl}/api/auth/change-password`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `vaultori_refresh=${token}`,
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function runChange(pool, callback) {
  const app = createApp({ authRouter: createAuthRouter({ getPool: () => pool }) });
  await withServer(app, callback);
}

async function seedPasswords(database) {
  database.users.get(ownerA).password_hash = await passwordHash(currentPassword);
  database.users.get(ownerB).password_hash = await passwordHash("bob's current password");
}

test("correct current password updates the hash, keeps this session, and revokes other sessions", async () => {
  const database = createPasswordChangePool();
  await seedPasswords(database);
  await runChange(database.pool, async (baseUrl) => {
    const response = await postChange(baseUrl);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Your password has been updated successfully.");
    assert.equal(await hashMatches(newPassword, database.users.get(ownerA).password_hash), true);
    assert.equal(database.sessions.get("session-current").revoked_at, null);
    assert.ok(database.sessions.get("session-other").revoked_at);
    assert.equal(database.sessions.get("session-bob").revoked_at, null);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(database.releases, 1);
    assert.deepEqual(database.queries.find(({ text }) => text.startsWith("UPDATE auth_sessions") && text.includes("id <> $2")).values, [ownerA, "session-current"]);
  });
});

test("incorrect current password fails without changing password or sessions", async () => {
  const database = createPasswordChangePool();
  await seedPasswords(database);
  const originalHash = database.users.get(ownerA).password_hash;
  await runChange(database.pool, async (baseUrl) => {
    const response = await postChange(baseUrl, currentToken, {
      currentPassword: "wrong current password",
      newPassword,
      confirmPassword: newPassword,
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "INCORRECT_CURRENT_PASSWORD");
    assert.equal(database.users.get(ownerA).password_hash, originalHash);
    assert.equal(database.sessions.get("session-current").revoked_at, null);
    assert.equal(database.sessions.get("session-other").revoked_at, null);
    assert.ok(database.queries.some(({ text }) => text === "ROLLBACK"));
  });
});

test("password policy, whitespace-only and confirmation mismatch are rejected before writes", async () => {
  const database = createPasswordChangePool();
  await seedPasswords(database);
  const invalidBodies = [
    { currentPassword, newPassword: "short", confirmPassword: "short" },
    { currentPassword, newPassword: " ".repeat(8), confirmPassword: " ".repeat(8) },
    { currentPassword, newPassword: "é".repeat(513), confirmPassword: "é".repeat(513) },
    { currentPassword, newPassword, confirmPassword: "different password" },
    { currentPassword, newPassword: currentPassword, confirmPassword: currentPassword },
    { currentPassword, newPassword, confirmPassword: newPassword, userId: ownerB },
  ];
  await runChange(database.pool, async (baseUrl) => {
    for (const body of invalidBodies) {
      const response = await postChange(baseUrl, currentToken, body);
      assert.equal(response.status, 400);
    }
    assert.equal(database.queries.some(({ text }) => text === "BEGIN"), false);
    assert.equal(database.sessions.get("session-other").revoked_at, null);
  });
});

test("missing authentication and unverified student sessions are rejected", async () => {
  const unauthenticated = createPasswordChangePool();
  await seedPasswords(unauthenticated);
  await runChange(unauthenticated.pool, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }),
    });
    assert.equal(response.status, 401);
  });

  const unverified = createPasswordChangePool({ unverifiedUserId: ownerA });
  await seedPasswords(unverified);
  await runChange(unverified.pool, async (baseUrl) => {
    const response = await postChange(baseUrl);
    assert.equal(response.status, 401);
    assert.equal(unverified.queries.some(({ text }) => text === "BEGIN"), false);
  });
});

test("missing and invalid CSRF tokens are rejected before database transactions", async () => {
  const database = createPasswordChangePool();
  await seedPasswords(database);
  await runChange(database.pool, async (baseUrl) => {
    for (const csrf of ["", "invalid-token"]) {
      const response = await postChange(baseUrl, currentToken, undefined, { csrf });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "CSRF_VALIDATION_FAILED");
    }
    assert.equal(database.queries.some(({ text }) => text === "BEGIN"), false);
  });
});

test("failed revocation transaction rolls back the password and all session changes", async () => {
  const database = createPasswordChangePool({ failOnRevoke: true });
  await seedPasswords(database);
  const originalHash = database.users.get(ownerA).password_hash;
  await runChange(database.pool, async (baseUrl) => {
    const response = await postChange(baseUrl);
    assert.equal(response.status, 500);
    assert.equal(database.users.get(ownerA).password_hash, originalHash);
    assert.equal(database.sessions.get("session-current").revoked_at, null);
    assert.equal(database.sessions.get("session-other").revoked_at, null);
    assert.ok(database.queries.some(({ text }) => text === "ROLLBACK"));
  });
});

test("a session revoked by a concurrent refresh is not preserved", async () => {
  const database = createPasswordChangePool({ revokeCurrentAfterAuthentication: true });
  await seedPasswords(database);
  await runChange(database.pool, async (baseUrl) => {
    const response = await postChange(baseUrl);
    assert.equal(response.status, 401);
    assert.equal(await hashMatches(currentPassword, database.users.get(ownerA).password_hash), true);
    assert.equal(database.sessions.get("session-other").revoked_at, null);
    assert.ok(database.queries.some(({ text }) => text === "ROLLBACK"));
  });
});

test("a different student's authenticated session changes only that student's password and sessions", async () => {
  const database = createPasswordChangePool();
  await seedPasswords(database);
  await runChange(database.pool, async (baseUrl) => {
    const response = await postChange(baseUrl, bobToken, {
      currentPassword: "bob's current password",
      newPassword: "bob's updated password",
      confirmPassword: "bob's updated password",
    });
    assert.equal(response.status, 200);
    assert.equal(await hashMatches(currentPassword, database.users.get(ownerA).password_hash), true);
    assert.equal(database.sessions.get("session-current").revoked_at, null);
    assert.equal(database.sessions.get("session-other").revoked_at, null);
  });
});
