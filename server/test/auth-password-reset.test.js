import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
]);

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

function createTestApp(getPool, generatePasswordResetToken, emailService, frontendUrl) {
  return createApp({
    authRouter: createAuthRouter({ getPool, generatePasswordResetToken, emailService, frontendUrl }),
  });
}

test("forgot password emails the reset link, stores a token hash, and expires it after 30 minutes", async () => {
  const rawToken = "test-reset-token-value";
  const queries = [];
  const messages = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id FROM users")) {
        return { rows: [{ id: "user-123" }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(
    () => ({ connect: async () => client }),
    () => rawToken,
    { async sendTransactionalEmail(message) { messages.push(message); } },
    "https://vaultori.example",
  );
  const beforeRequest = Date.now();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "  Alex.Student@Example.COM  " }),
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.message, "If an account exists for this email, the password reset request has been accepted.");
    assert.equal(typeof body.requestId, "string");
    assert.equal(JSON.stringify(body).includes(rawToken), false);
    assert.equal(JSON.stringify(body).includes("reset-password"), false);
  });

  assert.equal(queries[0].text, "BEGIN");
  assert.match(queries[1].text, /SELECT id FROM users WHERE email_normalized = \$1 FOR UPDATE/);
  assert.deepEqual(queries[1].values, ["alex.student@example.com"]);
  assert.match(queries[2].text, /UPDATE password_reset_tokens/);
  assert.match(queries[2].text, /used_at IS NULL/);
  assert.match(queries[2].text, /invalidated_at IS NULL/);
  assert.deepEqual(queries[2].values, ["user-123"]);
  assert.match(queries[3].text, /INSERT INTO password_reset_tokens/);
  assert.deepEqual(queries[3].values.slice(0, 1), ["user-123"]);
  assert.equal(
    queries[3].values[1],
    createHash("sha256").update(rawToken).digest("hex"),
  );
  assert.match(queries[3].values[1], /^[a-f0-9]{64}$/);
  assert.ok(queries[3].values[2] instanceof Date);
  assert.ok(queries[3].values[2].getTime() >= beforeRequest + 30 * 60 * 1000);
  assert.ok(queries[3].values[2].getTime() <= Date.now() + 30 * 60 * 1000);
  assert.equal(queries[4].text, "COMMIT");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, "alex.student@example.com");
  assert.match(messages[0].subject, /reset your Vaultori password/i);
  assert.match(messages[0].textContent, /https:\/\/vaultori\.example\/reset-password\?token=/);
  assert.ok(messages[0].textContent.includes(rawToken));
  assert.ok(messages[0].htmlContent.includes(rawToken));
  assert.doesNotMatch(JSON.stringify(queries), new RegExp(rawToken));
});

test("forgot password returns the same generic success when the email is not registered", async () => {
  const queries = [];
  const messages = [];
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [] };
    },
    release() {},
  };
  const app = createTestApp(
    () => ({ connect: async () => client }),
    undefined,
    { async sendTransactionalEmail(message) { messages.push(message); } },
  );

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com" }),
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.message, "If an account exists for this email, the password reset request has been accepted.");
    assert.equal(typeof body.requestId, "string");
  });

  assert.deepEqual(queries.map(({ text }) => text), [
    "BEGIN",
    "SELECT id FROM users WHERE email_normalized = $1 FOR UPDATE",
    "COMMIT",
  ]);
  assert.deepEqual(queries[1].values, ["unknown@example.com"]);
  assert.equal(messages.length, 0);
});

test("email delivery failure rolls back reset-token changes and returns the generic success", async () => {
  const queries = [];
  let releases = 0;
  const rawToken = "private-reset-token";
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id FROM users")) return { rows: [{ id: "user-123" }] };
      return { rows: [] };
    },
    release() { releases += 1; },
  };
  const app = createTestApp(
    () => ({ connect: async () => client }),
    () => rawToken,
    {
      async sendTransactionalEmail() {
        throw new Error(`provider rejected ${rawToken} and private details`);
      },
    },
    "https://vaultori.example",
  );

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@example.com" }),
    });
    const text = await response.text();

    assert.equal(response.status, 202);
    assert.deepEqual(JSON.parse(text), {
      message: "If an account exists for this email, the password reset request has been accepted.",
      requestId: response.headers.get("x-request-id"),
    });
    assert.doesNotMatch(text, /private-reset-token|provider rejected|private details/);
  });

  assert.deepEqual(queries.map(({ text }) => text), [
    "BEGIN",
    "SELECT id FROM users WHERE email_normalized = $1 FOR UPDATE",
    `UPDATE password_reset_tokens
             SET invalidated_at = now()
             WHERE user_id = $1
               AND used_at IS NULL
               AND invalidated_at IS NULL`,
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
    "ROLLBACK",
  ]);
  assert.equal(queries[3].values[1], createHash("sha256").update(rawToken).digest("hex"));
  assert.equal(JSON.stringify(queries).includes(rawToken), false);
  assert.equal(releases, 1);
});
