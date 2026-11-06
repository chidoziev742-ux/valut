import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createNotificationsRouter }, migration] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/notifications.js"),
  import("../migrations/006_create_student_notifications.js"),
]);

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";
const welcomeId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const csrfToken = (token) => createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url");
const sessionHeaders = (token) => ({ Cookie: `vaultori_refresh=${token}` });
const csrfHeaders = (token) => ({
  ...sessionHeaders(token),
  Origin: "http://localhost:5173",
  "X-CSRF-Token": csrfToken(token),
});

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

function notification(userId, id, { isRead = false, actionDestination = null } = {}) {
  return {
    id,
    user_id: userId,
    title: "Welcome to Vaultori",
    message: "Profile information is optional.",
    source: "system",
    category: "welcome",
    is_read: isRead,
    read_at: isRead ? new Date("2026-11-06T10:00:00Z") : null,
    action_destination: actionDestination,
    event_key: "student_welcome_v1",
    created_at: new Date("2026-11-06T09:00:00Z"),
  };
}

function createPool(seed = [
  notification(aliceId, welcomeId, { actionDestination: "/settings#account-info" }),
  notification(bobId, otherId),
]) {
  const sessions = new Map([
    [tokenHash(tokenA), aliceId],
    [tokenHash(tokenB), bobId],
  ]);
  const rows = new Map(seed.map((row) => [row.id, { ...row }]));
  const queries = [];

  async function query(text, values = []) {
    queries.push({ text, values });
    if (text.includes("FROM auth_sessions s")) {
      const ownerId = sessions.get(values[0]);
      return { rows: ownerId ? [{ user_id: ownerId }] : [] };
    }
    if (text.includes("count(*)::int AS unread_count")) {
      const [ownerId] = values;
      return {
        rows: [{
          unread_count: [...rows.values()].filter((row) => row.user_id === ownerId && !row.is_read).length,
        }],
      };
    }
    if (text.startsWith("SELECT") && text.includes("FROM student_notifications")) {
      const [ownerId] = values;
      return {
        rows: [...rows.values()]
          .filter((row) => row.user_id === ownerId)
          .sort((left, right) => right.created_at - left.created_at || right.id.localeCompare(left.id)),
      };
    }
    if (text.includes("UPDATE student_notifications") && text.includes("WHERE user_id = $1 AND is_read = false")) {
      const [ownerId] = values;
      let rowCount = 0;
      for (const row of rows.values()) {
        if (row.user_id === ownerId && !row.is_read) {
          row.is_read = true;
          row.read_at = new Date();
          rowCount += 1;
        }
      }
      return { rows: [], rowCount };
    }
    if (text.includes("UPDATE student_notifications") && text.includes("WHERE id = $1 AND user_id = $2")) {
      const [id, ownerId] = values;
      const row = rows.get(id);
      if (!row || row.user_id !== ownerId) return { rows: [] };
      row.is_read = true;
      row.read_at ??= new Date();
      return { rows: [row] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }

  return { rows, queries, query };
}

function createTestApp(pool) {
  return createApp({
    notificationsRouter: createNotificationsRouter({ getPool: () => pool }),
  });
}

test("students retrieve only their notifications and get an accurate unread count", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications`, {
      headers: sessionHeaders(tokenA),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.deepEqual(body.notifications.map(({ id }) => id), [welcomeId]);
    assert.equal(body.notifications[0].actionDestination, "/settings#account-info");
    assert.equal(body.notifications[0].isRead, false);

    const unread = await fetch(`${baseUrl}/api/student/notifications/unread-count`, {
      headers: sessionHeaders(tokenA),
    });
    assert.deepEqual(await unread.json(), { unreadCount: 1 });
  });
  assert.deepEqual(pool.queries[1].values, [aliceId]);
  assert.match(pool.queries[1].text, /WHERE user_id = \$1/);
});

test("marking one notification read is owner-scoped and returns its updated state", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications/${welcomeId}/read`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.notification.id, welcomeId);
    assert.equal(body.notification.isRead, true);
    assert.ok(body.notification.readAt);

    const crossStudent = await fetch(`${baseUrl}/api/student/notifications/${otherId}/read`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(crossStudent.status, 404);
    assert.equal(pool.rows.get(otherId).is_read, false);
  });
});

