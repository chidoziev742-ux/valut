import assert from "node:assert/strict";
import { createHash, scrypt as scryptCallback } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { promisify } from "node:util";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }, verificationMigration] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
  import("../migrations/002_create_email_verification_tokens.js"),
]);

const scrypt = promisify(scryptCallback);
const email = "alex.student@example.com";
const verificationToken = "valid-email-verification-token";
const tokenHash = createHash("sha256").update(verificationToken).digest("hex");

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

function createTestApp(pool, options = {}) {
  return createApp({
    authRouter: createAuthRouter({
      getPool: () => pool,
      emailService: { async sendTransactionalEmail() {} },
      frontendUrl: "https://vaultori.example",
      ...options,
    }),
  });
}

async function sendJson(app, path, body) {
  let result;
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    result = {
      status: response.status,
      body: await response.json(),
      requestId: response.headers.get("x-request-id"),
    };
  });
  return result;
}

function createVerificationDatabase({ exists = true, expired = false, used = false } = {}) {
  const queries = [];
  const state = {
    exists,
    expired,
    used,
    invalidated: false,
    emailVerified: false,
    currentTokenHash: tokenHash,
    releases: 0,
  };
  const client = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id, email_verified_at FROM users")) {
        return { rows: exists ? [{ id: "user-123", email_verified_at: null }] : [] };
      }
      if (text.includes("FROM email_verification_tokens") && text.includes("FOR UPDATE")) {
        return {
          rows: exists && !expired && !used && !state.invalidated
            ? [{ id: "verification-123", user_id: "user-123" }]
            : [],
        };
      }
      if (text.startsWith("UPDATE users SET email_verified_at")) {
        state.emailVerified = true;
      }
      if (text.startsWith("UPDATE email_verification_tokens SET used_at")) {
        state.used = true;
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
      const matches = values[0] === state.currentTokenHash &&
        state.exists && !state.expired && !state.used && !state.invalidated;
      return { rows: matches ? [{ user_id: "user-123" }] : [] };
    },
    async connect() {
      return client;
    },
  };
  return { pool, queries, state };
}

test("verification migration defines constrained token storage and a down migration", async () => {
  const upSql = [];
  const downSql = [];
  await verificationMigration.up({ sql: (statement) => upSql.push(statement) });
  await verificationMigration.down({ sql: (statement) => downSql.push(statement) });

  const schema = upSql.join("\n");
  for (const expected of [
    "CREATE TABLE email_verification_tokens",
    "id uuid PRIMARY KEY",
    "user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE",
    "token_hash varchar(64) NOT NULL",
    "token_hash ~ '^[0-9a-f]{64}$'",
    "expires_at timestamptz NOT NULL",
    "used_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "expires_at > created_at",
    "CREATE INDEX email_verification_tokens_user_idx",
    "CREATE INDEX email_verification_tokens_active_expiry_idx",
    "CREATE UNIQUE INDEX email_verification_tokens_one_outstanding_per_user_idx",
    "ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY",
  ]) {
    assert.ok(schema.includes(expected), `migration is missing: ${expected}`);
  }
  assert.match(
    schema,
    /CREATE UNIQUE INDEX email_verification_tokens_one_outstanding_per_user_idx[\s\S]*WHERE used_at IS NULL AND invalidated_at IS NULL/,
  );
  assert.match(downSql.join("\n"), /DROP TABLE email_verification_tokens/);
});

