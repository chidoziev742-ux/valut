import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createFoldersRouter }, { createDocumentsRouter }, migration] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/folders.js"),
  import("../src/routes/documents.js"),
  import("../migrations/004_create_student_folders.js"),
]);

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";
const folderAId = "33333333-3333-4333-8333-333333333333";
const folderBId = "44444444-4444-4444-8444-444444444444";
const documentId = "55555555-5555-4555-8555-555555555555";
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

function folder(ownerId, id, name) {
  return { id, user_id: ownerId, name, created_at: new Date("2026-01-01T00:00:00Z"), updated_at: new Date("2026-01-01T00:00:00Z") };
}

function document(ownerId, id, folderId = folderAId) {
  return {
    id,
    user_id: ownerId,
    title: "Transcript",
    original_filename: "transcript.pdf",
    file_type: "PDF",
    mime_type: "application/pdf",
    file_size: "123",
    storage_object_path: `${ownerId}/${id}.pdf`,
    source: "device",
    page_count: null,
    category: "Academic Records",
    academic_session: null,
    archived_at: null,
    created_at: new Date("2026-01-02T00:00:00Z"),
    folder_id: folderId,
  };
}

function createPool({ seedFolders, seedDocuments } = {}) {
  const sessions = new Map([
    [tokenHash(tokenA), aliceId],
    [tokenHash(tokenB), bobId],
  ]);
  const folders = new Map((seedFolders ?? [
    folder(aliceId, folderAId, "Admission"),
    folder(bobId, folderBId, "Private"),
  ]).map((row) => [row.id, { ...row }]));
  const documents = new Map((seedDocuments ?? [document(aliceId, documentId)]).map((row) => [row.id, { ...row }]));

  async function query(text, values = []) {
    if (text.includes("FROM auth_sessions s")) {
      const ownerId = sessions.get(values[0]);
      return { rows: ownerId ? [{ user_id: ownerId }] : [] };
    }
    if (text.startsWith("SELECT") && text.includes("FROM student_folders")) {
      return { rows: [...folders.values()].filter((row) => row.user_id === values[0]).sort((a, b) => a.created_at - b.created_at) };
    }
    if (text.startsWith("INSERT INTO student_folders")) {
      const [ownerId, name] = values;
      if ([...folders.values()].some((row) => row.user_id === ownerId && row.name.trim().toLowerCase() === name.trim().toLowerCase())) {
        throw Object.assign(new Error("duplicate name"), { code: "23505", constraint: "student_folders_user_name_unique_idx" });
      }
      const row = folder(ownerId, `66666666-6666-4666-8666-${String(folders.size + 1).padStart(12, "0")}`, name);
      folders.set(row.id, row);
      return { rows: [row] };
    }
    if (text.startsWith("UPDATE student_folders")) {
      const [name, id, ownerId] = values;
      const row = folders.get(id);
      if (!row || row.user_id !== ownerId) return { rows: [] };
      if ([...folders.values()].some((candidate) => candidate.id !== id && candidate.user_id === ownerId && candidate.name.toLowerCase() === name.toLowerCase())) {
        throw Object.assign(new Error("duplicate name"), { code: "23505", constraint: "student_folders_user_name_unique_idx" });
      }
      row.name = name;
      row.updated_at = new Date();
      return { rows: [row] };
    }
    if (text.startsWith("DELETE FROM student_folders")) {
      const [id, ownerId] = values;
      const row = folders.get(id);
      if (!row || row.user_id !== ownerId) return { rows: [] };
      folders.delete(id);
      for (const doc of documents.values()) if (doc.folder_id === id) doc.folder_id = null;
      return { rows: [{ id }] };
    }
    if (text.startsWith("UPDATE student_documents AS document")) {
      const [destinationId, id, ownerId] = values;
      const row = documents.get(id);
      const destination = destinationId === null ? true : folders.get(destinationId)?.user_id === ownerId;
      if (!row || row.user_id !== ownerId || !destination) return { rows: [] };
      row.folder_id = destinationId;
      return { rows: [row] };
    }
    if (text.startsWith("SELECT id FROM student_documents")) {
      const row = documents.get(values[0]);
      return { rows: row?.user_id === values[1] ? [{ id: row.id }] : [] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }

  return { folders, documents, query };
}

function createTestApp(pool) {
  return createApp({
    foldersRouter: createFoldersRouter({ getPool: () => pool }),
    documentsRouter: createDocumentsRouter({
      getPool: () => pool,
      storage: {
        async uploadObject() {},
        async readObject() { return Buffer.from("%PDF-test"); },
        async removeObject() {},
        async createSignedDownloadUrl() { return "https://storage.example/signed"; },
      },
    }),
  });
}

test("folder CRUD is scoped to the authenticated student", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const list = await fetch(`${baseUrl}/api/student/folders`, { headers: sessionHeaders(tokenA) });
    assert.deepEqual((await list.json()).folders.map(({ name }) => name), ["Admission"]);

    const createdResponse = await fetch(`${baseUrl}/api/student/folders`, {
      method: "POST",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  Course   Notes " }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).folder;
    assert.equal(created.name, "Course Notes");
    assert.equal(pool.folders.get(created.id).user_id, aliceId);

    const renamed = await fetch(`${baseUrl}/api/student/folders/${created.id}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Class Notes" }),
    });
    assert.equal(renamed.status, 200);
    assert.equal((await renamed.json()).folder.name, "Class Notes");

    const deleted = await fetch(`${baseUrl}/api/student/folders/${created.id}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(deleted.status, 204);
    assert.equal(pool.folders.has(created.id), false);
  });
});

test("folder creation rejects duplicate case-insensitive names and invalid input", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const duplicate = await fetch(`${baseUrl}/api/student/folders`, {
      method: "POST",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "adMISSION" }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, "FOLDER_NAME_EXISTS");

    const anotherFolder = await fetch(`${baseUrl}/api/student/folders`, {
      method: "POST",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private" }),
    });
    assert.equal(anotherFolder.status, 201);

    const duplicateRename = await fetch(`${baseUrl}/api/student/folders/${folderAId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "pRIVATE" }),
    });
    assert.equal(duplicateRename.status, 409);

    for (const body of [{ name: "  " }, { name: "x".repeat(61) }, { name: "Valid", extra: true }]) {
      const response = await fetch(`${baseUrl}/api/student/folders`, {
        method: "POST",
        headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }

    const csrfMissing = await fetch(`${baseUrl}/api/student/folders`, {
      method: "POST",
      headers: { ...sessionHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No CSRF" }),
    });
    assert.equal(csrfMissing.status, 403);
  });
});

test("documents can be moved or unfiled without changing their storage path", async () => {
  const pool = createPool();
  const originalPath = pool.documents.get(documentId).storage_object_path;
  await withServer(createTestApp(pool), async (baseUrl) => {
    const moved = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folderAId }),
    });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).document.folderId, folderAId);

    const unfiled = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: null }),
    });
    assert.equal(unfiled.status, 200);
    assert.equal((await unfiled.json()).document.folderId, null);
    assert.equal(pool.documents.get(documentId).storage_object_path, originalPath);
  });
});

test("cross-student folder operations and document moves are denied", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const renameOtherFolder = await fetch(`${baseUrl}/api/student/folders/${folderBId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Changed" }),
    });
    const deleteOtherFolder = await fetch(`${baseUrl}/api/student/folders/${folderBId}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    const moveToOtherFolder = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folderBId }),
    });
    assert.deepEqual([renameOtherFolder.status, deleteOtherFolder.status, moveToOtherFolder.status], [404, 404, 404]);
    assert.equal(pool.folders.get(folderBId).name, "Private");
    assert.equal(pool.documents.get(documentId).folder_id, folderAId);
  });
});

test("deleting a folder leaves its documents and storage paths intact but unfiled", async () => {
  const pool = createPool();
  const storedPath = pool.documents.get(documentId).storage_object_path;
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/folders/${folderAId}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(response.status, 204);
    assert.equal(pool.documents.has(documentId), true);
    assert.equal(pool.documents.get(documentId).folder_id, null);
    assert.equal(pool.documents.get(documentId).storage_object_path, storedPath);
  });
});

test("folder migration is additive and its down migration removes only folder objects", async () => {
  const upSql = [];
  const downSql = [];
  const pgm = { sql: (sql) => upSql.push(sql) };
  await migration.up(pgm);
  const downPgm = { sql: (sql) => downSql.push(sql) };
  await migration.down(downPgm);
  const up = upSql.join("\n");
  const down = downSql.join("\n");
  assert.match(up, /CREATE TABLE student_folders/);
  assert.match(up, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(up, /lower\(btrim\(name\)\)/);
  assert.match(up, /ADD COLUMN folder_id uuid\s+REFERENCES student_folders\(id\) ON DELETE SET NULL/);
  assert.match(up, /student_folders ENABLE ROW LEVEL SECURITY/);
  assert.match(down, /DROP COLUMN folder_id/);
  assert.match(down, /DROP TABLE student_folders/);
  assert.doesNotMatch(down, /DROP TABLE (users|student_profiles|auth_sessions|student_documents)/);
  const migrationFile = await readFile(new URL("../migrations/004_create_student_folders.js", import.meta.url), "utf8");
  assert.match(migrationFile, /student_documents_user_folder_created_idx/);
});
