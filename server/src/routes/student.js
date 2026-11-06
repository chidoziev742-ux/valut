import { Router } from "express";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";

const editableProfileFields = [
  { request: "fullName", column: "full_name", maxLength: 120, required: true },
  { request: "university", column: "university", maxLength: 120 },
  { request: "faculty", column: "faculty", maxLength: 120 },
  { request: "department", column: "department", maxLength: 120 },
  { request: "programme", column: "programme", maxLength: 120 },
  { request: "studyYear", column: "study_year", maxLength: 40 },
  { request: "academicSession", column: "academic_session", maxLength: 40 },
];

function sendError(req, res, status, code, message) {
  return res.status(status).json({
    error: { code, message, requestId: req.requestId },
  });
}

function validateProfile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "The profile body must be an object." };
  }

  const allowedFields = new Set(editableProfileFields.map(({ request }) => request));
  const unexpectedField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unexpectedField) return { error: `The ${unexpectedField} field cannot be changed.` };
  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return { error: "Full name is required." };
  }

  const values = {};
  for (const field of editableProfileFields) {
    const value = body[field.request];
    if (typeof value !== "string") {
      return { error: `${field.request} must be provided as a string.` };
    }

    const trimmed = value.trim();
    if (field.required && !trimmed) return { error: "Full name is required." };
    if (trimmed.length > field.maxLength) {
      return { error: `${field.request} must be ${field.maxLength} characters or fewer.` };
    }
    values[field.column] = trimmed || null;
  }

  return { values };
}

function mapProfile(row) {
  return {
    fullName: row.full_name,
    university: row.university,
    faculty: row.faculty,
    department: row.department,
    programme: row.programme,
    studyYear: row.study_year,
    academicSession: row.academic_session,
  };
}

export function createStudentRouter({ getPool = defaultGetPool } = {}) {
  const router = Router();
  router.use(requireStudentSession({ getPool }));

  router.get("/profile", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT full_name, university, faculty, department, programme,
                study_year, academic_session
         FROM student_profiles
         WHERE user_id = $1`,
        [req.studentUserId],
      );
      if (!rows[0]) {
        return sendError(req, res, 404, "PROFILE_NOT_FOUND", "Your student profile has not been created.");
      }
      return res.status(200).json({ profile: mapProfile(rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/profile", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }

    const { values, error } = validateProfile(req.body);
    if (error) return sendError(req, res, 400, "INVALID_PROFILE", error);

    try {
      const { rows } = await getPool().query(
        `INSERT INTO student_profiles (
           user_id, full_name, university, faculty, department, programme,
           study_year, academic_session
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             university = EXCLUDED.university,
             faculty = EXCLUDED.faculty,
             department = EXCLUDED.department,
             programme = EXCLUDED.programme,
             study_year = EXCLUDED.study_year,
             academic_session = EXCLUDED.academic_session
         RETURNING full_name, university, faculty, department, programme,
                   study_year, academic_session`,
        [
          req.studentUserId,
          values.full_name,
          values.university,
          values.faculty,
          values.department,
          values.programme,
          values.study_year,
          values.academic_session,
        ],
      );
      return res.status(200).json({ profile: mapProfile(rows[0]) });
    } catch (queryError) {
      return next(queryError);
    }
  });

  return router;
}