test("a valid verification token verifies the account and is consumed under row locks", async () => {
  const { pool, queries, state } = createVerificationDatabase();
  const result = await sendJson(createTestApp(pool), "verify-email", {
    token: verificationToken,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Email verified successfully.");
  assert.equal(JSON.stringify(result.body).includes(verificationToken), false);
  assert.equal(state.emailVerified, true);
  assert.equal(state.used, true);
  assert.equal(state.releases, 1);
  assert.equal(state.releaseError, undefined);
  assert.equal(queries[0].values[0], tokenHash);
  assert.ok(queries.some(({ text }) => text.includes("FROM users") && text.includes("FOR UPDATE")));
  assert.ok(queries.some(({ text }) => text.includes("email_verification_tokens") && text.includes("FOR UPDATE")));
  assert.equal(queries.at(-1).text, "COMMIT");
});

test("invalid verification tokens receive a generic error", async () => {
  const { pool, state } = createVerificationDatabase({ exists: false });
  const result = await sendJson(createTestApp(pool), "verify-email", {
    token: "unknown-token",
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body.error, {
    code: "INVALID_VERIFICATION_TOKEN",
    message: "The email verification token is invalid or expired.",
    requestId: result.requestId,
  });
  assert.equal(state.releases, 0);
});

test("expired verification tokens receive the same generic error", async () => {
  const { pool } = createVerificationDatabase({ expired: true });
  const result = await sendJson(createTestApp(pool), "verify-email", {
    token: verificationToken,
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_VERIFICATION_TOKEN");
});

test("a verification token cannot be reused", async () => {
  const { pool, state } = createVerificationDatabase();
  const app = createTestApp(pool);
  const firstResult = await sendJson(app, "verify-email", { token: verificationToken });
  const secondResult = await sendJson(app, "verify-email", { token: verificationToken });

  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 400);
  assert.equal(secondResult.body.error.code, "INVALID_VERIFICATION_TOKEN");
  assert.equal(state.releases, 1);
});

test("login rejects a verified-password attempt for an unverified account without creating a session", async () => {
  const passwordHash = await createScryptHash("correct-password");
  let sessionCreated = false;
  const pool = {
    async query(text) {
      if (text.includes("FROM users")) {
        return {
          rows: [{
            id: "user-123",
            email_normalized: email,
            password_hash: passwordHash,
            role: "student",
            status: "active",
            email_verified_at: null,
          }],
        };
      }
      sessionCreated = true;
      return { rows: [] };
    },
  };
  const result = await sendJson(createTestApp(pool), "login", {
    email: ` ${email.toUpperCase()} `,
    password: "correct-password",
  });

  assert.equal(result.status, 403);
  assert.deepEqual(result.body.error, {
    code: "EMAIL_NOT_VERIFIED",
    message: "Please verify your email address before signing in.",
    requestId: result.requestId,
  });
  assert.equal(sessionCreated, false);
});

test("resend invalidates prior tokens, stores only a hash, and sends a replacement email", async () => {
  const queries = [];
  const emailMessages = [];
  const previousHash = createHash("sha256").update("previous-verification-token").digest("hex");
  const state = {
    invalidated: false,
    tokenHash: previousHash,
  };
  const client = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id, email_normalized")) {
        return { rows: [{ id: "user-123", email_normalized: email }] };
      }
      if (text.includes("SET invalidated_at = now()")) state.invalidated = true;
      if (text.includes("INSERT INTO email_verification_tokens")) state.tokenHash = values[1];
      return { rows: [] };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };
  const replacementToken = "replacement-verification-token";
  const result = await sendJson(
    createTestApp(pool, {
      generateEmailVerificationToken: () => replacementToken,
      emailService: {
        async sendTransactionalEmail(message) {
          emailMessages.push(message);
        },
      },
    }),
    "resend-verification",
    { email: "  Alex.Student@Example.COM  " },
  );

  assert.equal(result.status, 202);
  assert.equal(
    result.body.message,
    "If an unverified account exists for this email, a verification message has been sent.",
  );
  assert.equal(state.invalidated, true);
  assert.equal(
    state.tokenHash,
    createHash("sha256").update(replacementToken).digest("hex"),
  );
  assert.notEqual(state.tokenHash, replacementToken);
  assert.equal(emailMessages.length, 1);
  assert.equal(emailMessages[0].to, email);
  assert.match(emailMessages[0].textContent, /replacement-verification-token/);
  assert.equal(queries[0].text, "BEGIN");
  assert.equal(queries.at(-1).text, "COMMIT");
  assert.equal(JSON.stringify(result.body).includes(replacementToken), false);
});

test("resend returns the same generic response for an unknown email", async () => {
  const messages = [];
  const client = {
    async query(text) {
      if (text.startsWith("SELECT id, email_normalized")) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };
  const options = {
    generateEmailVerificationToken: () => "unused-token",
    emailService: { async sendTransactionalEmail(message) { messages.push(message); } },
  };
  const app = createTestApp(pool, options);
  const result = await sendJson(app, "resend-verification", { email });

  assert.equal(result.status, 202);
  assert.equal(
    result.body.message,
    "If an unverified account exists for this email, a verification message has been sent.",
  );
  assert.equal(messages.length, 0);
});
