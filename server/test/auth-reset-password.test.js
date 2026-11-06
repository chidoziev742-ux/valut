import assert from "node:assert/strict";
import { createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { promisify } from "node:util";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
]);

const scrypt = promisify(scryptCallback);
const resetToken = "test-password-reset-token";
const newPassword = "a-new-secure-password";

async function createScryptHash(password) {
  const salt = Buffer.from("0123456789abcdef");
  const key = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function matchesScryptHash(password, encodedHash) {
  const [, , , , saltText, keyText] = encodedHash.split("$");
  const actual = await scrypt(password, Buffer.from(saltText, "base64url"), 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return timingSafeEqual(actual, Buffer.from(keyText, "base64url"));
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

function createResetDatabase({ valid = true, expired = false } = {}) {
  const queries = [];
  const state = {
    valid,
    expired,
    passwordHash: undefined,
    tokenUsed: false,
    outstandingTokensInvalidated: false,
    revokedSessions: false,
    tokenLookups: 0,
    releases: 0,
  };

  const client = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id FROM users")) {
        return { rows: [{ id: "user-123" }] };
      }
      if (text.includes("FOR UPDATE") && text.includes("password_reset_tokens")) {
        state.tokenLookups += 1;
        return {
          rows: state.valid && !state.expired && !state.tokenUsed
            ? [{ id: "reset-123", user_id: "user-123" }]
            : [],
        };
      }
      if (text.startsWith("UPDATE users SET password_hash")) {
        state.passwordHash = values[0];
      }
      if (text.startsWith("UPDATE password_reset_tokens SET used_at")) {
        state.tokenUsed = true;
      }
      if (text.includes("SET invalidated_at = now()")) {
        state.outstandingTokensInvalidated = true;
      }
      if (text.includes("UPDATE auth_sessions")) {
        state.revokedSessions = true;
      }
      return { rows: [] };
    },
    release(error) {
      state.releases += 1;
      state.releaseError = error;
    },
  };

  const pool = {
    async query(text, values = []) {
      queries.push({ text, values });
      return {
        rows: state.valid && !state.expired && !state.tokenUsed
          ? [{ user_id: "user-123" }]
          : [],
      };
    },
    async connect() {
      return client;
    },
  };

  return { pool, queries, state };
}

async function sendResetRequest(pool, token = resetToken, password = newPassword) {
  const app = createApp({ authRouter: createAuthRouter({ getPool: () => pool }) });
  let responseBody;
  let status;
  let requestId;
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    status = response.status;
    responseBody = await response.json();
    requestId = response.headers.get("x-request-id");
  });
  return { status, body: responseBody, requestId };
}

test("successful password reset hashes the new password and commits token/session updates", async () => {
  const { pool, queries, state } = createResetDatabase();
  const result = await sendResetRequest(pool);

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Password has been reset successfully.");
  assert.equal(await matchesScryptHash(newPassword, state.passwordHash), true);
  assert.equal(state.tokenUsed, true);
  assert.equal(state.outstandingTokensInvalidated, true);
  assert.equal(state.revokedSessions, true);
  assert.equal(state.releases, 1);
  assert.equal(state.releaseError, undefined);
  assert.equal(queries[0].values[0], createHash("sha256").update(resetToken).digest("hex"));
  assert.deepEqual(queries.slice(1).map(({ text }) => text), [
    "BEGIN",
    "SELECT id FROM users WHERE id = $1 FOR UPDATE",
    `SELECT id, user_id
           FROM password_reset_tokens
           WHERE token_hash = $1
             AND user_id = $2
             AND used_at IS NULL
             AND invalidated_at IS NULL
             AND expires_at > clock_timestamp()
           FOR UPDATE`,
    "UPDATE users SET password_hash = $1 WHERE id = $2",
    "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1",
    `UPDATE password_reset_tokens
           SET invalidated_at = now()
           WHERE user_id = $1
             AND id <> $2
             AND used_at IS NULL
             AND invalidated_at IS NULL`,
    `UPDATE auth_sessions
           SET revoked_at = now()
           WHERE user_id = $1
             AND revoked_at IS NULL`,
    "COMMIT",
  ]);
});

test("invalid reset token receives a generic response and performs no transaction", async () => {
  const { pool, queries, state } = createResetDatabase({ valid: false });
  const result = await sendResetRequest(pool, "not-a-valid-token");

  assert.equal(result.status, 400);
  assert.deepEqual(result.body.error, {
    code: "INVALID_RESET_TOKEN",
    message: "The password reset token is invalid or expired.",
    requestId: result.requestId,
  });
  assert.equal(queries.length, 1);
  assert.equal(state.releases, 0);
});

test("expired reset token receives the same generic invalid-token response", async () => {
  const { pool, queries, state } = createResetDatabase({ expired: true });
  const result = await sendResetRequest(pool);

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_RESET_TOKEN");
  assert.equal(result.body.error.message, "The password reset token is invalid or expired.");
  assert.match(queries[0].text, /expires_at > clock_timestamp\(\)/);
  assert.equal(state.releases, 0);
});

test("a previously used reset token cannot be reused", async () => {
  const { pool, queries, state } = createResetDatabase();
  const firstResult = await sendResetRequest(pool);
  const queryCountAfterFirstReset = queries.length;
  const secondResult = await sendResetRequest(pool);

  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 400);
  assert.equal(secondResult.body.error.code, "INVALID_RESET_TOKEN");
  assert.equal(state.releases, 1);
  assert.equal(queries.length, queryCountAfterFirstReset + 1);
});

test("reset revokes outstanding sessions in the same transaction", async () => {
  const { pool, queries, state } = createResetDatabase();
  const result = await sendResetRequest(pool);
  const revokeQuery = queries.find(({ text }) => text.includes("UPDATE auth_sessions"));

  assert.equal(result.status, 200);
  assert.ok(revokeQuery);
  assert.match(revokeQuery.text, /revoked_at IS NULL/);
  assert.deepEqual(revokeQuery.values, ["user-123"]);
  assert.equal(state.revokedSessions, true);
  assert.equal(queries.at(-1).text, "COMMIT");
});
