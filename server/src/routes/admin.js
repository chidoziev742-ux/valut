import { Router } from "express";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidSessionCsrfToken, requireAdminSession } from "../middleware/requireStudentSession.js";
import { createEmailService } from "../services/email.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const emailBatchSize = 10;

async function updateCommunicationArchive({ req, res, next, getPool, archived }) {
  if (!hasValidSessionCsrfToken(req)) {
    return res.status(403).json({
      error: { code: "CSRF_VALIDATION_FAILED", message: "The request could not be validated. Please refresh the page and try again.", requestId: req.requestId },
    });
  }
  if (!uuidPattern.test(req.params.communicationId)) {
    return res.status(404).json({
      error: { code: "COMMUNICATION_NOT_FOUND", message: "The communication was not found.", requestId: req.requestId },
    });
  }

  let client;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, archived_at
       FROM admin_communications
       WHERE id = $1
       FOR UPDATE`,
      [req.params.communicationId],
    );
    const communication = currentResult.rows[0];
    if (!communication) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: { code: "COMMUNICATION_NOT_FOUND", message: "The communication was not found.", requestId: req.requestId },
      });
    }
    const isArchived = communication.archived_at !== null;
    if (isArchived === archived) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: {
          code: archived ? "COMMUNICATION_ALREADY_ARCHIVED" : "COMMUNICATION_ALREADY_ACTIVE",
          message: archived ? "The communication is already archived." : "The communication is already active.",
          requestId: req.requestId,
        },
      });
    }
    const updateResult = await client.query(
      `UPDATE admin_communications
       SET archived_at = $1
       WHERE id = $2
       RETURNING id, archived_at`,
      [archived ? new Date() : null, req.params.communicationId],
    );
    await client.query(
      `INSERT INTO admin_audit_log
        (admin_user_id, target_communication_id, action)
       VALUES ($1, $2, $3)`,
      [req.adminUserId, req.params.communicationId, archived ? "communication_archived" : "communication_restored"],
    );
    await client.query("COMMIT");
    return res.status(200).json({
      communication: {
        id: updateResult.rows[0].id,
        archivedAt: updateResult.rows[0].archived_at,
      },
    });
  } catch (error) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    return next(error);
  } finally {
    client?.release();
  }
}

function emailHtml(message) {
  return message
    .split("\n")
    .map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "&nbsp;"}</p>`)
    .join("");
}

