import { Router } from "express";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const namePattern = /^[^\u0000-\u001f\u007f]+$/;
const uniqueNameIndex = "student_folders_user_name_unique_idx";

function sendError(req, res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

function validateFolderName(value) {
  if (typeof value !== "string" || !namePattern.test(value)) return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}

function handleDuplicateName(req, res, error) {
  if (error.code === "23505" && error.constraint === uniqueNameIndex) {
    return sendError(req, res, 409, "FOLDER_NAME_EXISTS", "A folder with this name already exists.");
  }
  return null;
}

export function createFoldersRouter({ getPool = defaultGetPool } = {}) {
  const router = Router();
  router.use(requireStudentSession({ getPool }));

  router.get("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT id, name, created_at, updated_at
         FROM student_folders
         WHERE user_id = $1
         ORDER BY created_at, id`,
        [req.studentUserId],
      );
      return res.status(200).json({
        folders: rows.map((row) => ({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, "name")) {
      return sendError(req, res, 400, "INVALID_FOLDER", "Provide a valid folder name.");
    }
    const name = validateFolderName(req.body.name);
    if (!name) return sendError(req, res, 400, "INVALID_FOLDER", "Folder names must be 1 to 60 valid characters.");
    try {
      const { rows } = await getPool().query(
        `INSERT INTO student_folders (user_id, name)
         VALUES ($1, $2)
         RETURNING id, name, created_at, updated_at`,
        [req.studentUserId, name],
      );
      const row = rows[0];
      return res.status(201).json({
        folder: { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at },
      });
    } catch (error) {
      return handleDuplicateName(req, res, error) ?? next(error);
    }
  });

  router.patch("/:folderId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.folderId)) {
      return sendError(req, res, 404, "FOLDER_NOT_FOUND", "The requested folder was not found.");
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, "name")) {
      return sendError(req, res, 400, "INVALID_FOLDER", "Provide a valid folder name.");
    }
    const name = validateFolderName(req.body.name);
    if (!name) return sendError(req, res, 400, "INVALID_FOLDER", "Folder names must be 1 to 60 valid characters.");
    try {
      const { rows } = await getPool().query(
        `UPDATE student_folders
         SET name = $1
         WHERE id = $2 AND user_id = $3
         RETURNING id, name, created_at, updated_at`,
        [name, req.params.folderId, req.studentUserId],
      );
      if (!rows[0]) return sendError(req, res, 404, "FOLDER_NOT_FOUND", "The requested folder was not found.");
      const row = rows[0];
      return res.status(200).json({
        folder: { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at },
      });
    } catch (error) {
      return handleDuplicateName(req, res, error) ?? next(error);
    }
  });

  router.delete("/:folderId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.folderId)) {
      return sendError(req, res, 404, "FOLDER_NOT_FOUND", "The requested folder was not found.");
    }
    try {
      const { rows } = await getPool().query(
        "DELETE FROM student_folders WHERE id = $1 AND user_id = $2 RETURNING id",
        [req.params.folderId, req.studentUserId],
      );
      if (!rows[0]) return sendError(req, res, 404, "FOLDER_NOT_FOUND", "The requested folder was not found.");
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
