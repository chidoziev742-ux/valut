import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
]);

const frontendOrigin = "http://localhost:5173";
const refreshToken = "a".repeat(43);
const refreshTokenHash = (token) => createHash("sha256").update(token).digest("hex");
const csrfToken = (token) => createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url");
const cookieHeader = (token) => `vaultori_refresh=${token}`;

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

function createTestApp(pool) {
  return createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
  });
}

function sessionRow(token, overrides = {}) {
  return {
    id: "session-old",
    user_id: "user-123",
    expires_at: new Date(Date.now() + 60_000),
    revoked_at: null,
    replaced_by_session_id: null,
    status: "active",
    email_verified_at: new Date(),
    refresh_token_hash: refreshTokenHash(token),
    ...overrides,
  };
}

function createRotationPool(token, session = sessionRow(token)) {
  const sessions = new Map([[session.refresh_token_hash, session]]);
  const queries = [];
  let nextId = 0;
  const client = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [] };
      if (text.includes("FOR UPDATE OF s")) {
        const row = sessions.get(values[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (text.includes("INSERT INTO auth_sessions")) {
        const inserted = {
          id: `session-new-${++nextId}`,
          user_id: values[0],
          refresh_token_hash: values[1],
          expires_at: values[2],
          revoked_at: null,
          replaced_by_session_id: null,
        };
        sessions.set(values[1], inserted);
        return { rows: [{ id: inserted.id, expires_at: inserted.expires_at }] };
      }
      if (text.includes("replaced_by_session_id = $2")) {
        const row = [...sessions.values()].find((item) => item.id === values[0]);
        if (row) {
          row.revoked_at = new Date();
          row.replaced_by_session_id = values[1];
        }
        return { rows: [] };
      }
      if (text.includes("WHERE user_id = $1 AND revoked_at IS NULL")) {
        for (const row of sessions.values()) {
          if (row.user_id === values[0] && !row.revoked_at) row.revoked_at = new Date();
        }
        return { rows: [] };
      }
      if (text.includes("WHERE id = $1 AND revoked_at IS NULL")) {
        const row = [...sessions.values()].find((item) => item.id === values[0]);
        if (row) row.revoked_at = new Date();
        return { rows: [] };
      }
      throw new Error("Unexpected session query");
    },
    release() {},
  };
  return { pool: { connect: async () => client }, sessions, queries };
}

async function postRefresh(baseUrl, token, csrf = csrfToken(token), origin = frontendOrigin) {
  return fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookieHeader(token),
      "X-CSRF-Token": csrf,
    },
  });
}

test("refresh rotates the token and reuse of the previous token revokes active sessions", async () => {
  const { pool, sessions } = createRotationPool(refreshToken);
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await postRefresh(baseUrl, refreshToken);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(body).includes(refreshToken), false);
    assert.match(body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(body.session.id, "session-new-1");

    const replacementCookie = response.headers.get("set-cookie");
    assert.match(replacementCookie, /^vaultori_refresh=[A-Za-z0-9_-]{43};/);
    const replacementToken = replacementCookie.match(/^vaultori_refresh=([^;]+)/)[1];
    assert.notEqual(replacementToken, refreshToken);
    assert.equal(sessions.get(refreshTokenHash(refreshToken)).replaced_by_session_id, "session-new-1");
    assert.equal(sessions.has(refreshToken), false);
    assert.ok(sessions.has(refreshTokenHash(replacementToken)));

    const reuseResponse = await postRefresh(baseUrl, refreshToken);
    const reuseBody = await reuseResponse.json();
    assert.equal(reuseResponse.status, 401);
    assert.equal(reuseBody.error.code, "INVALID_SESSION");
    assert.ok(sessions.get(refreshTokenHash(replacementToken)).revoked_at);
  });
});

test("session check returns the safe user profile without exposing the refresh token", async () => {
  const validSession = sessionRow(refreshToken);
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("SELECT u.id")) {
        return {
          rows: [{
            id: "user-123",
            email_normalized: "student@example.com",
            role: "student",
            full_name: "Student User",
            university: "Example University",
            faculty: "Science",
            department: "Computing",
            programme: "Computer Science",
            study_year: "Year 2",
            academic_session: "2026/2027",
            session_id: validSession.id,
            expires_at: validSession.expires_at,
          }],
        };
      }
      return { rows: text.startsWith("UPDATE auth_sessions") ? [{ id: validSession.id }] : [] };
    },
  };

  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookieHeader(refreshToken) },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.user, {
      id: "user-123",
      email: "student@example.com",
      role: "student",
    });
    assert.deepEqual(body.profile, {
      fullName: "Student User",
      university: "Example University",
      faculty: "Science",
      department: "Computing",
      programme: "Computer Science",
      studyYear: "Year 2",
      academicSession: "2026/2027",
    });
    assert.equal(body.csrfToken, csrfToken(refreshToken));
    assert.equal(JSON.stringify(body).includes(refreshToken), false);
    assert.equal(queries[0].values[0], refreshTokenHash(refreshToken));
  });
});

