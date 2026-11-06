import { Router } from "express";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedActionDestinations = new Set(["/profile", "/settings#account-info"]);

function sendError(req, res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

function mapNotification(row) {
  if (row.action_destination && !allowedActionDestinations.has(row.action_destination)) {
    throw new Error("Stored notification action destination is not allowed.");
  }
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    source: row.source,
    category: row.category,
    isRead: row.is_read,
    readAt: row.read_at,
    actionDestination: row.action_destination,
    createdAt: row.created_at,
  };
}

export function createNotificationsRouter({ getPool = defaultGetPool } = {}) {
  const router = Router();
  router.use(requireStudentSession({ getPool }));

  router.get("/", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT id, title, message, source, category, is_read, read_at,
                action_destination, created_at
         FROM student_notifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC`,
        [req.studentUserId],
      );
      return res.status(200).json({ notifications: rows.map(mapNotification) });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/unread-count", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const { rows } = await getPool().query(
        `SELECT count(*)::int AS unread_count
         FROM student_notifications
         WHERE user_id = $1 AND is_read = false`,
        [req.studentUserId],
      );
      return res.status(200).json({ unreadCount: rows[0].unread_count });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/read-all", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (req.body !== undefined && (
      !req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Object.keys(req.body).length !== 0
    )) {
      return sendError(req, res, 400, "INVALID_NOTIFICATION_REQUEST", "This request does not accept notification data.");
    }
    try {
      const { rowCount } = await getPool().query(
        `UPDATE student_notifications
         SET is_read = true, read_at = COALESCE(read_at, now())
         WHERE user_id = $1 AND is_read = false`,
        [req.studentUserId],
      );
      return res.status(200).json({ updatedCount: rowCount });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:notificationId/read", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.notificationId)) {
      return sendError(req, res, 404, "NOTIFICATION_NOT_FOUND", "The requested notification was not found.");
    }
    if (req.body !== undefined && (
      !req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Object.keys(req.body).length !== 0
    )) {
      return sendError(req, res, 400, "INVALID_NOTIFICATION_REQUEST", "This request does not accept notification data.");
    }
    try {
      const { rows } = await getPool().query(
        `UPDATE student_notifications
         SET is_read = true, read_at = COALESCE(read_at, now())
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, message, source, category, is_read, read_at,
                   action_destination, created_at`,
        [req.params.notificationId, req.studentUserId],
      );
      if (!rows[0]) {
        return sendError(req, res, 404, "NOTIFICATION_NOT_FOUND", "The requested notification was not found.");
      }
      return res.status(200).json({ notification: mapNotification(rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:notificationId", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!hasValidStudentCsrfToken(req)) {
      return sendError(req, res, 403, "CSRF_INVALID", "Your request could not be verified. Please refresh and try again.");
    }
    if (!uuidPattern.test(req.params.notificationId)) {
      return sendError(req, res, 404, "NOTIFICATION_NOT_FOUND", "The requested notification was not found.");
    }
    try {
      const { rows } = await getPool().query(
        `DELETE FROM student_notifications
         WHERE id = $1 AND user_id = $2
         RETURNING id, is_read`,
        [req.params.notificationId, req.studentUserId],
      );
      if (!rows[0]) {
        return sendError(req, res, 404, "NOTIFICATION_NOT_FOUND", "The requested notification was not found.");
      }
      return res.status(200).json({ deletedId: rows[0].id, wasUnread: !rows[0].is_read });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
