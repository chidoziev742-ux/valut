import { randomUUID } from "node:crypto";
import Busboy from "busboy";
import { Router } from "express";
import { config } from "../config.js";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";
import { createSupabaseStorage } from "../services/supabaseStorage.js";

const categories = new Set([
  "Personal Documents",
  "Academic Records",
  "Financial Documents",
  "Course Materials",
  "Certificates",
  "Other",
]);
const uploadWindows = new Map();
const fileTypes = {
  ".pdf": { fileType: "PDF", mimeType: "application/pdf", signature: (bytes) => bytes.subarray(0, 5).toString() === "%PDF-" },
  ".jpg": { fileType: "JPG", mimeType: "image/jpeg", signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  ".jpeg": { fileType: "JPEG", mimeType: "image/jpeg", signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  ".png": { fileType: "PNG", mimeType: "image/png", signature: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
};

function sendError(req, res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

function mapDocument(row) {
  const fileSizeBytes = Number(row.file_size);
  const fileSize = fileSizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(fileSizeBytes / 1024))} KB`
    : `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  return {
    id: row.id,
    name: row.title,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    mimeType: row.mime_type,
    fileSize,
    fileSizeBytes,
    uploadedAt: new Date(row.created_at).toISOString().slice(0, 10),
    category: row.category,
    academicSession: row.academic_session ?? "",
    source: row.source,
    pageCount: row.page_count,
    archived: Boolean(row.archived_at),
    archivedAt: row.archived_at,
    folderId: row.folder_id ?? null,
    fileExtension: row.original_filename.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "",
    storageBacked: true,
    description: row.source === "camera" ? "Scanned document." : "Uploaded from this device.",
  };
}

function safeFilename(filename) {
  const basename = String(filename ?? "").split(/[\\/]/).pop() ?? "";
  const normalized = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return normalized.length > 0 && normalized.length <= 255 ? normalized : null;
}

function validateTitle(value) {
  if (typeof value !== "string") return null;
  const title = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ");
  return title.length > 0 && title.length <= 100 ? title : null;
}

function parseUpload(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: config.storage.maxUploadBytes,
          files: 1,
          fields: 5,
          parts: 6,
          fieldSize: 1024,
        },
      });
    } catch {
      reject(Object.assign(new Error("A valid multipart document upload is required."), { status: 400, code: "INVALID_UPLOAD" }));
      return;
    }

    const fields = {};
    let upload;
    let parserError;
    parser.on("field", (name, value, info) => {
      if (info.valueTruncated || !["title", "category", "academicSession", "source", "pageCount"].includes(name) || Object.hasOwn(fields, name)) {
        parserError = Object.assign(new Error("The document metadata is invalid."), { status: 400, code: "INVALID_UPLOAD" });
        return;
      }
      fields[name] = value;
    });
    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "file" || upload) {
        parserError = Object.assign(new Error("Upload exactly one document file."), { status: 400, code: "INVALID_UPLOAD" });
        stream.resume();
        return;
      }
      const filename = safeFilename(info.filename);
      const extension = filename ? filename.match(/\.[^.]+$/)?.[0].toLowerCase() : "";
      const expectedType = fileTypes[extension];
      if (!filename || !expectedType || info.mimeType !== expectedType.mimeType) {
        parserError = Object.assign(new Error("Choose a PDF, JPG, JPEG, or PNG file with a matching file type."), { status: 400, code: "INVALID_FILE_TYPE" });
        stream.resume();
        return;
      }

      const chunks = [];
      let totalBytes = 0;
      stream.on("data", (chunk) => {
        totalBytes += chunk.length;
        chunks.push(chunk);
      });
      stream.on("limit", () => {
        parserError = Object.assign(new Error("The selected file exceeds the upload size limit."), { status: 413, code: "FILE_TOO_LARGE" });
      });
      stream.on("end", () => {
        const bytes = Buffer.concat(chunks);
        if (stream.truncated || totalBytes > config.storage.maxUploadBytes) {
          parserError = Object.assign(new Error("The selected file exceeds the upload size limit."), { status: 413, code: "FILE_TOO_LARGE" });
        } else if (bytes.length === 0 || !expectedType.signature(bytes)) {
          parserError = Object.assign(new Error("The file content does not match its declared type."), { status: 400, code: "INVALID_FILE_TYPE" });
        } else {
          upload = { filename, extension, ...expectedType, bytes };
        }
      });
    });
    parser.on("filesLimit", () => {
      parserError = Object.assign(new Error("Upload exactly one document file."), { status: 400, code: "INVALID_UPLOAD" });
    });
    parser.on("fieldsLimit", () => {
      parserError = Object.assign(new Error("The document metadata is invalid."), { status: 400, code: "INVALID_UPLOAD" });
    });
    parser.on("partsLimit", () => {
      parserError = Object.assign(new Error("The document upload contains too many fields."), { status: 400, code: "INVALID_UPLOAD" });
    });
    parser.on("error", () => {
      parserError = Object.assign(new Error("The document upload could not be read."), { status: 400, code: "INVALID_UPLOAD" });
    });
    parser.on("finish", () => {
      if (parserError) {
        reject(parserError);
        return;
      }
      if (!upload) {
        reject(Object.assign(new Error("Choose a document file to upload."), { status: 400, code: "INVALID_UPLOAD" }));
        return;
      }
      const title = validateTitle(fields.title);
      if (!title || !categories.has(fields.category)) {
        reject(Object.assign(new Error("Enter a valid document title and category."), { status: 400, code: "INVALID_METADATA" }));
        return;
      }
      const academicSession = fields.academicSession?.trim() || null;
      if (academicSession && academicSession.length > 40) {
        reject(Object.assign(new Error("Academic session must be 40 characters or fewer."), { status: 400, code: "INVALID_METADATA" }));
        return;
      }
      const source = fields.source ?? "device";
      const pageCount = fields.pageCount === undefined ? null : Number(fields.pageCount);
      if (
        !["device", "camera"].includes(source)
        || (source === "camera"
          ? (!/^\d+$/.test(fields.pageCount ?? "") || !Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100)
          : fields.pageCount !== undefined && (!/^\d+$/.test(fields.pageCount) || !Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100))
      ) {
        reject(Object.assign(new Error("The document source or page count is invalid."), { status: 400, code: "INVALID_METADATA" }));
        return;
      }
      resolve({ ...upload, title, category: fields.category, academicSession, source, pageCount });
    });
    req.pipe(parser);
  });
}