test("session check returns only the student profile associated with each authenticated session", async () => {
  const secondRefreshToken = "b".repeat(43);
  const accountsByTokenHash = new Map([
    [refreshTokenHash(refreshToken), {
      id: "user-alice",
      email_normalized: "alice@example.com",
      role: "student",
      full_name: "Alice Student",
      university: "Alice University",
      faculty: "Science",
      department: "Biology",
      programme: "Biology",
      study_year: "Year 2",
      academic_session: "2026/2027",
      session_id: "session-alice",
      expires_at: new Date(Date.now() + 60_000),
    }],
    [refreshTokenHash(secondRefreshToken), {
      id: "user-bob",
      email_normalized: "bob@example.com",
      role: "student",
      full_name: "Bob Student",
      university: "Bob University",
      faculty: "Computing",
      department: "Software Engineering",
      programme: "Software Engineering",
      study_year: "Year 3",
      academic_session: "2026/2027",
      session_id: "session-bob",
      expires_at: new Date(Date.now() + 60_000),
    }],
  ]);
  const pool = {
    async query(text, values) {
      if (text.startsWith("SELECT u.id")) {
        const account = accountsByTokenHash.get(values[0]);
        return { rows: account ? [{ ...account }] : [] };
      }
      if (text.startsWith("UPDATE auth_sessions")) {
        const account = [...accountsByTokenHash.values()].find(({ session_id }) => session_id === values[0]);
        return { rows: account ? [{ id: account.session_id }] : [] };
      }
      throw new Error("Unexpected session query");
    },
  };

  await withServer(createTestApp(pool), async (baseUrl) => {
    const [aliceResponse, bobResponse] = await Promise.all([
      fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookieHeader(refreshToken) } }),
      fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookieHeader(secondRefreshToken) } }),
    ]);
    const [alice, bob] = await Promise.all([aliceResponse.json(), bobResponse.json()]);

    assert.equal(aliceResponse.status, 200);
    assert.equal(bobResponse.status, 200);
    assert.equal(alice.user.email, "alice@example.com");
    assert.equal(alice.profile.fullName, "Alice Student");
    assert.equal(bob.user.email, "bob@example.com");
    assert.equal(bob.profile.fullName, "Bob Student");
    assert.notEqual(alice.profile.university, bob.profile.university);
  });
});

test("expired and unknown refresh cookies are rejected and cleared", async () => {
  const expiredSession = sessionRow(refreshToken, { expires_at: new Date(Date.now() - 1000) });
  const { pool } = createRotationPool(refreshToken, expiredSession);
  await withServer(createTestApp(pool), async (baseUrl) => {
    const expiredResponse = await postRefresh(baseUrl, refreshToken);
    assert.equal(expiredResponse.status, 401);
    assert.match(expiredResponse.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);

    const unknownToken = "b".repeat(43);
    const invalidResponse = await postRefresh(baseUrl, unknownToken);
    assert.equal(invalidResponse.status, 401);
    assert.equal((await invalidResponse.json()).error.code, "INVALID_SESSION");
  });
});

test("logout revokes the hashed session and clears the refresh cookie", async () => {
  let update;
  const pool = {
    async query(text, values) {
      update = { text, values };
      return { rows: [] };
    },
  };
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Origin: frontendOrigin,
        Cookie: cookieHeader(refreshToken),
        "X-CSRF-Token": csrfToken(refreshToken),
      },
    });

    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);
    assert.match(update.text, /UPDATE auth_sessions/);
    assert.deepEqual(update.values, [refreshTokenHash(refreshToken)]);
    assert.equal(JSON.stringify(update).includes(refreshToken), false);
  });
});

test("refresh rejects missing or invalid CSRF tokens and untrusted origins before database access", async () => {
  let connections = 0;
  const pool = {
    async connect() {
      connections += 1;
      throw new Error("Database should not be reached");
    },
  };
  await withServer(createTestApp(pool), async (baseUrl) => {
    const missingCsrf = await postRefresh(baseUrl, refreshToken, "");
    assert.equal(missingCsrf.status, 403);
    assert.equal((await missingCsrf.json()).error.code, "CSRF_VALIDATION_FAILED");

    const invalidCsrf = await postRefresh(baseUrl, refreshToken, "invalid-csrf");
    assert.equal(invalidCsrf.status, 403);

    const untrustedOrigin = await postRefresh(baseUrl, refreshToken, csrfToken(refreshToken), "https://attacker.example");
    assert.equal(untrustedOrigin.status, 403);
    assert.equal(connections, 0);
  });
});

test("credentialed CORS allows the configured origin and CSRF header", async () => {
  await withServer(createTestApp({ async query() { return { rows: [] }; } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "OPTIONS",
      headers: {
        Origin: frontendOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-csrf-token",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("access-control-allow-headers"), /x-csrf-token/i);
  });
});