test("marking all notifications read updates only the authenticated student's unread rows", async () => {
  const pool = createPool([
    notification(aliceId, welcomeId),
    notification(aliceId, "55555555-5555-4555-8555-555555555555", { isRead: true }),
    notification(bobId, otherId),
  ]);
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications/read-all`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { updatedCount: 1 });
    assert.equal(pool.rows.get(welcomeId).is_read, true);
    assert.equal(pool.rows.get(otherId).is_read, false);
  });
});

test("notification state changes reject missing or invalid CSRF tokens", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications/${welcomeId}/read`, {
      method: "PATCH",
      headers: sessionHeaders(tokenA),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "CSRF_INVALID");
    assert.equal(pool.rows.get(welcomeId).is_read, false);
  });
});

test("notification APIs require a valid authenticated student session", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "INVALID_SESSION");
  });
});

test("notification requests reject invalid IDs and untrusted action destinations", async () => {
  const invalidDestination = notification(aliceId, welcomeId, {
    actionDestination: "https://attacker.example",
  });
  await withServer(createTestApp(createPool([invalidDestination])), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications`, {
      headers: sessionHeaders(tokenA),
    });
    const responseText = await response.text();
    assert.equal(response.status, 500);
    assert.doesNotMatch(responseText, /attacker\.example|Stored notification action/);
  });

  await withServer(createTestApp(createPool()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications/not-a-uuid/read`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(response.status, 404);
  });
});

test("notification request bodies cannot assign action destinations or ownership", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/notifications/read-all`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: bobId, actionDestination: "https://attacker.example" }),
    });
    assert.equal(response.status, 400);
    assert.equal(pool.rows.get(welcomeId).is_read, false);
  });
});

test("migration enforces one system welcome event per student and only safe action routes", async () => {
  let migrationSql = "";
  await migration.up({ sql(value) { migrationSql += value; } });
  assert.match(migrationSql, /user_id uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migrationSql, /CONSTRAINT student_notifications_user_event_unique\s+UNIQUE \(user_id, event_key\)/);
  assert.match(migrationSql, /CHECK \(event_key IS NULL OR \(source = 'system'/);
  assert.match(migrationSql, /action_destination IN \('\/profile', '\/settings#account-info'\)/);
  assert.match(migrationSql, /student_notifications_user_unread_idx[\s\S]*WHERE is_read = false/);
  assert.match(migrationSql, /ALTER TABLE student_notifications ENABLE ROW LEVEL SECURITY/);

  let rollbackSql = "";
  await migration.down({ sql(value) { rollbackSql += value; } });
  assert.match(rollbackSql, /DROP TABLE student_notifications/);
  assert.doesNotMatch(rollbackSql, /DROP TABLE users|student_profiles|auth_sessions/);

  const authRoute = await readFile(new URL("../src/routes/auth.js", import.meta.url), "utf8");
  assert.match(authRoute, /ON CONFLICT \(user_id, event_key\) DO NOTHING/);
});

test("duplicate welcome-category notifications conflict even with different event keys", async () => {
  let migrationSql = "";
  await migration.up({ sql(value) { migrationSql += value; } });

  const firstWelcome = { userId: aliceId, category: "welcome", eventKey: "student_welcome_v1" };
  const secondWelcome = { userId: aliceId, category: "welcome", eventKey: "another_welcome_event" };
  assert.notEqual(firstWelcome.eventKey, secondWelcome.eventKey);
  assert.equal(firstWelcome.userId, secondWelcome.userId);
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX student_notifications_user_welcome_unique_idx\s+ON student_notifications \(user_id\)\s+WHERE category = 'welcome'/,
  );
  assert.match(migrationSql, /CONSTRAINT student_notifications_user_event_unique\s+UNIQUE \(user_id, event_key\)/);
});
