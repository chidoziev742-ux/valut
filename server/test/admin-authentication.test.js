import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { promisify } from "node:util";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAuthRouter }, { createAdminRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/auth.js"),
  import("../src/routes/admin.js"),
]);

const scrypt = promisify(scryptCallback);
const refreshToken = "a".repeat(43);
const csrfToken = createHmac("sha256", refreshToken).update("vaultori-csrf-v1").digest("base64url");
const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
const sessionHeaders = (token) => ({ Cookie: `vaultori_refresh=${token}` });
const csrfHeaders = (token) => ({
  ...sessionHeaders(token),
  Origin: "http://localhost:5173",
  "X-CSRF-Token": createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url"),
});

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

test("admin login rejects a valid student account", async () => {
  const passwordHash = await encodePassword("student-password");
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("FROM users") && text.includes("role = 'admin'")) {
        return {
          rows: [{
            id: "student-1",
            email_normalized: "student@example.com",
            password_hash: passwordHash,
            role: "student",
            status: "active",
            email_verified_at: new Date(),
          }],
        };
      }
      return { rows: [] };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "student@example.com", password: "student-password" }),
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "INVALID_CREDENTIALS");
  });

  assert.match(queries[0].text, /role = 'admin'/);
});

test("admin session middleware denies a student session", async () => {
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { Cookie: `vaultori_refresh=${refreshToken}` },
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "INVALID_SESSION");
  });

  assert.equal(refreshTokenHash.length, 64);
  assert.equal(csrfToken.length, 43);
});