function enforceUploadRateLimit(req, res, next) {
  const now = Date.now();
  const cutoff = now - 60_000;
  const recent = (uploadWindows.get(req.studentUserId) ?? []).filter((time) => time > cutoff);
  if (recent.length >= config.storage.uploadsPerMinute) {
    res.set("Retry-After", "60");
    return sendError(req, res, 429, "UPLOAD_RATE_LIMITED", "Too many uploads. Please wait a minute and try again.");
  }
  recent.push(now);
  uploadWindows.set(req.studentUserId, recent);
  if (uploadWindows.size > 10_000) {
    for (const [userId, timestamps] of uploadWindows) {
      if (!timestamps.some((time) => time > cutoff)) uploadWindows.delete(userId);
    }
  }
  return next();
}

function requireCsrf(req, res, next) {
  if (!hasValidStudentCsrfToken(req)) {
    return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
  }
  return next();
}

export function createDocumentsRouter({
  getPool = defaultGetPool,
  storage = createSupabaseStorage(),
} = {}) {
  const router = Router();
  router.use(requireStudentSession({ getPool }));

  router.get("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const allowedFilters = new Set(["search", "category", "fileType", "archived"]);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const fileType = typeof req.query.fileType === "string" ? req.query.fileType.toUpperCase() : null;
    const archivedValue = req.query.archived;
    const archived = archivedValue === "true";
    if (
      Object.keys(req.query).some((key) => !allowedFilters.has(key))
      || (req.query.search !== undefined && typeof req.query.search !== "string")
      || (req.query.category !== undefined && typeof req.query.category !== "string")
      || (req.query.fileType !== undefined && typeof req.query.fileType !== "string")
      || (archivedValue !== undefined && archivedValue !== "true" && archivedValue !== "false")
      || search.length > 100
      || (category && !categories.has(category))
      || (fileType && !Object.values(fileTypes).some(({ fileType: type }) => type === fileType))
    ) {
      return sendError(req, res, 400, "INVALID_FILTER", "The document filter is invalid.");
    }
    try {
      const { rows } = await getPool().query(
        `SELECT id, title, original_filename, file_type, mime_type, file_size, folder_id,
                category, academic_session, source, page_count, archived_at, created_at
         FROM student_documents
         WHERE user_id = $1
           AND (($2::boolean AND archived_at IS NOT NULL) OR (NOT $2::boolean AND archived_at IS NULL))
           AND ($3::text IS NULL OR category = $3)
           AND ($4::text IS NULL OR file_type = $4)
           AND ($5::text = '' OR title ILIKE '%' || $5 || '%' OR original_filename ILIKE '%' || $5 || '%')
         ORDER BY created_at DESC
         LIMIT 100`,
        [req.studentUserId, archived, category, fileType, search],
      );
      return res.status(200).json({ documents: rows.map(mapDocument) });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/summary", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT
           COUNT(*) FILTER (WHERE archived_at IS NULL)::integer AS active_count,
           COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::integer AS archived_count,
           COUNT(*) FILTER (
             WHERE archived_at IS NULL AND category = 'Academic Records'
           )::integer AS academic_documents_count,
           COALESCE(SUM(file_size) FILTER (WHERE archived_at IS NULL), 0)::text AS active_storage_bytes,
           COUNT(*)::integer AS stored_document_count,
           COALESCE(SUM(file_size), 0)::text AS total_storage_bytes
         FROM student_documents
         WHERE user_id = $1`,
        [req.studentUserId],
      );
      const categoryResult = await getPool().query(
        `SELECT category,
                COUNT(*) FILTER (WHERE archived_at IS NULL)::integer AS document_count,
                COUNT(*)::integer AS stored_document_count,
                COALESCE(SUM(file_size), 0)::text AS storage_bytes
         FROM student_documents
         WHERE user_id = $1
         GROUP BY category
         ORDER BY category`,
        [req.studentUserId],
      );
      const summary = rows[0];
      return res.status(200).json({
        summary: {
          activeCount: summary.active_count,
          archivedCount: summary.archived_count,
          academicDocumentsCount: summary.academic_documents_count,
          activeStorageBytes: Number(summary.active_storage_bytes),
          storedDocumentCount: summary.stored_document_count,
          totalStorageBytes: Number(summary.total_storage_bytes),
          categoryCounts: categoryResult.rows
            .filter(({ document_count }) => document_count > 0)
            .map(({ category, document_count }) => ({
              category,
              count: document_count,
            })),
          storageByCategory: categoryResult.rows.map(({ category, stored_document_count, storage_bytes }) => ({
            category,
            count: stored_document_count,
            storageBytes: Number(storage_bytes),
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", enforceUploadRateLimit, requireCsrf, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    let upload;
    let objectPath;
    let objectUploadAttempted = false;
    try {
      upload = await parseUpload(req);
      const documentId = randomUUID();
      objectPath = `${req.studentUserId}/${documentId}${upload.extension}`;
      objectUploadAttempted = true;
      await storage.uploadObject(objectPath, upload.bytes, upload.mimeType, {
        requestId: req.requestId,
      });
      const { rows } = await getPool().query(
        `INSERT INTO student_documents (
           id, user_id, title, original_filename, file_type, mime_type, file_size,
             storage_object_path, source, page_count, category, academic_session
         )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, title, original_filename, file_type, mime_type, file_size, folder_id,
                   category, academic_session, source, page_count, archived_at, created_at`,
        [
          documentId,
          req.studentUserId,
          upload.title,
          upload.filename,
          upload.fileType,
          upload.mimeType,
          upload.bytes.length,
          objectPath,
          upload.source,
          upload.pageCount,
          upload.category,
          upload.academicSession,
        ],
      );
      return res.status(201).json({ document: mapDocument(rows[0]) });
    } catch (error) {
      if (objectUploadAttempted && objectPath && error.name !== "StorageUnavailableError") {
        try {
          await storage.removeObject(objectPath);
        } catch {
          console.error(JSON.stringify({
            level: "error",
            requestId: req.requestId,
            message: "Failed to clean up an incomplete document upload",
          }));
        }
      }
      if (error.status && error.code) return sendError(req, res, error.status, error.code, error.message);
      if (error.name === "StorageUnavailableError") return sendError(req, res, 503, error.code, error.message);
      return next(error);
    }
  });

  router.get("/:documentId/download", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.documentId)) {
      return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
    }
    try {
      const { rows } = await getPool().query(
        "SELECT storage_object_path FROM student_documents WHERE id = $1 AND user_id = $2",
        [req.params.documentId, req.studentUserId],
      );
      if (!rows[0]) return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
      const downloadUrl = await storage.createSignedDownloadUrl(rows[0].storage_object_path, 60);
      return res.status(200).json({ downloadUrl, expiresIn: 60 });
    } catch (error) {
      if (error.status === 503 && error.code === "STORAGE_UNAVAILABLE") {
        return sendError(req, res, error.status, error.code, error.message);
      }
      if (error.name === "StorageUnavailableError") {
        return sendError(req, res, 503, error.code, error.message);
      }
      return next(error);
    }
  });

  router.get("/:documentId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.documentId)) {
      return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
    }
    try {
      const { rows } = await getPool().query(
        `SELECT id, title, original_filename, file_type, mime_type, file_size, folder_id,
                category, academic_session, source, page_count, archived_at, created_at
         FROM student_documents
         WHERE id = $1 AND user_id = $2`,
        [req.params.documentId, req.studentUserId],
      );
      if (!rows[0]) return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
      return res.status(200).json({ document: mapDocument(rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:documentId", requireCsrf, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.documentId)) {
      return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendError(req, res, 400, "INVALID_DOCUMENT_UPDATE", "The document update is invalid.");
    }
    const keys = Object.keys(body);
    if (keys.length !== 1) return sendError(req, res, 400, "INVALID_DOCUMENT_UPDATE", "Update one supported document field at a time.");
    try {
      let query;
      let values;
      if (keys[0] === "name") {
        const title = validateTitle(body.name);
        if (!title) return sendError(req, res, 400, "INVALID_DOCUMENT_UPDATE", "Enter a valid document title.");
        query = `UPDATE student_documents SET title = $1
                 WHERE id = $2 AND user_id = $3
                 RETURNING id, title, original_filename, file_type, mime_type, file_size, folder_id,
                           category, academic_session, source, page_count, archived_at, created_at`;
        values = [title, req.params.documentId, req.studentUserId];
      } else if (keys[0] === "category" && categories.has(body.category)) {
        query = `UPDATE student_documents SET category = $1
                 WHERE id = $2 AND user_id = $3
                 RETURNING id, title, original_filename, file_type, mime_type, file_size, folder_id,
                           category, academic_session, source, page_count, archived_at, created_at`;
        values = [body.category, req.params.documentId, req.studentUserId];
      } else if (keys[0] === "archived" && typeof body.archived === "boolean") {
        query = `UPDATE student_documents SET archived_at = CASE WHEN $1 THEN now() ELSE NULL END
                 WHERE id = $2 AND user_id = $3
                 RETURNING id, title, original_filename, file_type, mime_type, file_size, folder_id,
                           category, academic_session, source, page_count, archived_at, created_at`;
        values = [body.archived, req.params.documentId, req.studentUserId];
      } else if (keys[0] === "folderId" && (body.folderId === null
        || (typeof body.folderId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.folderId)))) {
        query = `UPDATE student_documents AS document
                 SET folder_id = $1
                 WHERE document.id = $2
                   AND document.user_id = $3
                   AND (
                     $1::uuid IS NULL
                     OR EXISTS (
                       SELECT 1 FROM student_folders AS folder
                       WHERE folder.id = $1 AND folder.user_id = $3
                     )
                   )
                 RETURNING document.id, document.title, document.original_filename,
                           document.file_type, document.mime_type, document.file_size,
                           document.folder_id, document.category, document.academic_session,
                           document.source, document.page_count, document.archived_at,
                           document.created_at`;
        values = [body.folderId, req.params.documentId, req.studentUserId];
      } else {
        if (keys[0] === "folderId") {
          return sendError(req, res, 400, "INVALID_DOCUMENT_UPDATE", "The folder assignment is invalid.");
        }
        return sendError(req, res, 400, "INVALID_DOCUMENT_UPDATE", "The requested document field cannot be changed.");
      }
      const { rows } = await getPool().query(query, values);
      if (!rows[0] && keys[0] === "folderId" && body.folderId !== null) {
        const documentResult = await getPool().query(
          "SELECT id FROM student_documents WHERE id = $1 AND user_id = $2",
          [req.params.documentId, req.studentUserId],
        );
        if (documentResult.rows[0]) {
          return sendError(req, res, 404, "FOLDER_NOT_FOUND", "The requested folder was not found.");
        }
      }
      if (!rows[0]) return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
      return res.status(200).json({ document: mapDocument(rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:documentId", requireCsrf, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.documentId)) {
      return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
    }
    const pool = getPool();
    let client;
    let objectPath;
    let objectBytes;
    let objectRemoved = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT storage_object_path FROM student_documents WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [req.params.documentId, req.studentUserId],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return sendError(req, res, 404, "DOCUMENT_NOT_FOUND", "The requested document was not found.");
      }
      objectPath = rows[0].storage_object_path;
      objectBytes = await storage.readObject(objectPath);
      await storage.removeObject(objectPath);
      objectRemoved = true;
      await client.query(
        "DELETE FROM student_documents WHERE id = $1 AND user_id = $2",
        [req.params.documentId, req.studentUserId],
      );
      await client.query("COMMIT");
      return res.status(204).end();
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          console.error(JSON.stringify({ level: "error", requestId: req.requestId, message: "Document deletion rollback failed" }));
        }
      }
      if (objectRemoved && objectPath && objectBytes) {
        try {
          const extension = objectPath.split(".").pop().toLowerCase();
          const mimeType = fileTypes[`.${extension}`]?.mimeType;
          if (mimeType) await storage.uploadObject(objectPath, objectBytes, mimeType, { overwrite: true });
        } catch {
          console.error(JSON.stringify({ level: "error", requestId: req.requestId, message: "Deleted document storage compensation failed" }));
        }
      }
      if (error.name === "StorageUnavailableError") return sendError(req, res, 503, error.code, error.message);
      if (error.status === 503 && error.code === "STORAGE_UNAVAILABLE") {
        return sendError(req, res, error.status, error.code, error.message);
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}
