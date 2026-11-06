import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createDocumentsRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/documents.js"),
]);

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
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

function documentRow(ownerId = aliceId, id = documentId, overrides = {}) {
  return {
    id,
    user_id: ownerId,
    title: "Transcript",
    original_filename: "transcript.pdf",
    file_type: "PDF",
    mime_type: "application/pdf",
    file_size: "18",
    storage_object_path: `${ownerId}/${id}.pdf`,
    source: "device",
    page_count: null,
    category: "Academic Records",
    academic_session: "2025/2026",
    archived_at: null,
    created_at: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function createPool({ seed = [], failInsert = false } = {}) {
  const sessions = new Map([
    [tokenHash(tokenA), aliceId],
    [tokenHash(tokenB), bobId],
  ]);
  const documents = new Map(seed.map((row) => [row.id, { ...row }]));
  const queries = [];

  async function query(text, values = []) {
    queries.push({ text, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rows: [] };
    if (text.includes("FROM auth_sessions s")) {
      const ownerId = sessions.get(values[0]);
      return { rows: ownerId ? [{ user_id: ownerId }] : [] };
    }
    if (text.includes("INSERT INTO student_documents")) {
      if (failInsert) throw new Error("simulated database insert failure");
      const [
        id, userId, title, filename, fileType, mimeType, fileSize, objectPath, source, pageCount, category, academicSession,
      ] = values;
      const row = documentRow(userId, id, {
        title,
        original_filename: filename,
        file_type: fileType,
        mime_type: mimeType,
        file_size: String(fileSize),
        storage_object_path: objectPath,
        source,
        page_count: pageCount,
        category,
        academic_session: academicSession,
        created_at: new Date(),
      });
      documents.set(id, row);
      return { rows: [{ ...row }] };
    }
    if (text.startsWith("SELECT") && text.includes("FROM student_documents")) {
      const ownerId = values.find((value) => value === aliceId || value === bobId);
      const id = values.find((value) => value === documentId);
      if (text.includes("COUNT(*) FILTER") && !text.includes("GROUP BY category")) {
        const ownedRows = [...documents.values()].filter((row) => row.user_id === values[0]);
        const activeRows = ownedRows.filter((row) => row.archived_at === null);
        return {
          rows: [{
            active_count: activeRows.length,
            archived_count: ownedRows.length - activeRows.length,
            academic_documents_count: activeRows.filter((row) => row.category === "Academic Records").length,
            active_storage_bytes: String(activeRows.reduce((total, row) => total + Number(row.file_size), 0)),
            stored_document_count: ownedRows.length,
            total_storage_bytes: String(ownedRows.reduce((total, row) => total + Number(row.file_size), 0)),
          }],
        };
      }
      if (text.includes("GROUP BY category")) {
        const counts = new Map();
        for (const row of documents.values()) {
          if (row.user_id === values[0]) {
            const category = counts.get(row.category) ?? { document_count: 0, stored_document_count: 0, storage_bytes: 0 };
            category.stored_document_count += 1;
            category.storage_bytes += Number(row.file_size);
            if (row.archived_at === null) category.document_count += 1;
            counts.set(row.category, category);
          }
        }
        return {
          rows: [...counts].map(([category, countsByCategory]) => ({
            category,
            document_count: countsByCategory.document_count,
            stored_document_count: countsByCategory.stored_document_count,
            storage_bytes: String(countsByCategory.storage_bytes),
          })),
        };
      }
      if (text.includes("storage_object_path") && id) {
        const row = documents.get(id);
        return { rows: row?.user_id === ownerId ? [{ storage_object_path: row.storage_object_path }] : [] };
      }
      if (text.includes("WHERE id = $1 AND user_id = $2")) {
        const row = documents.get(values[0]);
        return { rows: row?.user_id === values[1] ? [{ ...row }] : [] };
      }
      const archived = values[1];
      return {
        rows: [...documents.values()]
          .filter((row) => row.user_id === values[0])
          .filter((row) => archived ? row.archived_at !== null : row.archived_at === null)
          .map((row) => ({ ...row })),
      };
    }
    if (text.startsWith("UPDATE student_documents")) {
      const row = documents.get(values[1]);
      if (!row || row.user_id !== values[2]) return { rows: [] };
      if (text.includes("SET title")) row.title = values[0];
      if (text.includes("SET category")) row.category = values[0];
      if (text.includes("SET archived_at")) row.archived_at = values[0] ? new Date() : null;
      return { rows: [{ ...row }] };
    }
    if (text.startsWith("DELETE FROM student_documents")) {
      const row = documents.get(values[0]);
      if (row?.user_id === values[1]) documents.delete(values[0]);
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }

  return {
    documents,
    queries,
    query,
    async connect() {
      return {
        query,
        release() {},
      };
    },
  };
}

function createStorage({ failUpload = false, failCleanup = false } = {}) {
  const objects = new Map();
  const removed = [];
  return {
    objects,
    removed,
    async uploadObject(path, bytes) {
      if (failUpload) {
        throw Object.assign(new Error("Document storage could not complete the request."), {
          status: 503,
          code: "STORAGE_UNAVAILABLE",
        });
      }
      objects.set(path, Buffer.from(bytes));
    },
    async removeObject(path) {
      removed.push(path);
      if (failCleanup) throw new Error("simulated cleanup failure");
      objects.delete(path);
    },
    async readObject(path) {
      const bytes = objects.get(path);
      if (!bytes) throw new Error("stored object not found");
      return Buffer.from(bytes);
    },
    async createSignedDownloadUrl(path) {
      return `https://storage.example/signed/${encodeURIComponent(path)}`;
    },
  };
}

function createTestApp(pool, storage = createStorage()) {
  return createApp({
    documentsRouter: createDocumentsRouter({ getPool: () => pool, storage }),
  });
}

function pdfUpload({ filename = "transcript.pdf", mimeType = "application/pdf", bytes = Buffer.from("%PDF-1.7\nsample") } = {}) {
  const body = new FormData();
  body.set("file", new Blob([bytes], { type: mimeType }), filename);
  body.set("title", "Transcript");
  body.set("category", "Academic Records");
  body.set("academicSession", "2025/2026");
  return body;
}

test("unauthenticated users cannot list or upload student documents", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/student/documents`);
    const uploadResponse = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      body: pdfUpload(),
    });
    assert.equal(listResponse.status, 401);
    assert.equal(uploadResponse.status, 401);
    assert.equal(pool.queries.length, 0);
  });
});

test("a student upload is stored and listed only for its authenticated owner", async () => {
  const pool = createPool();
  const storage = createStorage();
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: pdfUpload(),
    });
    const payload = await response.json();
    assert.equal(response.status, 201);
    assert.equal(payload.document.name, "Transcript");
    assert.equal(payload.document.storageBacked, true);
    assert.equal(pool.documents.get(payload.document.id).user_id, aliceId);
    assert.equal(storage.objects.has(`${aliceId}/${payload.document.id}.pdf`), true);

    const aliceList = await fetch(`${baseUrl}/api/student/documents?archived=false`, {
      headers: sessionHeaders(tokenA),
    });
    const bobList = await fetch(`${baseUrl}/api/student/documents?archived=false`, {
      headers: sessionHeaders(tokenB),
    });
    assert.equal((await aliceList.json()).documents.length, 1);
    assert.deepEqual((await bobList.json()).documents, []);
  });
});

test("camera upload metadata records its source and page count", async () => {
  const pool = createPool();
  const storage = createStorage();
  const body = new FormData();
  body.set("file", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: "image/jpeg" }), "scan.jpg");
  body.set("title", "Scanned document");
  body.set("category", "Academic Records");
  body.set("source", "camera");
  body.set("pageCount", "3");
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body,
    });
    const payload = await response.json();
    assert.equal(response.status, 201, JSON.stringify(payload.error));
    assert.equal(payload.document.source, "camera");
    assert.equal(payload.document.pageCount, 3);
    const insert = pool.queries.find(({ text }) => text.includes("INSERT INTO student_documents"));
    assert.equal(insert.values[8], "camera");
    assert.equal(insert.values[9], 3);
  });
});

test("dashboard document summaries contain exact owner-scoped counts", async () => {
  const pool = createPool({
    seed: [
      documentRow(aliceId, documentId, { file_size: "18" }),
      documentRow(aliceId, "44444444-4444-4444-8444-444444444444", {
        file_size: "30",
        archived_at: new Date(),
        category: "Other",
      }),
      documentRow(bobId, "55555555-5555-4555-8555-555555555555", { file_size: "40" }),
    ],
  });
  await withServer(createTestApp(pool), async (baseUrl) => {
    const aliceResponse = await fetch(`${baseUrl}/api/student/documents/summary`, {
      headers: sessionHeaders(tokenA),
    });
    const bobResponse = await fetch(`${baseUrl}/api/student/documents/summary`, {
      headers: sessionHeaders(tokenB),
    });
    const aliceSummary = (await aliceResponse.json()).summary;
    const bobSummary = (await bobResponse.json()).summary;
    assert.equal(aliceResponse.status, 200);
    assert.deepEqual(aliceSummary, {
      activeCount: 1,
      archivedCount: 1,
      academicDocumentsCount: 1,
      activeStorageBytes: 18,
      storedDocumentCount: 2,
      totalStorageBytes: 48,
      categoryCounts: [{ category: "Academic Records", count: 1 }],
      storageByCategory: [
        { category: "Academic Records", count: 1, storageBytes: 18 },
        { category: "Other", count: 1, storageBytes: 30 },
      ],
    });
    assert.equal(bobSummary.activeCount, 1);
    assert.equal(bobSummary.activeStorageBytes, 40);
    assert.equal(bobSummary.storedDocumentCount, 1);
    assert.equal(bobSummary.totalStorageBytes, 40);
  });
});

test("invalid content and files over the configured default limit are rejected", async () => {
  const pool = createPool();
  const storage = createStorage();
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const mismatch = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: pdfUpload({ bytes: Buffer.from("not a PDF") }),
    });
    assert.equal(mismatch.status, 400);
    assert.equal((await mismatch.json()).error.code, "INVALID_FILE_TYPE");

    const oversized = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: pdfUpload({ bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(10 * 1024 * 1024 + 1)]) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "FILE_TOO_LARGE");
    assert.equal(pool.documents.size, 0);
    assert.equal(storage.objects.size, 0);
  });
});

test("CSRF is required for document uploads and updates", async () => {
  const pool = createPool({ seed: [documentRow()] });
  const storage = createStorage();
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const uploadResponse = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: sessionHeaders(tokenA),
      body: pdfUpload(),
    });
    const updateResponse = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...sessionHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Changed title" }),
    });
    assert.equal(uploadResponse.status, 403);
    assert.equal(updateResponse.status, 403);
    assert.equal(storage.objects.size, 0);
  });
});

test("document filters reject unsupported or malformed values", async () => {
  const pool = createPool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const repeatedFilter = await fetch(`${baseUrl}/api/student/documents?archived=false&category=Other&category=Academic%20Records`, {
      headers: sessionHeaders(tokenA),
    });
    const unsupportedFilter = await fetch(`${baseUrl}/api/student/documents?archived=perhaps`, {
      headers: sessionHeaders(tokenA),
    });
    assert.equal(repeatedFilter.status, 400);
    assert.equal(unsupportedFilter.status, 400);
  });
});

test("a student cannot access, download, rename, or delete another student's document", async () => {
  const row = documentRow(aliceId);
  const pool = createPool({ seed: [row] });
  const storage = createStorage();
  storage.objects.set(row.storage_object_path, Buffer.from("%PDF-1.7\nsample"));
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const detail = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      headers: sessionHeaders(tokenB),
    });
    const download = await fetch(`${baseUrl}/api/student/documents/${documentId}/download`, {
      headers: sessionHeaders(tokenB),
    });
    const rename = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenB), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Stolen" }),
    });
    const changeOwner = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenB), "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: bobId }),
    });
    const deletion = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenB),
    });
    assert.deepEqual([detail.status, download.status, rename.status, changeOwner.status, deletion.status], [404, 404, 404, 400, 404]);
    assert.equal(pool.documents.has(documentId), true);
    assert.equal(storage.objects.has(row.storage_object_path), true);
  });
});

test("storage failures do not create document records", async () => {
  const pool = createPool();
  const storage = createStorage({ failUpload: true, failCleanup: true });
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await withServer(createTestApp(pool, storage), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/student/documents`, {
        method: "POST",
        headers: csrfHeaders(tokenA),
        body: pdfUpload(),
      });
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.equal(payload.error.message, "Document storage could not complete the request.");
      assert.equal(typeof payload.error.requestId, "string");
      assert.equal(pool.documents.size, 0);
      assert.equal(storage.removed.length, 1);
      assert.equal(logged.length, 1);
      assert.equal(JSON.parse(logged[0]).requestId, payload.error.requestId);
      assert.equal(JSON.parse(logged[0]).message, "Failed to clean up an incomplete document upload");
    });
  } finally {
    console.error = originalError;
  }
});

