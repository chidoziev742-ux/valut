import assert from "node:assert/strict";
import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { promisify } from "node:util";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
]);

const validRegistration = {
  fullName: "  Alex Student  ",
  email: "  Alex.Student@Example.COM  ",
  password: "student-password",
};
const scrypt = promisify(scryptCallback);

async function encodePassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
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

function createTestApp(getPool, authOptions = {}) {
  return createApp({
    authRouter: createAuthRouter({
      getPool,
      emailService: { async sendTransactionalEmail() {} },
      ...authOptions,
    }),
  });
}

test("registration creates a student account and profile with a hashed password", async () => {
  const queries = [];
  const emailMessages = [];
  const verificationToken = "test-registration-verification-token";
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("INSERT INTO users")) {
        return { rows: [{ id: "user-123", email_normalized: "alex.student@example.com" }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(
    () => ({ connect: async () => client }),
    {
      generateEmailVerificationToken: () => verificationToken,
      emailService: { async sendTransactionalEmail(message) { emailMessages.push(message); } },
      frontendUrl: "https://vaultori.example",
    },
  );

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validRegistration, role: "admin" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      user: {
        id: "user-123",
        email: "alex.student@example.com",
        fullName: "Alex Student",
        role: "student",
      },
    });
    assert.equal(JSON.stringify(body).includes("scrypt"), false);
    assert.equal(JSON.stringify(body).includes(verificationToken), false);
  });

  assert.equal(queries[0].text, "BEGIN");
  assert.match(queries[1].text, /INSERT INTO users[\s\S]*VALUES \(\$1, \$2, 'student'\)/);
  assert.deepEqual(queries[1].values.slice(0, 1), ["alex.student@example.com"]);
  assert.match(queries[1].values[1], /^scrypt\$16384\$8\$1\$/);
  assert.match(queries[1].values[1], /\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.deepEqual(queries[2].values, ["user-123", "Alex Student"]);
  assert.match(queries[3].text, /INSERT INTO student_notifications/);
  assert.match(queries[3].text, /ON CONFLICT \(user_id, event_key\) DO NOTHING/);
  assert.deepEqual(queries[3].values, [
    "user-123",
    "Welcome to Vaultori",
    "You can visit Profile Settings to add your university, faculty, department, programme and academic information. Completing this optional profile information is encouraged, but it is not compulsory.",
  ]);
  assert.match(queries[3].text, /'system', 'welcome', '\/settings#account-info', 'student_welcome_v1'/);
  assert.match(queries[4].text, /INSERT INTO email_verification_tokens \(user_id, token_hash, expires_at\)/);
  assert.equal(queries[4].values[0], "user-123");
  assert.equal(
    queries[4].values[1],
    createHash("sha256").update(verificationToken).digest("hex"),
  );
  assert.ok(queries[4].values[2] instanceof Date);
  const remainingLifetime = queries[4].values[2].getTime() - Date.now();
  assert.ok(remainingLifetime <= 24 * 60 * 60 * 1000);
  assert.ok(remainingLifetime > 24 * 60 * 60 * 1000 - 60 * 1000);
  assert.equal(queries[5].text, "COMMIT");
  assert.equal(emailMessages.length, 1);
  assert.equal(emailMessages[0].to, "alex.student@example.com");
  assert.match(emailMessages[0].textContent, /https:\/\/vaultori\.example\/verify\?token=/);
  assert.match(emailMessages[0].textContent, new RegExp(verificationToken));
});

test("welcome notification insertion failure rolls back registration", async () => {
  const queries = [];
  const client = {
    async query(text) {
      queries.push(text);
      if (text.includes("INSERT INTO users")) {
        return { rows: [{ id: "user-123", email_normalized: "alex.student@example.com" }] };
      }
      if (text.includes("INSERT INTO student_notifications")) {
        throw Object.assign(new Error("private notification table error"), { code: "42P01" });
      }
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(() => ({ connect: async () => client }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRegistration),
    });
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.doesNotMatch(body, /private notification table error|42P01/);
  });

  assert.ok(queries.includes("BEGIN"));
  assert.ok(queries.some((query) => query.includes("INSERT INTO student_notifications")));
  assert.ok(queries.includes("ROLLBACK"));
  assert.equal(queries.includes("COMMIT"), false);
});

test("email delivery failure rolls back account and verification token records", async () => {
  const queries = [];
  let releases = 0;
  const client = {
    async query(text) {
      queries.push(text);
      if (text.includes("INSERT INTO users")) {
        return { rows: [{ id: "user-123", email_normalized: "alex.student@example.com" }] };
      }
      if (text === "ROLLBACK") return { rows: [] };
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  };
  const app = createTestApp(
    () => ({ connect: async () => client }),
    {
      generateEmailVerificationToken: () => "mail-failure-token",
      emailService: {
        async sendTransactionalEmail() {
          throw new Error("private provider response");
        },
      },
    },
  );

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRegistration),
    });
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.doesNotMatch(text, /private provider response|mail-failure-token/);
    assert.deepEqual(JSON.parse(text).error, {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
      requestId: response.headers.get("x-request-id"),
    });
  });

  assert.ok(queries.includes("ROLLBACK"));
  assert.equal(queries.includes("COMMIT"), false);
  assert.equal(releases, 1);
});

