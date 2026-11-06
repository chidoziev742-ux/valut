import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createAcademicRecordsRouter }, migration] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/academic-records.js"),
  import("../migrations/005_create_student_academic_records.js"),
]);

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";
const recordAId = "33333333-3333-4333-8333-333333333333";
const recordBId = "44444444-4444-4444-8444-444444444444";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const csrfToken = (token) => createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url");
const sessionHeaders = (token) => ({ Cookie: `vaultori_refresh=${token}` });
const csrfHeaders = (token) => ({
  ...sessionHeaders(token),
  Origin: "http://localhost:5173",
  "X-CSRF-Token": csrfToken(token),
  "Content-Type": "application/json",
});

const recordBody = {
  recordType: "Programme information",
  title: "Current programme",
  institution: "Sample University",
  programme: "BSc Computer Science",
  academicSession: "2025/2026",
  semester: "",
  level: "300 level",
  details: "Current programme information.",
};

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

function dbRecord(ownerId, id, overrides = {}) {
  return {
    id,
    user_id: ownerId,
    record_type: "Programme information",
    title: "Current programme",
    institution: "Sample University",
    programme: "BSc Computer Science",
    academic_session: "2025/2026",
    semester: null,
    level: "300 level",
    details: "Current programme information.",
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function createPool(seed = [
  dbRecord(aliceId, recordAId),
  dbRecord(bobId, recordBId, { title: "Bob's record" }),
]) {
  const sessions = new Map([
    [tokenHash(tokenA), aliceId],
    [tokenHash(tokenB), bobId],
  ]);
  const records = new Map(seed.map((row) => [row.id, { ...row }]));
  const queries = [];
  let nextId = 0;

  async function query(text, values = []) {
    queries.push({ text, values });
    if (text.includes("FROM auth_sessions s")) {
      const ownerId = sessions.get(values[0]);
      return { rows: ownerId ? [{ user_id: ownerId }] : [] };
    }
    if (text.startsWith("SELECT") && text.includes("FROM student_academic_records")) {
      if (text.includes("WHERE id = $1 AND user_id = $2")) {
        const record = records.get(values[0]);
        return { rows: record?.user_id === values[1] ? [{ ...record }] : [] };
      }
      return {
        rows: [...records.values()]
          .filter((record) => record.user_id === values[0])
          .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
          .map((record) => ({ ...record })),
      };
    }
    if (text.startsWith("INSERT INTO student_academic_records")) {
      const [ownerId, recordType, title, institution, programme, academicSession, semester, level, details] = values;
      const id = `66666666-6666-4666-8666-${String(++nextId).padStart(12, "0")}`;
      const created = dbRecord(ownerId, id, {
        record_type: recordType,
        title,
        institution,
        programme,
        academic_session: academicSession,
        semester,
        level,
        details,
        created_at: new Date(),
        updated_at: new Date(),
      });
      records.set(id, created);
      return { rows: [{ ...created }] };
    }
    if (text.startsWith("UPDATE student_academic_records")) {
      const id = values.at(-2);
      const ownerId = values.at(-1);
      const record = records.get(id);
      if (!record || record.user_id !== ownerId) return { rows: [] };
      const setClause = text.match(/SET ([\s\S]+?) WHERE/)?.[1] ?? "";
      const assignmentColumns = [...setClause.matchAll(/([a-z_]+) = \$\d+/g)].map((match) => match[1]);
      assignmentColumns.forEach((column, index) => {
        record[column] = values[index];
      });
      record.updated_at = new Date();
      return { rows: [{ ...record }] };
    }
    if (text.startsWith("DELETE FROM student_academic_records")) {
      const [id, ownerId] = values;
      const record = records.get(id);
      if (!record || record.user_id !== ownerId) return { rows: [] };
      records.delete(id);
      return { rows: [{ id }] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }

  return { records, queries, query };
}

function createTestApp(pool) {
  return createApp({
    academicRecordsRouter: createAcademicRecordsRouter({ getPool: () => pool }),
  });
}

test("academic record CRUD is persisted and scoped to the authenticated student", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const listed = await fetch(`${baseUrl}/api/student/academic-records`, { headers: sessionHeaders(tokenA) });
    const listPayload = await listed.json();
    assert.equal(listed.status, 200);
    assert.deepEqual(listPayload.records.map((record) => record.title), ["Current programme"]);

    const createdResponse = await fetch(`${baseUrl}/api/student/academic-records`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify(recordBody),
    });
    const createdPayload = await createdResponse.json();
    assert.equal(createdResponse.status, 201);
    assert.equal(createdPayload.record.title, recordBody.title);
    assert.equal(createdPayload.record.userId, undefined);
    assert.equal(pool.records.get(createdPayload.record.id).user_id, aliceId);

    const updatedResponse = await fetch(`${baseUrl}/api/student/academic-records/${createdPayload.record.id}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ title: "Updated programme", details: "Edited details." }),
    });
    const updatedPayload = await updatedResponse.json();
    assert.equal(updatedResponse.status, 200);
    assert.equal(updatedPayload.record.title, "Updated programme");
    assert.equal(updatedPayload.record.details, "Edited details.");
    assert.equal(pool.records.get(createdPayload.record.id).user_id, aliceId);

    const deletedResponse = await fetch(`${baseUrl}/api/student/academic-records/${createdPayload.record.id}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(deletedResponse.status, 204);
    assert.equal(pool.records.has(createdPayload.record.id), false);

    const listedAgain = await fetch(`${baseUrl}/api/student/academic-records`, { headers: sessionHeaders(tokenA) });
    assert.deepEqual((await listedAgain.json()).records.map((record) => record.title), ["Current programme"]);
  });
});

test("academic record validation rejects missing, invalid, oversized and client-owned fields", async () => {
  const pool = createPool([]);
  await withServer(createTestApp(pool), async (baseUrl) => {
    const invalidBodies = [
      {},
      { ...recordBody, title: " " },
      { ...recordBody, title: "t".repeat(101) },
      { ...recordBody, recordType: "Unofficial transcript" },
      { ...recordBody, recordType: "Semester result", semester: "" },
      { ...recordBody, details: "d".repeat(1001) },
      { ...recordBody, user_id: aliceId },
      { ...recordBody, id: recordAId },
    ];
    for (const body of invalidBodies) {
      const response = await fetch(`${baseUrl}/api/student/academic-records`, {
        method: "POST",
        headers: csrfHeaders(tokenA),
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.equal(pool.records.size, 0);

    const invalidPatch = await fetch(`${baseUrl}/api/student/academic-records/${recordAId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ unknownField: "not allowed" }),
    });
    assert.equal(invalidPatch.status, 400);
    assert.equal(pool.records.size, 0);
  });
});

test("PATCH validates the complete resulting semester record", async () => {
  const validSemesterRecord = dbRecord(aliceId, recordAId, {
    record_type: "Semester result",
    title: "Second semester results",
    semester: "Second semester",
  });
  const pool = createPool([dbRecord(aliceId, recordBId), validSemesterRecord]);
  await withServer(createTestApp(pool), async (baseUrl) => {
    const changeWithoutSemester = await fetch(`${baseUrl}/api/student/academic-records/${recordBId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ recordType: "Semester result" }),
    });
    assert.equal(changeWithoutSemester.status, 400);
    assert.equal(pool.records.get(recordBId).record_type, "Programme information");
    assert.equal(pool.records.get(recordBId).semester, null);

    const clearExistingSemester = await fetch(`${baseUrl}/api/student/academic-records/${recordAId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ semester: "" }),
    });
    assert.equal(clearExistingSemester.status, 400);
    assert.equal(pool.records.get(recordAId).semester, "Second semester");

    const changeWithSemester = await fetch(`${baseUrl}/api/student/academic-records/${recordBId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ recordType: "Semester result", semester: "First semester" }),
    });
    assert.equal(changeWithSemester.status, 200);
    assert.equal(pool.records.get(recordBId).record_type, "Semester result");
    assert.equal(pool.records.get(recordBId).semester, "First semester");

    const updateUnrelatedField = await fetch(`${baseUrl}/api/student/academic-records/${recordAId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ title: "Updated second semester results" }),
    });
    assert.equal(updateUnrelatedField.status, 200);
    assert.equal(pool.records.get(recordAId).record_type, "Semester result");
    assert.equal(pool.records.get(recordAId).semester, "Second semester");
    assert.equal(pool.records.get(recordAId).title, "Updated second semester results");
  });
});

test("academic record writes reject missing or invalid CSRF tokens", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const requests = [
      fetch(`${baseUrl}/api/student/academic-records`, {
        method: "POST",
        headers: { ...sessionHeaders(tokenA), "Content-Type": "application/json" },
        body: JSON.stringify(recordBody),
      }),
      fetch(`${baseUrl}/api/student/academic-records/${recordAId}`, {
        method: "PATCH",
        headers: { ...sessionHeaders(tokenA), "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      fetch(`${baseUrl}/api/student/academic-records/${recordAId}`, {
        method: "DELETE",
        headers: sessionHeaders(tokenA),
      }),
    ];
    for (const response of await Promise.all(requests)) assert.equal(response.status, 403);
    assert.equal(pool.records.size, 2);
  });
});

test("invalid and duplicate academic record IDs are safely rejected", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    for (const method of ["PATCH", "DELETE"]) {
      const response = await fetch(`${baseUrl}/api/student/academic-records/not-a-uuid`, {
        method,
        headers: csrfHeaders(tokenA),
        ...(method === "PATCH" ? { body: JSON.stringify({ title: "Updated" }) } : {}),
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, "ACADEMIC_RECORD_NOT_FOUND");
    }

    const duplicateCreate = await fetch(`${baseUrl}/api/student/academic-records`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ ...recordBody, id: recordAId }),
    });
    assert.equal(duplicateCreate.status, 400);

    const missingRecord = await fetch(`${baseUrl}/api/student/academic-records/55555555-5555-4555-8555-555555555555`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ title: "No record" }),
    });
    assert.equal(missingRecord.status, 404);
  });
});

test("a student cannot read, modify or delete another student's academic records", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const aliceList = await fetch(`${baseUrl}/api/student/academic-records`, { headers: sessionHeaders(tokenA) });
    const bobList = await fetch(`${baseUrl}/api/student/academic-records`, { headers: sessionHeaders(tokenB) });
    assert.deepEqual((await aliceList.json()).records.map(({ id }) => id), [recordAId]);
    assert.deepEqual((await bobList.json()).records.map(({ id }) => id), [recordBId]);

    const attemptedUpdate = await fetch(`${baseUrl}/api/student/academic-records/${recordBId}`, {
      method: "PATCH",
      headers: csrfHeaders(tokenA),
      body: JSON.stringify({ title: "Compromised" }),
    });
    assert.equal(attemptedUpdate.status, 404);
    assert.equal(pool.records.get(recordBId).title, "Bob's record");

    const attemptedDelete = await fetch(`${baseUrl}/api/student/academic-records/${recordBId}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(attemptedDelete.status, 404);
    assert.equal(pool.records.has(recordBId), true);

    for (const query of pool.queries.filter(({ text }) => text.includes("student_academic_records"))) {
      assert.match(query.text, /user_id = \$\d+/);
    }
  });
});

test("academic record migration is additive and rollback removes only its own objects", async () => {
  const sql = [];
  const pgm = { sql(statement) { sql.push(statement); } };
  await migration.up(pgm);
  const upSql = sql.join("\n");
  assert.match(upSql, /CREATE TABLE student_academic_records/);
  assert.match(upSql, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(upSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(upSql, /CREATE INDEX student_academic_records_user_created_idx/);
  assert.match(upSql, /CREATE TRIGGER student_academic_records_set_updated_at/);
  assert.match(upSql, /CHECK \(record_type <> 'Semester result' OR \(semester IS NOT NULL AND length\(btrim\(semester\)\) BETWEEN 1 AND 60\)\)/);
  assert.doesNotMatch(upSql, /DROP TABLE|DELETE FROM|TRUNCATE|ALTER TABLE (users|student_profiles|student_documents)/i);

  sql.length = 0;
  await migration.down(pgm);
  const downSql = sql.join("\n");
  assert.match(downSql, /DROP TRIGGER student_academic_records_set_updated_at/);
  assert.match(downSql, /DROP TABLE student_academic_records/);
  assert.doesNotMatch(downSql, /DROP TABLE (users|student_profiles|student_documents)|DELETE FROM|TRUNCATE/i);

  const migrationFile = await readFile(new URL("../migrations/005_create_student_academic_records.js", import.meta.url), "utf8");
  assert.match(migrationFile, /student_academic_records_user_created_idx/);
});