test("database insert failures clean up uploaded objects", async () => {
  const pool = createPool({ failInsert: true });
  const storage = createStorage();
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/documents`, {
      method: "POST",
      headers: csrfHeaders(tokenA),
      body: pdfUpload(),
    });
    assert.equal(response.status, 500);
    assert.equal(pool.documents.size, 0);
    assert.equal(storage.objects.size, 0);
    assert.equal(storage.removed.length, 1);
  });
});

test("an owner can obtain a signed download and delete the stored object", async () => {
  const row = documentRow(aliceId);
  const pool = createPool({ seed: [row] });
  const storage = createStorage();
  storage.objects.set(row.storage_object_path, Buffer.from("%PDF-1.7\nsample"));
  await withServer(createTestApp(pool, storage), async (baseUrl) => {
    const rename = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "PATCH",
      headers: { ...csrfHeaders(tokenA), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated transcript" }),
    });
    assert.equal(rename.status, 200);
    assert.equal((await rename.json()).document.name, "Updated transcript");

    const download = await fetch(`${baseUrl}/api/student/documents/${documentId}/download`, {
      headers: sessionHeaders(tokenA),
    });
    assert.equal(download.status, 200);
    assert.equal((await download.json()).downloadUrl, `https://storage.example/signed/${encodeURIComponent(row.storage_object_path)}`);

    const deletion = await fetch(`${baseUrl}/api/student/documents/${documentId}`, {
      method: "DELETE",
      headers: csrfHeaders(tokenA),
    });
    assert.equal(deletion.status, 204);
    assert.equal(pool.documents.has(documentId), false);
    assert.equal(storage.objects.has(row.storage_object_path), false);
  });
});