test("admin dashboard returns database statistics only through an admin session", async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      if (text.includes("WITH student_stats")) {
        return {
          rows: [{
            total_students: 4,
            verified_students: 3,
            active_students: 3,
            disabled_students: 1,
            total_documents: 7,
            total_storage_bytes: "2048",
            recent_registrations: [],
          }],
        };
      }
      return { rows: [] };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Cookie: `vaultori_refresh=${refreshToken}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.metrics, {
      totalStudents: 4,
      verifiedStudents: 3,
      activeStudents: 3,
      disabledStudents: 1,
      totalDocuments: 7,
      totalStorageBytes: "2048",
    });
    assert.deepEqual(body.recentRegistrations, []);
  });

  assert.match(queries[1].text, /FROM users/);
  assert.equal(queries[1].values, undefined);
});

test("admin usage returns aggregate usage data without exposing account credentials", async () => {
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      if (text.includes("WITH usage_totals")) {
        return {
          rows: [{
            document_count: 3,
            storage_bytes: "4096",
            document_types: [{ id: "PDF", fileType: "PDF", count: 2 }],
            registration_trend: [{ period: "November 2026", month: "NOV", count: 1 }],
            largest_students: [{ id: "student-1", fullName: "Student One", storageBytes: "2048", documentCount: 1 }],
            recent_uploads: [{ id: "document-1", fileType: "PDF", fileSize: "1024", createdAt: "2026-11-06T00:00:00.000Z" }],
          }],
        };
      }
      return { rows: [] };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/usage`, {
      headers: { Cookie: `vaultori_refresh=${refreshToken}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.totals.storageBytes, "4096");
    assert.equal(body.documentTypes[0].fileType, "PDF");
    assert.equal(body.largestStudents[0].fullName, "Student One");
    assert.equal(body.recentUploads[0].fileType, "PDF");
    assert.equal("passwordHash" in body, false);
    assert.equal("email" in body.largestStudents[0], false);
  });
});

test("admin student directory is protected and returns paginated filtered records", async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      if (text.includes("SELECT count(*)::int AS total")) return { rows: [{ total: 1 }] };
      return {
        rows: [{
          id: "student-1",
          full_name: "Student One",
          email_normalized: "student@example.com",
          status: "active",
          email_verified: true,
          created_at: new Date("2026-01-01"),
          university: "University",
          programme: "Programme",
          study_year: "Year 1",
        }],
      };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/students?page=2&pageSize=10&q=student&status=active&verification=verified`, {
      headers: { Cookie: `vaultori_refresh=${refreshToken}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.total, 1);
    assert.equal(body.students[0].email, "student@example.com");
    assert.match(queries[1].text, /u\.role = 'student'/);
    assert.deepEqual(queries[1].values.slice(0, 2), [10, 10]);
  });
});

test("admin status changes cannot target admins and are audited transactionally", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("SELECT id, status")) return { rows: [{ id: "student-1", status: "active" }] };
      if (text.includes("UPDATE users")) return { rows: [{ id: "student-1", next_status: "disabled" }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      return { rows: [] };
    },
    async connect() { return client; },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/students/student-1/status`, {
      method: "PATCH",
      headers: {
        Cookie: `vaultori_refresh=${refreshToken}`,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "disabled" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { student: { id: "student-1", status: "disabled" } });
  });

  assert.equal(calls[0].text, "BEGIN");
  assert.match(calls[3].text, /INSERT INTO admin_audit_log/);
  assert.equal(calls[3].values[0], "admin-1");
  assert.equal(calls[3].values[2], "active");
});

test("admin communication sends one transactional in-app announcement to active students", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("SELECT id FROM users")) return { rows: [{ id: "student-1" }] };
      if (text.includes("INSERT INTO admin_communications")) return { rows: [{ id: "communication-1" }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      return { rows: [] };
    },
    async connect() { return client; },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });
  const selectedStudentId = "11111111-1111-4111-8111-111111111111";

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/communications`, {
      method: "POST",
      headers: {
        Cookie: `vaultori_refresh=${refreshToken}`,
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        subject: "Important update",
        message: "Please review your account.",
        recipientMode: "selected",
        recipientIds: [selectedStudentId],
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      communication: { id: "communication-1", recipientCount: 1, status: "Sent" },
    });
  });

  assert.equal(calls.filter(({ text }) => text.includes("INSERT INTO student_notifications")).length, 1);
  assert.equal(calls[calls.length - 1].text, "COMMIT");
});

test("admin email communication queues delivery without rolling back in-app delivery", async () => {
  const calls = [];
  let emailSent = false;
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("SELECT id, email_normalized FROM users")) {
        return { rows: [{ id: "student-1", email_normalized: "student@example.com" }] };
      }
      if (text.includes("INSERT INTO admin_communications")) return { rows: [{ id: "communication-email-1" }] };
      if (text.includes("FROM admin_communication_email_deliveries d")) {
        return emailSent ? { rows: [] } : {
          rows: [{
            communication_id: "communication-email-1",
            user_id: "student-1",
            recipient_email: "student@example.com",
            attempt_count: 0,
            subject: "Email update",
            message: "Please review your account.",
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      if (text.includes("SET status = 'sent'")) {
        emailSent = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
    async connect() { return client; },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({
      getPool: () => pool,
      emailService: {
        async sendTransactionalEmail(message) {
          assert.equal(message.to, "student@example.com");
          return { messageId: "provider-message-1" };
        },
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/communications`, {
      method: "POST",
      headers: {
        Cookie: `vaultori_refresh=${refreshToken}`,
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        subject: "Email update",
        message: "Please review your account.",
        recipientMode: "all",
        channel: "both",
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      communication: { id: "communication-email-1", recipientCount: 1, status: "Email queued" },
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(emailSent, true);
  assert.equal(calls.filter(({ text }) => text.includes("INSERT INTO student_notifications")).length, 1);
});

test("admin communication archive and restore are CSRF-protected and audited", async () => {
  const calls = [];
  let archivedAt = null;
  const communicationId = "11111111-1111-4111-8111-111111111111";
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("SELECT id, archived_at")) return { rows: [{ id: communicationId, archived_at: archivedAt }] };
      if (text.includes("UPDATE admin_communications")) {
        archivedAt = values[0];
        return { rows: [{ id: communicationId, archived_at: archivedAt }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(text) {
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      return { rows: [] };
    },
    async connect() { return client; },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    const archive = await fetch(`${baseUrl}/api/admin/communications/${communicationId}/archive`, {
      method: "PATCH",
      headers: { ...csrfHeaders(refreshToken), "Content-Type": "application/json" },
    });
    assert.equal(archive.status, 200);
    assert.ok((await archive.json()).communication.archivedAt);
    assert.equal(calls.find(({ text }) => text.includes("INSERT INTO admin_audit_log")).values[2], "communication_archived");

    const restore = await fetch(`${baseUrl}/api/admin/communications/${communicationId}/restore`, {
      method: "PATCH",
      headers: { ...csrfHeaders(refreshToken), "Content-Type": "application/json" },
    });
    assert.equal(restore.status, 200);
    assert.equal((await restore.json()).communication.archivedAt, null);
    assert.equal(calls.filter(({ text }) => text.includes("INSERT INTO admin_audit_log"))[1].values[2], "communication_restored");

    const noCsrf = await fetch(`${baseUrl}/api/admin/communications/${communicationId}/archive`, {
      method: "PATCH",
      headers: sessionHeaders(refreshToken),
    });
    assert.equal(noCsrf.status, 403);
  });
});

test("admin communication history defaults to active and supports archived filtering", async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("FROM auth_sessions")) return { rows: [{ id: "session-1", user_id: "admin-1" }] };
      if (text.includes("SELECT c.id")) return { rows: [] };
      if (text.includes("SELECT count(*)::int AS total")) return { rows: [{ total: 0 }] };
      return { rows: [] };
    },
  };
  const app = createApp({
    authRouter: createAuthRouter({ getPool: () => pool }),
    adminRouter: createAdminRouter({ getPool: () => pool }),
  });

  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/admin/communications`, { headers: sessionHeaders(refreshToken) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/admin/communications?archive=archived`, { headers: sessionHeaders(refreshToken) })).status, 200);
  });

  const historyQueries = queries.filter(({ text }) => text.includes("SELECT c.id"));
  assert.match(historyQueries[0].text, /c\.archived_at IS NULL/);
  assert.match(historyQueries[1].text, /c\.archived_at IS NOT NULL/);
});