async function claimEmailDeliveries(getPool, communicationId) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT d.communication_id, d.user_id, d.recipient_email, d.attempt_count,
              c.subject, c.message
       FROM admin_communication_email_deliveries d
       JOIN admin_communications c ON c.id = d.communication_id
       WHERE d.communication_id = $1
         AND (
           d.status = 'pending'
           OR (d.status = 'failed' AND d.updated_at <= now() - interval '1 minute')
           OR (d.status = 'sending' AND d.updated_at <= now() - interval '10 minutes')
         )
       ORDER BY d.updated_at, d.user_id
       FOR UPDATE OF d SKIP LOCKED
       LIMIT $2`,
      [communicationId, emailBatchSize],
    );
    if (!rows.length) {
      await client.query("COMMIT");
      return [];
    }
    const claimed = [];
    for (const row of rows) {
      await client.query(
        `UPDATE admin_communication_email_deliveries
         SET status = 'sending', attempt_count = attempt_count + 1,
             error_message = NULL, updated_at = now()
         WHERE communication_id = $1 AND user_id = $2`,
        [row.communication_id, row.user_id],
      );
      claimed.push({ ...row, attempt_count: row.attempt_count + 1 });
    }
    await client.query("COMMIT");
    return claimed;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve original error. */ }
    throw error;
  } finally {
    client.release();
  }
}

async function deliverEmailBatch({ getPool, emailService, communicationId }) {
  const deliveries = await claimEmailDeliveries(getPool, communicationId);
  if (!deliveries.length) return;
  for (const delivery of deliveries) {
    try {
      const result = await emailService.sendTransactionalEmail({
        to: delivery.recipient_email,
        subject: delivery.subject,
        htmlContent: emailHtml(delivery.message),
        textContent: delivery.message,
      });
      await getPool().query(
        `UPDATE admin_communication_email_deliveries
         SET status = 'sent', provider_message_id = $3, sent_at = now(), updated_at = now()
         WHERE communication_id = $1 AND user_id = $2 AND status = 'sending'`,
        [communicationId, delivery.user_id, result.messageId],
      );
    } catch (error) {
      await getPool().query(
        `UPDATE admin_communication_email_deliveries
         SET status = 'failed', error_message = $3, updated_at = now()
         WHERE communication_id = $1 AND user_id = $2 AND status = 'sending'`,
        [communicationId, delivery.user_id, error.code || "EMAIL_DELIVERY_FAILED"],
      );
    }
  }
  setImmediate(() => deliverEmailBatch({ getPool, emailService, communicationId }).catch(() => {}));
}

export function createAdminRouter({ getPool = defaultGetPool, emailService = createEmailService() } = {}) {
  const router = Router();
  router.use(requireAdminSession({ getPool }));

  router.get("/session", async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT id, email_normalized, role
         FROM users
         WHERE id = $1
           AND role = 'admin'
           AND status = 'active'
           AND email_verified_at IS NOT NULL`,
        [req.adminUserId],
      );
      const admin = rows[0];
      if (!admin) {
        return res.status(401).json({
          error: {
            code: "INVALID_SESSION",
            message: "Your session is invalid or has expired. Please log in again.",
            requestId: req.requestId,
          },
        });
      }

      return res.status(200).json({
        user: {
          id: admin.id,
          email: admin.email_normalized,
          role: admin.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/dashboard", async (req, res, next) => {
    try {
      const { rows } = await getPool().query(`
        WITH student_stats AS (
          SELECT
            count(*)::int AS total_students,
            count(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS verified_students,
            count(*) FILTER (WHERE status = 'active')::int AS active_students,
            count(*) FILTER (WHERE status = 'disabled')::int AS disabled_students
          FROM users
          WHERE role = 'student'
        ),
        document_stats AS (
          SELECT
            count(*)::int AS total_documents,
            COALESCE(sum(file_size), 0)::bigint AS total_storage_bytes
          FROM student_documents
        ),
        recent_registration_rows AS (
          SELECT u.id, u.email_normalized, u.created_at, sp.full_name
          FROM users u
          LEFT JOIN student_profiles sp ON sp.user_id = u.id
          WHERE u.role = 'student'
          ORDER BY u.created_at DESC, u.id DESC
          LIMIT 5
        )
        SELECT
          student_stats.total_students,
          student_stats.verified_students,
          student_stats.active_students,
          student_stats.disabled_students,
          document_stats.total_documents,
          document_stats.total_storage_bytes,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', recent.id,
                  'email', recent.email_normalized,
                  'fullName', recent.full_name,
                  'createdAt', recent.created_at
                )
                ORDER BY recent.created_at DESC, recent.id DESC
              )
              FROM recent_registration_rows recent
            ),
            '[]'::json
          ) AS recent_registrations
        FROM student_stats, document_stats
      `);
      const dashboard = rows[0] ?? {
        total_students: 0,
        verified_students: 0,
        active_students: 0,
        disabled_students: 0,
        total_documents: 0,
        total_storage_bytes: 0,
        recent_registrations: [],
      };

      return res.status(200).json({
        metrics: {
          totalStudents: dashboard.total_students,
          verifiedStudents: dashboard.verified_students,
          activeStudents: dashboard.active_students,
          disabledStudents: dashboard.disabled_students,
          totalDocuments: dashboard.total_documents,
          totalStorageBytes: dashboard.total_storage_bytes,
        },
        recentRegistrations: dashboard.recent_registrations,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/usage", async (req, res, next) => {
    try {
      const { rows } = await getPool().query(`
        WITH usage_totals AS (
          SELECT
            count(*)::int AS document_count,
            COALESCE(sum(d.file_size), 0)::bigint AS storage_bytes
          FROM student_documents d
          JOIN users u ON u.id = d.user_id AND u.role = 'student'
        ),
        document_type_rows AS (
          SELECT d.file_type, count(*)::int AS document_count
          FROM student_documents d
          JOIN users u ON u.id = d.user_id AND u.role = 'student'
          GROUP BY d.file_type
        ),
        registration_months AS (
          SELECT month_start
          FROM generate_series(
            date_trunc('month', now()) - interval '5 months',
            date_trunc('month', now()),
            interval '1 month'
          ) AS month_start
        ),
        registration_rows AS (
          SELECT
            registration_months.month_start,
            count(u.id)::int AS registration_count
          FROM registration_months
          LEFT JOIN users u
            ON u.role = 'student'
           AND u.created_at >= registration_months.month_start
           AND u.created_at < registration_months.month_start + interval '1 month'
          GROUP BY registration_months.month_start
        ),
        largest_storage_rows AS (
          SELECT
            d.user_id,
            COALESCE(sp.full_name, 'Student account') AS full_name,
            sum(d.file_size)::bigint AS storage_bytes,
            count(*)::int AS document_count
          FROM student_documents d
          JOIN users u ON u.id = d.user_id AND u.role = 'student'
          LEFT JOIN student_profiles sp ON sp.user_id = d.user_id
          GROUP BY d.user_id, sp.full_name
          ORDER BY storage_bytes DESC, d.user_id
          LIMIT $1
        ),
        recent_upload_rows AS (
          SELECT d.id, d.file_type, d.file_size, d.created_at
          FROM student_documents d
          JOIN users u ON u.id = d.user_id AND u.role = 'student'
          ORDER BY d.created_at DESC, d.id DESC
          LIMIT $2
        )
        SELECT
          usage_totals.document_count,
          usage_totals.storage_bytes,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', types.file_type,
                  'fileType', types.file_type,
                  'count', types.document_count
                )
                ORDER BY types.file_type
              )
              FROM document_type_rows types
            ),
            '[]'::json
          ) AS document_types,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'period', to_char(registrations.month_start, 'FMMonth YYYY'),
                  'month', to_char(registrations.month_start, 'FMMON'),
                  'count', registrations.registration_count
                )
                ORDER BY registrations.month_start
              )
              FROM registration_rows registrations
            ),
            '[]'::json
          ) AS registration_trend,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', largest.user_id,
                  'fullName', largest.full_name,
                  'storageBytes', largest.storage_bytes,
                  'documentCount', largest.document_count
                )
                ORDER BY largest.storage_bytes DESC, largest.user_id
              )
              FROM largest_storage_rows largest
            ),
            '[]'::json
          ) AS largest_students,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', recent.id,
                  'fileType', recent.file_type,
                  'fileSize', recent.file_size,
                  'createdAt', recent.created_at
                )
                ORDER BY recent.created_at DESC, recent.id DESC
              )
              FROM recent_upload_rows recent
            ),
            '[]'::json
          ) AS recent_uploads
        FROM usage_totals
      `, [5, 10]);
      const usage = rows[0] ?? {
        document_count: 0,
        storage_bytes: "0",
        document_types: [],
        registration_trend: [],
        largest_students: [],
        recent_uploads: [],
      };

      return res.status(200).json({
        totals: {
          documentCount: usage.document_count,
          storageBytes: usage.storage_bytes,
        },
        documentTypes: usage.document_types,
        registrationTrend: usage.registration_trend,
        largestStudents: usage.largest_students,
        recentUploads: usage.recent_uploads,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/students", async (req, res, next) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const verification = typeof req.query.verification === "string" ? req.query.verification : "";
    if (
      !Number.isInteger(page) || page < 1
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
      || search.length > 254
      || !["", "active", "disabled"].includes(status)
      || !["", "verified", "unverified"].includes(verification)
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_STUDENT_QUERY",
          message: "The student directory filters are invalid.",
          requestId: req.requestId,
        },
      });
    }

    const values = [pageSize, (page - 1) * pageSize];
    const filters = ["u.role = 'student'"];
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      filters.push(`(lower(COALESCE(sp.full_name, '')) LIKE $${values.length} OR u.email_normalized LIKE $${values.length})`);
    }
    if (status) {
      values.push(status);
      filters.push(`u.status = $${values.length}`);
    }
    if (verification === "verified") filters.push("u.email_verified_at IS NOT NULL");
    if (verification === "unverified") filters.push("u.email_verified_at IS NULL");

    try {
      const { rows } = await getPool().query(`
        SELECT
          u.id,
          COALESCE(sp.full_name, 'Student account') AS full_name,
          u.email_normalized,
          u.status,
          u.email_verified_at IS NOT NULL AS email_verified,
          u.created_at,
          sp.university,
          sp.programme,
          sp.study_year
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE ${filters.join(" AND ")}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT $1 OFFSET $2
      `, values);
      const countValues = values.slice(2);
      const countFilters = filters.map((filter) => filter
        .replace(/\$3/g, "$1")
        .replace(/\$4/g, "$2")
        .replace(/\$5/g, "$3"));
      const countResult = await getPool().query(
        `SELECT count(*)::int AS total
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE ${countFilters.join(" AND ")}`,
        countValues,
      );
      return res.status(200).json({
        page,
        pageSize,
        total: countResult.rows[0]?.total ?? 0,
        students: rows.map((student) => ({
          id: student.id,
          name: student.full_name,
          email: student.email_normalized,
          status: student.status,
          emailVerified: student.email_verified,
          joined: student.created_at,
          university: student.university,
          programme: student.programme,
          academicLevel: student.study_year,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/students/:studentId", async (req, res, next) => {
    try {
      const { rows } = await getPool().query(`
        SELECT
          u.id, u.email_normalized, u.status, u.email_verified_at, u.created_at,
          sp.full_name, sp.university, sp.faculty, sp.department, sp.programme, sp.study_year, sp.academic_session,
          (SELECT count(*)::int FROM student_documents d WHERE d.user_id = u.id) AS document_count,
          (SELECT COALESCE(sum(d.file_size), 0)::bigint FROM student_documents d WHERE d.user_id = u.id) AS storage_bytes,
          (SELECT count(*)::int FROM student_academic_records ar WHERE ar.user_id = u.id) AS academic_record_count
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = $1 AND u.role = 'student'
      `, [req.params.studentId]);
      const student = rows[0];
      if (!student) {
        return res.status(404).json({
          error: { code: "STUDENT_NOT_FOUND", message: "The student account was not found.", requestId: req.requestId },
        });
      }
      return res.status(200).json({
        student: {
          id: student.id,
          email: student.email_normalized,
          name: student.full_name ?? "Student account",
          status: student.status,
          emailVerified: Boolean(student.email_verified_at),
          joined: student.created_at,
          university: student.university,
          faculty: student.faculty,
          department: student.department,
          programme: student.programme,
          academicLevel: student.study_year,
          academicSession: student.academic_session,
          documentCount: student.document_count,
          storageBytes: student.storage_bytes,
          academicRecordCount: student.academic_record_count,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/students/:studentId/status", async (req, res, next) => {
    if (!hasValidSessionCsrfToken(req)) {
      return res.status(403).json({
        error: { code: "CSRF_VALIDATION_FAILED", message: "The request could not be validated. Please refresh the page and try again.", requestId: req.requestId },
      });
    }
    const nextStatus = req.body?.status;
    if (nextStatus !== "active" && nextStatus !== "disabled") {
      return res.status(400).json({
        error: { code: "INVALID_ACCOUNT_STATUS", message: "A valid account status is required.", requestId: req.requestId },
      });
    }

    let client;
    try {
      client = await getPool().connect();
      await client.query("BEGIN");
      const currentResult = await client.query(
        `SELECT id, status
         FROM users
         WHERE id = $1 AND role = 'student'
         FOR UPDATE`,
        [req.params.studentId],
      );
      const currentStudent = currentResult.rows[0];
      if (!currentStudent) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: { code: "STUDENT_NOT_FOUND", message: "The student account was not found.", requestId: req.requestId },
        });
      }
      const result = await client.query(
        `UPDATE users
         SET status = $1
         WHERE id = $2 AND role = 'student'
         RETURNING id, status AS next_status`,
        [nextStatus, req.params.studentId],
      );
      const student = result.rows[0];
      await client.query(
        `INSERT INTO admin_audit_log
          (admin_user_id, target_user_id, action, previous_status, next_status)
         VALUES ($1, $2, 'student_status_changed', $3, $4)`,
        [req.adminUserId, student.id, currentStudent.status, student.next_status],
      );
      await client.query("COMMIT");
      return res.status(200).json({ student: { id: student.id, status: student.next_status } });
    } catch (error) {
      try {
        if (client) await client.query("ROLLBACK");
      } catch {
        // Preserve the original database error.
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  router.get("/communications", async (req, res, next) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const archiveFilter = req.query.archive ?? "active";
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || search.length > 120 || !["active", "archived", "all"].includes(archiveFilter)) {
      return res.status(400).json({
        error: { code: "INVALID_COMMUNICATION_QUERY", message: "The communication history filters are invalid.", requestId: req.requestId },
      });
    }

    const values = [pageSize, (page - 1) * pageSize];
    const filters = [];
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      filters.push(`(lower(c.subject) LIKE $${values.length} OR lower(c.message) LIKE $${values.length})`);
    }
    if (archiveFilter === "active") filters.push("c.archived_at IS NULL");
    if (archiveFilter === "archived") filters.push("c.archived_at IS NOT NULL");
    try {
      const { rows } = await getPool().query(`
        SELECT c.id, c.subject, c.message, c.recipient_mode, c.recipient_count, c.channel, c.created_at, c.archived_at,
               COALESCE((
                 SELECT count(*) FILTER (WHERE d.status = 'sent')
                 FROM admin_communication_email_deliveries d
                 WHERE d.communication_id = c.id
               ), 0)::int AS emails_sent,
               COALESCE((
                 SELECT count(*) FILTER (WHERE d.status = 'failed')
                 FROM admin_communication_email_deliveries d
                 WHERE d.communication_id = c.id
               ), 0)::int AS emails_failed
        FROM admin_communications c
        ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT $1 OFFSET $2
      `, values);
      const countValues = values.slice(2);
      const countResult = await getPool().query(
        `SELECT count(*)::int AS total FROM admin_communications c${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}`,
        countValues,
      );
      return res.status(200).json({
        page,
        pageSize,
        total: countResult.rows[0]?.total ?? 0,
        communications: rows.map((row) => ({
          id: row.id,
          subject: row.subject,
          message: row.message,
          recipients: row.recipient_mode === "all" ? "All students" : `${row.recipient_count} selected students`,
          recipientCount: row.recipient_count,
          status: row.channel === "in_app"
            ? "Sent"
            : row.emails_failed > 0
              ? "Email issues"
              : row.channel === "both" && row.emails_sent < row.recipient_count
                ? "Email queued"
                : "Sent",
          channels: row.channel === "both"
            ? ["In-app notification", "Email"]
            : row.channel === "email"
              ? ["Email"]
              : ["In-app notification"],
          emailDelivery: row.channel === "in_app"
            ? null
            : { sent: row.emails_sent, failed: row.emails_failed, pending: row.recipient_count - row.emails_sent - row.emails_failed },
          createdAt: row.created_at,
          archivedAt: row.archived_at,
        })),
      });

    } catch (error) {
      return next(error);
    }
  });

  router.patch("/communications/:communicationId/archive", async (req, res, next) => {
    return updateCommunicationArchive({ req, res, next, getPool, archived: true });
  });

  router.patch("/communications/:communicationId/restore", async (req, res, next) => {
    return updateCommunicationArchive({ req, res, next, getPool, archived: false });
  });

  router.post("/communications/:communicationId/email-retry", async (req, res, next) => {
    if (!hasValidSessionCsrfToken(req)) {
      return res.status(403).json({
        error: { code: "CSRF_VALIDATION_FAILED", message: "The request could not be validated. Please refresh the page and try again.", requestId: req.requestId },
      });
    }
    if (!uuidPattern.test(req.params.communicationId)) {
      return res.status(404).json({
        error: { code: "COMMUNICATION_NOT_FOUND", message: "The communication was not found.", requestId: req.requestId },
      });
    }
    try {
      const { rows } = await getPool().query(
        `SELECT id
         FROM admin_communications
         WHERE id = $1 AND channel IN ('email', 'both')`,
        [req.params.communicationId],
      );
      if (!rows[0]) {
        return res.status(404).json({
          error: { code: "COMMUNICATION_NOT_FOUND", message: "The communication was not found.", requestId: req.requestId },
        });
      }
      setImmediate(() => deliverEmailBatch({
        getPool,
        emailService,
        communicationId: req.params.communicationId,
      }).catch(() => {}));
      return res.status(202).json({ communication: { id: req.params.communicationId, status: "Email retry queued" } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/communications", async (req, res, next) => {
    if (!hasValidSessionCsrfToken(req)) {
      return res.status(403).json({
        error: { code: "CSRF_VALIDATION_FAILED", message: "The request could not be validated. Please refresh the page and try again.", requestId: req.requestId },
      });
    }
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const recipientMode = req.body?.recipientMode;
    const channel = req.body?.channel ?? "in_app";
    const requestedIds = Array.isArray(req.body?.recipientIds) ? [...new Set(req.body.recipientIds)] : [];
    if (
      !subject || subject.length > 120 || !message || message.length > 2000
      || !["all", "selected"].includes(recipientMode)
      || !["in_app", "email", "both"].includes(channel)
      || (recipientMode === "selected" && (!requestedIds.length || requestedIds.length > 500 || requestedIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))))
    ) {
      return res.status(400).json({
        error: { code: "INVALID_COMMUNICATION", message: "Provide a subject, message and valid recipients.", requestId: req.requestId },
      });
    }

    let client;
    try {
      client = await getPool().connect();
      await client.query("BEGIN");
      const recipientColumns = channel === "in_app" ? "id" : "id, email_normalized";
      const recipientQuery = recipientMode === "all"
        ? `SELECT ${recipientColumns} FROM users WHERE role = 'student' AND status = 'active'`
        : `SELECT ${recipientColumns} FROM users WHERE role = 'student' AND status = 'active' AND id = ANY($1::uuid[])`;
      const recipientResult = await client.query(recipientQuery, recipientMode === "all" ? [] : [requestedIds]);
      if (!recipientResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: { code: "NO_COMMUNICATION_RECIPIENTS", message: "There are no active student recipients.", requestId: req.requestId },
        });
      }
      const recipientIds = recipientResult.rows.map((row) => row.id);
      const communicationResult = await client.query(
        `INSERT INTO admin_communications (admin_user_id, subject, message, recipient_mode, recipient_count, channel)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [req.adminUserId, subject, message, recipientMode, recipientIds.length, channel],
      );
      const communicationId = communicationResult.rows[0].id;
      for (const recipient of recipientResult.rows) {
        const recipientId = recipient.id;
        await client.query(
          `INSERT INTO admin_communication_recipients (communication_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [communicationId, recipientId],
        );
        await client.query(
          `INSERT INTO student_notifications
             (user_id, title, message, source, category, event_key)
           VALUES ($1, $2, $3, 'admin', 'announcement', $4)
           ON CONFLICT (user_id, event_key) DO NOTHING`,
          [recipientId, subject, message, communicationId],
        );
        if (channel !== "in_app") {
          await client.query(
            `INSERT INTO admin_communication_email_deliveries
               (communication_id, user_id, recipient_email)
             VALUES ($1, $2, $3)
             ON CONFLICT (communication_id, user_id) DO NOTHING`,
            [communicationId, recipientId, recipient.email_normalized],
          );
        }
      }
      await client.query("COMMIT");
      if (channel !== "in_app") {
        setImmediate(() => deliverEmailBatch({ getPool, emailService, communicationId }).catch(() => {}));
      }
      return res.status(201).json({
        communication: {
          id: communicationId,
          recipientCount: recipientIds.length,
          status: channel === "in_app" ? "Sent" : "Email queued",
        },
      });
    } catch (error) {
      try {
        if (client) await client.query("ROLLBACK");
      } catch {
        // Preserve the original database error.
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}