test("duplicate email returns HTTP 409 without disclosing database details", async () => {
  const client = {
    async query(text) {
      if (text.includes("INSERT INTO users")) {
        const error = new Error("private database detail");
        error.code = "23505";
        error.constraint = "users_email_normalized_unique";
        throw error;
      }
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(() => ({ connect: async () => client }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRegistration),
    });
    const text = await response.text();

    assert.equal(response.status, 409);
    assert.match(text, /EMAIL_ALREADY_REGISTERED/);
    assert.doesNotMatch(text, /private database detail|23505|users_email_normalized_unique/);
  });
});

test("invalid registration data is rejected before database access", async () => {
  let connectionRequested = false;
  const app = createTestApp(() => {
    connectionRequested = true;
    throw new Error("database should not be requested");
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validRegistration, email: "not-an-email" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_REGISTRATION");
    assert.equal(body.error.requestId, response.headers.get("x-request-id"));
    assert.equal(connectionRequested, false);
  });
});

test("registration preflight permits POST from the configured frontend", async () => {
  const app = createTestApp(() => {
    throw new Error("preflight should not access the database");
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
  });
});

test("unexpected database errors use the existing safe error response", async () => {
  const client = {
    async query(text) {
      if (text.includes("INSERT INTO users")) {
        throw new Error("private database detail");
      }
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(() => ({ connect: async () => client }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRegistration),
    });
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.doesNotMatch(text, /private database detail/);
    assert.deepEqual(JSON.parse(text).error, {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
      requestId: response.headers.get("x-request-id"),
    });
  });
});

test("login normalizes email, verifies scrypt, and stores only a hashed refresh token", async () => {
  const passwordHash = await encodePassword("StudentLogin@2026");
  const queries = [];
  let responseToken;
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("FROM users")) {
        return {
          rows: [{
            id: "user-456",
            email_normalized: "alex.student@example.com",
            password_hash: passwordHash,
            role: "student",
            status: "active",
            email_verified_at: new Date(),
          }],
        };
      }
      return { rows: [{ id: "session-789", expires_at: values[2] }] };
    },
  };
  const app = createTestApp(() => pool);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "  Alex.Student@Example.COM  ",
        password: "StudentLogin@2026",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.user, {
      id: "user-456",
      email: "alex.student@example.com",
      role: "student",
    });
    assert.match(body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(JSON.stringify(body).includes("refreshToken"), false);
    assert.equal(JSON.stringify(body).includes("refresh_token"), false);
    assert.equal(body.session.id, "session-789");
    assert.equal(JSON.stringify(body).includes(passwordHash), false);
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /^vaultori_refresh=[A-Za-z0-9_-]{43};/);
    assert.match(cookie, /;\s*Path=\/api/i);
    assert.match(cookie, /;\s*HttpOnly/i);
    assert.match(cookie, /;\s*Secure/i);
    assert.match(cookie, /;\s*SameSite=None/i);
    responseToken = cookie.match(/^vaultori_refresh=([^;]+)/)[1];
  });

  assert.deepEqual(queries[0].values, ["alex.student@example.com"]);
  assert.match(queries[1].text, /INSERT INTO auth_sessions/);
  assert.equal(queries[1].values[0], "user-456");
  assert.equal(
    queries[1].values[1],
    createHash("sha256").update(responseToken).digest("hex"),
  );
  assert.ok(queries[1].values[2] instanceof Date);
});

test("login returns the same generic 401 for unknown, invalid, and disabled credentials", async () => {
  const activeHash = await encodePassword("correct-password");
  for (const user of [
    undefined,
    {
      id: "user-456",
      email_normalized: "alex.student@example.com",
      password_hash: activeHash,
      role: "student",
      status: "active",
    },
    {
      id: "user-456",
      email_normalized: "alex.student@example.com",
      password_hash: activeHash,
      role: "student",
      status: "disabled",
    },
  ]) {
    let sessionInserted = false;
    const pool = {
      async query(text) {
        if (text.includes("FROM users")) return { rows: user ? [user] : [] };
        sessionInserted = true;
        return { rows: [] };
      },
    };
    const app = createTestApp(() => pool);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alex.student@example.com",
          password: user?.status === "active" ? "wrong-password" : "correct-password",
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 401);
      assert.deepEqual(body.error, {
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
        requestId: response.headers.get("x-request-id"),
      });
    });

    assert.equal(sessionInserted, false);
  }
});
