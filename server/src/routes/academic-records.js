import { Router } from "express";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recordTypes = new Set(["Programme information", "Semester result", "Course record"]);
const fields = {
  recordType: { column: "record_type", maxLength: 40, required: true },
  title: { column: "title", maxLength: 100, required: true },
  institution: { column: "institution", maxLength: 100, required: true },
  programme: { column: "programme", maxLength: 100, required: true },
  academicSession: { column: "academic_session", maxLength: 100, required: true },
  semester: { column: "semester", maxLength: 60, optional: true },
  level: { column: "level", maxLength: 60, optional: true },
  details: { column: "details", maxLength: 1000, optional: true },
};

function sendError(req, res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

function mapRecord(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    title: row.title,
    institution: row.institution,
    programme: row.programme,
    academicSession: row.academic_session,
    semester: row.semester ?? "",
    level: row.level ?? "",
    details: row.details ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateRecord(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide a valid academic record." };
  }
  const keys = Object.keys(body);
  if (keys.some((key) => !Object.hasOwn(fields, key))) {
    return { error: "The academic record contains a field that cannot be changed." };
  }
  if (keys.length === 0) return { error: "Provide at least one academic record field." };

  const values = {};
  for (const [requestField, definition] of Object.entries(fields)) {
    if (!Object.hasOwn(body, requestField)) {
      if (!partial && definition.required) {
        return { error: "Complete all required academic record fields." };
      }
      continue;
    }

    const value = body[requestField];
    if (definition.optional && (value === null || value === "")) {
      values[definition.column] = null;
      continue;
    }
    if (typeof value !== "string") {
      return { error: `${requestField} must be a string.` };
    }

    const normalized = requestField === "details"
      ? value.replace(/\u0000/g, "").trim()
      : value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ");
    if (!normalized && definition.optional) {
      values[definition.column] = null;
      continue;
    }
    if (!normalized && definition.required) {
      return { error: "Complete all required academic record fields." };
    }
    if (normalized.length > definition.maxLength) {
      return { error: `${requestField} must be ${definition.maxLength} characters or fewer.` };
    }
    if (requestField === "recordType" && !recordTypes.has(normalized)) {
      return { error: "Choose a valid academic record type." };
    }
    if (requestField === "recordType" && normalized === "Semester result" && !partial && !String(body.semester ?? "").trim()) {
      return { error: "Semester is required for a semester result." };
    }
    values[definition.column] = normalized;
  }

  return { values };
}

export function createAcademicRecordsRouter({ getPool = defaultGetPool } = {}) {
  const router = Router();
  router.use(requireStudentSession({ getPool }));

  router.get("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT id, record_type, title, institution, programme, academic_session,
                semester, level, details, created_at, updated_at
         FROM student_academic_records
         WHERE user_id = $1
         ORDER BY created_at DESC, id`,
        [req.studentUserId],
      );
      return res.status(200).json({ records: rows.map(mapRecord) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }

    const { values, error } = validateRecord(req.body);
    if (error) return sendError(req, res, 400, "INVALID_ACADEMIC_RECORD", error);
    try {
      const { rows } = await getPool().query(
        `INSERT INTO student_academic_records (
           user_id, record_type, title, institution, programme, academic_session,
           semester, level, details
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, record_type, title, institution, programme, academic_session,
                   semester, level, details, created_at, updated_at`,
        [
          req.studentUserId,
          values.record_type,
          values.title,
          values.institution,
          values.programme,
          values.academic_session,
          values.semester ?? null,
          values.level ?? null,
          values.details ?? null,
        ],
      );
      return res.status(201).json({ record: mapRecord(rows[0]) });
    } catch (queryError) {
      return next(queryError);
    }
  });

  router.patch("/:recordId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.recordId)) {
      return sendError(req, res, 404, "ACADEMIC_RECORD_NOT_FOUND", "The requested academic record was not found.");
    }

    const { values, error } = validateRecord(req.body, { partial: true });
    if (error) return sendError(req, res, 400, "INVALID_ACADEMIC_RECORD", error);
    try {
      const { rows: existingRows } = await getPool().query(
        `SELECT record_type, title, institution, programme, academic_session,
                semester, level, details
         FROM student_academic_records
         WHERE id = $1 AND user_id = $2`,
        [req.params.recordId, req.studentUserId],
      );
      if (!existingRows[0]) {
        return sendError(req, res, 404, "ACADEMIC_RECORD_NOT_FOUND", "The requested academic record was not found.");
      }

      const existing = existingRows[0];
      const resultingRecord = {
        recordType: existing.record_type,
        title: existing.title,
        institution: existing.institution,
        programme: existing.programme,
        academicSession: existing.academic_session,
        semester: existing.semester ?? "",
        level: existing.level ?? "",
        details: existing.details ?? "",
      };
      for (const [requestField, definition] of Object.entries(fields)) {
        if (Object.hasOwn(values, definition.column)) {
          resultingRecord[requestField] = values[definition.column] ?? "";
        }
      }
      const validatedResult = validateRecord(resultingRecord);
      if (validatedResult.error) {
        return sendError(req, res, 400, "INVALID_ACADEMIC_RECORD", validatedResult.error);
      }

      const columns = Object.keys(values);
      const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
      const params = [...columns.map((column) => values[column]), req.params.recordId, req.studentUserId];
      const { rows } = await getPool().query(
        `UPDATE student_academic_records
         SET ${setClause}
         WHERE id = $${columns.length + 1} AND user_id = $${columns.length + 2}
         RETURNING id, record_type, title, institution, programme, academic_session,
                   semester, level, details, created_at, updated_at`,
        params,
      );
      if (!rows[0]) return sendError(req, res, 404, "ACADEMIC_RECORD_NOT_FOUND", "The requested academic record was not found.");
      return res.status(200).json({ record: mapRecord(rows[0]) });
    } catch (queryError) {
      return next(queryError);
    }
  });

  router.delete("/:recordId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.recordId)) {
      return sendError(req, res, 404, "ACADEMIC_RECORD_NOT_FOUND", "The requested academic record was not found.");
    }
    try {
      const { rows } = await getPool().query(
        "DELETE FROM student_academic_records WHERE id = $1 AND user_id = $2 RETURNING id",
        [req.params.recordId, req.studentUserId],
      );
      if (!rows[0]) return sendError(req, res, 404, "ACADEMIC_RECORD_NOT_FOUND", "The requested academic record was not found.");
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
