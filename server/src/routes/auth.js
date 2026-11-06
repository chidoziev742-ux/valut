import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { hashPassword, performDummyPasswordCheck, verifyPassword } from "../auth/password.js";
import { config } from "../config.js";
import { getPool as defaultGetPool } from "../db/pool.js";
import { hasValidStudentCsrfToken, requireStudentSession } from "../middleware/requireStudentSession.js";
import { createEmailService } from "../services/email.js";

const maximumPasswordBytes = 1024;
const passwordResetTokenLifetimeMs = 30 * 60 * 1000;
const emailVerificationTokenLifetimeMs = 24 * 60 * 60 * 1000;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const refreshCookieName = "vaultori_refresh";
const refreshCookiePath = "/api";
const csrfTokenHeader = "x-csrf-token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidPasswordResetToken = Symbol("invalid-password-reset-token");
const invalidEmailVerificationToken = Symbol("invalid-email-verification-token");
const invalidPasswordChangeSession = Symbol("invalid-password-change-session");
const incorrectCurrentPassword = Symbol("incorrect-current-password");
const registrationSqlStates = new Set([
  "08000",
  "08003",
  "08006",
  "23502",
  "23503",
  "23505",
  "23514",
  "25P02",
  "40001",
  "42501",
  "42P01",
  "42703",
]);
const registrationEmailErrorCodes = new Set([
  "EMAIL_NOT_CONFIGURED",
  "EMAIL_PROVIDER_UNAVAILABLE",
  "EMAIL_PROVIDER_REJECTED",
  "EMAIL_PROVIDER_INVALID_RESPONSE",
  "INVALID_EMAIL_MESSAGE",
]);

function logRegistrationStage(req, stage, event, code) {
  const entry = {
    level: event === "failed" ? "error" : "info",
    requestId: req.requestId,
    stage,
    event,
    ...(code ? { code } : {}),
  };
  const writeLog = event === "failed" ? console.error : console.info;
  writeLog(JSON.stringify(entry));
}

function createEmailVerificationUrl(frontendUrl, token) {
  const url = new URL("/verify", frontendUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function createPasswordResetUrl(frontendUrl, token) {
  const url = new URL("/reset-password", frontendUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function createVerificationEmail(to, verificationUrl, fullName = "there") {
  const safeName = escapeHtml(fullName);
  return {
    to,
    subject: "Verify your Vaultori email address",
    htmlContent: `<p>Hello ${safeName},</p><p>Verify your email address by <a href="${verificationUrl}">opening this link</a>. This link expires in 24 hours.</p>`,
    textContent: `Hello ${fullName},\n\nVerify your email address using this link: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  };
}

function createPasswordResetEmail(to, resetUrl) {
  return {
    to,
    subject: "Reset your Vaultori password",
    htmlContent: `<p>We received a request to reset the password for your Vaultori account.</p><p><a href="${resetUrl}">Choose a new password</a>. This link expires in 30 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
    textContent: `We received a request to reset the password for your Vaultori account.\n\nChoose a new password using this link: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`,
  };
}

function sendInvalidEmailVerificationToken(req, res) {
  return res.status(400).json({
    error: {
      code: "INVALID_VERIFICATION_TOKEN",
      message: "The email verification token is invalid or expired.",
      requestId: req.requestId,
    },
  });
}

function sendInvalidPasswordResetToken(req, res) {
  return res.status(400).json({
    error: {
      code: "INVALID_RESET_TOKEN",
      message: "The password reset token is invalid or expired.",
      requestId: req.requestId,
    },
  });
}

function getRefreshToken(req) {
  const cookies = (req.headers.cookie ?? "").split(";").map((cookie) => cookie.trim());
  const matchingCookies = cookies.filter((cookie) => cookie.startsWith(`${refreshCookieName}=`));
  if (matchingCookies.length !== 1) return null;

  const token = matchingCookies[0].slice(refreshCookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function createCsrfToken(refreshToken) {
  return createHmac("sha256", refreshToken)
    .update("vaultori-csrf-v1")
    .digest("base64url");
}

function hasTrustedOrigin(req) {
  const origin = req.get("origin");
  return !origin || origin === config.frontendOrigin;
}

function hasValidCsrfToken(req, refreshToken) {
  if (!refreshToken || !hasTrustedOrigin(req)) return false;
  const provided = req.get(csrfTokenHeader);
  if (typeof provided !== "string") return false;

  const expectedBuffer = Buffer.from(createCsrfToken(refreshToken));
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  res.cookie(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: refreshCookiePath,
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: refreshCookiePath,
  });
}

function sendInvalidSession(req, res) {
  clearRefreshCookie(res);
  return res.status(401).json({
    error: {
      code: "INVALID_SESSION",
      message: "Your session is invalid or has expired. Please log in again.",
      requestId: req.requestId,
    },
  });
}

function sendCsrfError(req, res) {
  return res.status(403).json({
    error: {
      code: "CSRF_VALIDATION_FAILED",
      message: "The request could not be validated. Please refresh the page and try again.",
      requestId: req.requestId,
    },
  });
}

function sendValidationError(req, res, message) {
  res.status(400).json({
    error: {
      code: "INVALID_REGISTRATION",
      message,
      requestId: req.requestId,
    },
  });
}

export function createAuthRouter({
  getPool = defaultGetPool,
  generatePasswordResetToken = () => randomBytes(32).toString("base64url"),
  generateEmailVerificationToken = () => randomBytes(32).toString("base64url"),
  emailService = createEmailService(),
  frontendUrl = config.frontendUrl,
} = {}) {
  const router = Router();

  router.post(
    "/change-password",
    requireStudentSession({ getPool }),
    async (req, res, next) => {
      res.set("Cache-Control", "no-store");
      if (!hasValidStudentCsrfToken(req)) {
        return sendCsrfError(req, res);
      }

      const body = req.body;
      const allowedFields = new Set(["currentPassword", "newPassword", "confirmPassword"]);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((field) => !allowedFields.has(field)) ||
        typeof body.currentPassword !== "string" ||
        typeof body.newPassword !== "string" ||
        typeof body.confirmPassword !== "string"
      ) {
        return res.status(400).json({
          error: {
            code: "INVALID_PASSWORD_CHANGE",
            message: "Current password, new password, and confirmation are required.",
            requestId: req.requestId,
          },
        });
      }

      const currentPasswordBytes = Buffer.byteLength(body.currentPassword, "utf8");
      const newPasswordBytes = Buffer.byteLength(body.newPassword, "utf8");
      if (
        currentPasswordBytes === 0 ||
        currentPasswordBytes > maximumPasswordBytes ||
        !body.newPassword.trim() ||
        newPasswordBytes < 8 ||
        newPasswordBytes > maximumPasswordBytes
      ) {
        return res.status(400).json({
          error: {
            code: "INVALID_PASSWORD_CHANGE",
            message: "Passwords must contain valid text and the new password must be 8–1024 bytes.",
            requestId: req.requestId,
          },
        });
      }

      if (body.newPassword !== body.confirmPassword) {
        return res.status(400).json({
          error: {
            code: "PASSWORD_CONFIRMATION_MISMATCH",
            message: "The new password and confirmation do not match.",
            requestId: req.requestId,
          },
        });
      }
      if (body.newPassword === body.currentPassword) {
        return res.status(400).json({
          error: {
            code: "PASSWORD_UNCHANGED",
            message: "Choose a new password that differs from your current password.",
            requestId: req.requestId,
          },
        });
      }

      const refreshToken = getRefreshToken(req);
      if (!refreshToken) return sendInvalidSession(req, res);

      let client;
      let transactionStarted = false;
      let releaseError;
      let operationError;
      try {
        client = await getPool().connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const userResult = await client.query(
          `SELECT password_hash
           FROM users
           WHERE id = $1
             AND role = 'student'
             AND status = 'active'
             AND email_verified_at IS NOT NULL
           FOR UPDATE`,
          [req.studentUserId],
        );
        const user = userResult.rows[0];
        if (!user) throw invalidPasswordChangeSession;

        const sessionResult = await client.query(
          `SELECT id
           FROM auth_sessions
           WHERE id = $1
             AND user_id = $2
             AND refresh_token_hash = $3
             AND revoked_at IS NULL
             AND expires_at > clock_timestamp()
           FOR UPDATE`,
          [
            req.studentSessionId,
            req.studentUserId,
            createHash("sha256").update(refreshToken).digest("hex"),
          ],
        );
        const currentSession = sessionResult.rows[0];
        if (!currentSession) throw invalidPasswordChangeSession;
        if (!await verifyPassword(body.currentPassword, user.password_hash)) {
          throw incorrectCurrentPassword;
        }

        const newPasswordHash = await hashPassword(body.newPassword);
        await client.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [newPasswordHash, req.studentUserId],
        );
        await client.query(
          `UPDATE auth_sessions
           SET revoked_at = now()
           WHERE user_id = $1
             AND id <> $2
             AND revoked_at IS NULL
             AND expires_at > clock_timestamp()`,
          [req.studentUserId, req.studentSessionId],
        );

        const stillActiveResult = await client.query(
          `UPDATE auth_sessions
           SET last_used_at = now()
           WHERE id = $1
             AND user_id = $2
             AND refresh_token_hash = $3
             AND revoked_at IS NULL
             AND expires_at > clock_timestamp()
           RETURNING id`,
          [
            req.studentSessionId,
            req.studentUserId,
            createHash("sha256").update(refreshToken).digest("hex"),
          ],
        );
        if (!stillActiveResult.rows[0]) throw invalidPasswordChangeSession;

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
            transactionStarted = false;
          } catch (rollbackError) {
            releaseError = rollbackError;
            operationError = rollbackError;
          }
        }
        operationError ??= error;
      } finally {
        if (client) client.release(releaseError);
      }

      if (operationError === invalidPasswordChangeSession) return sendInvalidSession(req, res);
      if (operationError === incorrectCurrentPassword) {
        return res.status(403).json({
          error: {
            code: "INCORRECT_CURRENT_PASSWORD",
            message: "The current password is incorrect.",
            requestId: req.requestId,
          },
        });
      }
      if (operationError) return next(operationError);

      return res.status(200).json({ message: "Your password has been updated successfully." });
    },
  );

  router.post("/forgot-password", async (req, res, next) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.email !== "string"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PASSWORD_RESET_REQUEST",
          message: "A valid email address is required.",
          requestId: req.requestId,
        },
      });
    }

    const email = body.email.trim().toLowerCase();
    if (!email || email.length > 254 || !emailPattern.test(email)) {
      return res.status(400).json({
        error: {
          code: "INVALID_PASSWORD_RESET_REQUEST",
          message: "A valid email address is required.",
          requestId: req.requestId,
        },
      });
    }

    let emailDeliveryFailed = false;
    try {
      const token = generatePasswordResetToken();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + passwordResetTokenLifetimeMs);
      const client = await getPool().connect();
      let transactionStarted = false;
      let releaseError;

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        const userResult = await client.query(
          "SELECT id FROM users WHERE email_normalized = $1 FOR UPDATE",
          [email],
        );
        const userId = userResult.rows[0]?.id;

        if (userId) {
          await client.query(
            `UPDATE password_reset_tokens
             SET invalidated_at = now()
             WHERE user_id = $1
               AND used_at IS NULL
               AND invalidated_at IS NULL`,
            [userId],
          );
          await client.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userId, tokenHash, expiresAt],
          );
          try {
            await emailService.sendTransactionalEmail(
              createPasswordResetEmail(email, createPasswordResetUrl(frontendUrl, token)),
            );
          } catch {
            emailDeliveryFailed = true;
            throw new Error("Password reset email delivery failed.");
          }
        }

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            releaseError = rollbackError;
          }
        }
        throw error;
      } finally {
        client.release(releaseError);
      }

      return res.status(202).json({
        message: "If an account exists for this email, the password reset request has been accepted.",
        requestId: req.requestId,
      });
    } catch (error) {
      if (emailDeliveryFailed) {
        return res.status(202).json({
          message: "If an account exists for this email, the password reset request has been accepted.",
          requestId: req.requestId,
        });
      }
      return next(error);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.token !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PASSWORD_RESET_REQUEST",
          message: "A reset token and a valid new password are required.",
          requestId: req.requestId,
        },
      });
    }

    const tokenBytes = Buffer.byteLength(body.token, "utf8");
    const passwordBytes = Buffer.byteLength(body.newPassword, "utf8");
    if (
      tokenBytes === 0 ||
      tokenBytes > 512 ||
      !body.newPassword.trim() ||
      passwordBytes < 8 ||
      passwordBytes > maximumPasswordBytes
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PASSWORD_RESET_REQUEST",
          message: "A reset token and a valid new password are required.",
          requestId: req.requestId,
        },
      });
    }

    try {
      const pool = getPool();
      const tokenHash = createHash("sha256").update(body.token).digest("hex");
      const candidateResult = await pool.query(
        `SELECT user_id
         FROM password_reset_tokens
         WHERE token_hash = $1
           AND used_at IS NULL
           AND invalidated_at IS NULL
           AND expires_at > clock_timestamp()`,
        [tokenHash],
      );
      const candidateUserId = candidateResult.rows[0]?.user_id;
      if (!candidateUserId) {
        return sendInvalidPasswordResetToken(req, res);
      }

      const passwordHash = await hashPassword(body.newPassword);
      const client = await pool.connect();
      let transactionStarted = false;
      let releaseError;

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        const userResult = await client.query(
          "SELECT id FROM users WHERE id = $1 FOR UPDATE",
          [candidateUserId],
        );
        if (!userResult.rows[0]) {
          throw invalidPasswordResetToken;
        }

        const tokenResult = await client.query(
          `SELECT id, user_id
           FROM password_reset_tokens
           WHERE token_hash = $1
             AND user_id = $2
             AND used_at IS NULL
             AND invalidated_at IS NULL
             AND expires_at > clock_timestamp()
           FOR UPDATE`,
          [tokenHash, candidateUserId],
        );
        const resetToken = tokenResult.rows[0];
        if (!resetToken) {
          throw invalidPasswordResetToken;
        }

        await client.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [passwordHash, resetToken.user_id],
        );
        await client.query(
          "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1",
          [resetToken.id],
        );
        await client.query(
          `UPDATE password_reset_tokens
           SET invalidated_at = now()
           WHERE user_id = $1
             AND id <> $2
             AND used_at IS NULL
             AND invalidated_at IS NULL`,
          [resetToken.user_id, resetToken.id],
        );
        await client.query(
          `UPDATE auth_sessions
           SET revoked_at = now()
           WHERE user_id = $1
             AND revoked_at IS NULL`,
          [resetToken.user_id],
        );

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            releaseError = rollbackError;
          }
        }
        throw error;
      } finally {
        client.release(releaseError);
      }

      return res.status(200).json({
        message: "Password has been reset successfully.",
        requestId: req.requestId,
      });
    } catch (error) {
      if (error === invalidPasswordResetToken) {
        return sendInvalidPasswordResetToken(req, res);
      }
      return next(error);
    }
  });

  router.post("/verify-email", async (req, res, next) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.token !== "string" ||
      Buffer.byteLength(body.token, "utf8") === 0 ||
      Buffer.byteLength(body.token, "utf8") > 512
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_VERIFICATION_REQUEST",
          message: "A valid verification token is required.",
          requestId: req.requestId,
        },
      });
    }

    try {
      const pool = getPool();
      const tokenHash = createHash("sha256").update(body.token).digest("hex");
      const candidateResult = await pool.query(
        `SELECT user_id
         FROM email_verification_tokens
         WHERE token_hash = $1
           AND used_at IS NULL
           AND invalidated_at IS NULL
           AND expires_at > clock_timestamp()`,
        [tokenHash],
      );
      const candidateUserId = candidateResult.rows[0]?.user_id;
      if (!candidateUserId) {
        return sendInvalidEmailVerificationToken(req, res);
      }

      const client = await pool.connect();
      let transactionStarted = false;
      let releaseError;

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        const userResult = await client.query(
          "SELECT id, email_verified_at FROM users WHERE id = $1 FOR UPDATE",
          [candidateUserId],
        );
        if (!userResult.rows[0]) {
          throw invalidEmailVerificationToken;
        }

        const tokenResult = await client.query(
          `SELECT id, user_id
           FROM email_verification_tokens
           WHERE token_hash = $1
             AND user_id = $2
             AND used_at IS NULL
             AND invalidated_at IS NULL
             AND expires_at > clock_timestamp()
           FOR UPDATE`,
          [tokenHash, candidateUserId],
        );
        const verificationToken = tokenResult.rows[0];
        if (!verificationToken) {
          throw invalidEmailVerificationToken;
        }

        await client.query(
          "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
          [verificationToken.user_id],
        );
        await client.query(
          "UPDATE email_verification_tokens SET used_at = now() WHERE id = $1",
          [verificationToken.id],
        );
        await client.query("COMMIT");
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            releaseError = rollbackError;
          }
        }
        throw error;
      } finally {
        client.release(releaseError);
      }

      return res.status(200).json({
        message: "Email verified successfully.",
        requestId: req.requestId,
      });
    } catch (error) {
      if (error === invalidEmailVerificationToken) {
        return sendInvalidEmailVerificationToken(req, res);
      }
      return next(error);
    }
  });

  router.post("/resend-verification", async (req, res, next) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.email !== "string"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_VERIFICATION_REQUEST",
          message: "A valid email address is required.",
          requestId: req.requestId,
        },
      });
    }

    const email = body.email.trim().toLowerCase();
    if (!email || email.length > 254 || !emailPattern.test(email)) {
      return res.status(400).json({
        error: {
          code: "INVALID_VERIFICATION_REQUEST",
          message: "A valid email address is required.",
          requestId: req.requestId,
        },
      });
    }

    try {
      const token = generateEmailVerificationToken();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + emailVerificationTokenLifetimeMs);
      const client = await getPool().connect();
      let transactionStarted = false;
      let releaseError;

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        const userResult = await client.query(
          `SELECT id, email_normalized
           FROM users
           WHERE email_normalized = $1
             AND status = 'active'
             AND email_verified_at IS NULL
           FOR UPDATE`,
          [email],
        );
        const user = userResult.rows[0];

        if (user) {
          await client.query(
            `UPDATE email_verification_tokens
             SET invalidated_at = now()
             WHERE user_id = $1
               AND used_at IS NULL
               AND invalidated_at IS NULL`,
            [user.id],
          );
          await client.query(
            `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt],
          );
          await emailService.sendTransactionalEmail(
            createVerificationEmail(
              user.email_normalized,
              createEmailVerificationUrl(frontendUrl, token),
            ),
          );
        }

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            releaseError = rollbackError;
          }
        }
        throw error;
      } finally {
        client.release(releaseError);
      }

      return res.status(202).json({
        message: "If an unverified account exists for this email, a verification message has been sent.",
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/register", async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendValidationError(req, res, "A JSON object with fullName, email, and password is required.");
    }

    if (
      typeof body.fullName !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return sendValidationError(req, res, "Full name, email, and password are required.");
    }

    const fullName = body.fullName.trim();
    const email = body.email.trim().toLowerCase();
    const passwordBytes = Buffer.byteLength(body.password, "utf8");

    if (!fullName || fullName.length > 120) {
      return sendValidationError(req, res, "Full name must be between 1 and 120 characters.");
    }
    if (email.length > 254 || !emailPattern.test(email)) {
      return sendValidationError(req, res, "A valid email address is required.");
    }
    if (!body.password.trim() || passwordBytes < 8 || passwordBytes > maximumPasswordBytes) {
      return sendValidationError(req, res, "Password must be between 8 and 1024 UTF-8 bytes.");
    }

    try {
      const passwordHash = await hashPassword(body.password);
      const verificationToken = generateEmailVerificationToken();
      const verificationTokenHash = createHash("sha256")
        .update(verificationToken)
        .digest("hex");
      const verificationExpiresAt = new Date(Date.now() + emailVerificationTokenLifetimeMs);
      const verificationUrl = createEmailVerificationUrl(frontendUrl, verificationToken);
      const client = await getPool().connect();
      let transactionStarted = false;
      let releaseError;
      let user;
      let registrationStage = "transaction_begin";

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        registrationStage = "user_insert";
        logRegistrationStage(req, registrationStage, "started");
        const insertUser = await client.query(
          `INSERT INTO users (email_normalized, password_hash, role)
           VALUES ($1, $2, 'student')
           RETURNING id, email_normalized`,
          [email, passwordHash],
        );
        user = insertUser.rows[0];
        logRegistrationStage(req, registrationStage, "completed");

        registrationStage = "student_profile_insert";
        logRegistrationStage(req, registrationStage, "started");
        await client.query(
          "INSERT INTO student_profiles (user_id, full_name) VALUES ($1, $2)",
          [user.id, fullName],
        );
        logRegistrationStage(req, registrationStage, "completed");

        registrationStage = "welcome_notification_insert";
        logRegistrationStage(req, registrationStage, "started");
        await client.query(
          `INSERT INTO student_notifications (
             user_id, title, message, source, category, action_destination, event_key
           )
           VALUES ($1, $2, $3, 'system', 'welcome', '/settings#account-info', 'student_welcome_v1')
           ON CONFLICT (user_id, event_key) DO NOTHING`,
          [
            user.id,
            "Welcome to Vaultori",
            "You can visit Profile Settings to add your university, faculty, department, programme and academic information. Completing this optional profile information is encouraged, but it is not compulsory.",
          ],
        );
        logRegistrationStage(req, registrationStage, "completed");

        registrationStage = "verification_token_insert";
        logRegistrationStage(req, registrationStage, "started");
        await client.query(
          `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, verificationTokenHash, verificationExpiresAt],
        );
        logRegistrationStage(req, registrationStage, "completed");

        registrationStage = "brevo_email_delivery";
        logRegistrationStage(req, registrationStage, "started");
        await emailService.sendTransactionalEmail(
          createVerificationEmail(email, verificationUrl, fullName),
        );
        logRegistrationStage(req, registrationStage, "completed");

        registrationStage = "transaction_commit";
        logRegistrationStage(req, registrationStage, "started");
        await client.query("COMMIT");
        transactionStarted = false;
        logRegistrationStage(req, registrationStage, "completed");
      } catch (error) {
        if (registrationStage === "brevo_email_delivery") {
          const code = registrationEmailErrorCodes.has(error?.code)
            ? error.code
            : "EMAIL_DELIVERY_FAILED";
          logRegistrationStage(req, registrationStage, "failed", code);
        } else if (registrationStage !== "transaction_begin") {
          const code = registrationSqlStates.has(error?.code)
            ? error.code
            : "DATABASE_ERROR";
          logRegistrationStage(req, registrationStage, "failed", code);
        }
        if (transactionStarted) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            releaseError = rollbackError;
          }
        }
        throw error;
      } finally {
        client.release(releaseError);
      }

      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email_normalized,
          fullName,
          role: "student",
        },
      });
    } catch (error) {
      if (error?.code === "23505" && error?.constraint === "users_email_normalized_unique") {
        return res.status(409).json({
          error: {
            code: "EMAIL_ALREADY_REGISTERED",
            message: "An account with this email already exists.",
            requestId: req.requestId,
          },
        });
      }
      return next(error);
    }
  });

  router.post(["/login", "/admin/login"], async (req, res, next) => {
    const adminLogin = req.path === "/admin/login";
    res.set("Cache-Control", "no-store");
    if (!hasTrustedOrigin(req)) return sendCsrfError(req, res);
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_LOGIN",
          message: "Email and password are required.",
          requestId: req.requestId,
        },
      });
    }

    const email = body.email.trim().toLowerCase();
    const passwordBytes = Buffer.byteLength(body.password, "utf8");
    if (
      !email ||
      email.length > 254 ||
      !emailPattern.test(email) ||
      passwordBytes === 0 ||
      passwordBytes > maximumPasswordBytes
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_LOGIN",
          message: "A valid email and password are required.",
          requestId: req.requestId,
        },
      });
    }

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT id, email_normalized, password_hash, role, status, email_verified_at
         FROM users
         WHERE email_normalized = $1${adminLogin ? "\n           AND role = 'admin'" : ""}`,
        [email],
      );
      const user = rows[0];
      const activeUser = user?.status === "active"
        && (!adminLogin || user?.role === "admin");
      let passwordMatches = false;
      if (activeUser) {
        passwordMatches = await verifyPassword(body.password, user.password_hash);
      } else {
        await performDummyPasswordCheck(body.password);
      }

      if (!activeUser || !passwordMatches) {
        return res.status(401).json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email or password is incorrect.",
            requestId: req.requestId,
          },
        });
      }

      if (!user.email_verified_at) {
        return res.status(403).json({
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "Please verify your email address before signing in.",
            requestId: req.requestId,
          },
        });
      }

      const refreshToken = randomBytes(32).toString("base64url");
      const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
      const expiresAt = new Date(Date.now() + sessionLifetimeMs);
      const sessionResult = await pool.query(
        `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, expires_at`,
        [user.id, refreshTokenHash, expiresAt],
      );
      const session = sessionResult.rows[0];
      setRefreshCookie(res, refreshToken, session.expires_at);

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email_normalized,
          role: user.role,
        },
        session: {
          id: session.id,
          expiresAt: session.expires_at,
        },
        csrfToken: createCsrfToken(refreshToken),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/session", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) return sendInvalidSession(req, res);

    try {
      const { rows } = await getPool().query(
        `SELECT u.id, u.email_normalized, u.role,
                sp.full_name, sp.university, sp.faculty, sp.department,
                sp.programme, sp.study_year, sp.academic_session,
                s.id AS session_id, s.expires_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE s.refresh_token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > clock_timestamp()
           AND u.status = 'active'
           AND u.email_verified_at IS NOT NULL`,
        [createHash("sha256").update(refreshToken).digest("hex")],
      );
      const session = rows[0];
      if (!session) return sendInvalidSession(req, res);

      const activeSessionResult = await getPool().query(
        `UPDATE auth_sessions
         SET last_used_at = now()
         WHERE id = $1
           AND revoked_at IS NULL
           AND expires_at > clock_timestamp()
         RETURNING id`,
        [session.session_id],
      );
      if (!activeSessionResult.rows[0]) return sendInvalidSession(req, res);

      return res.status(200).json({
        user: {
          id: session.id,
          email: session.email_normalized,
          role: session.role,
        },
        profile: {
          fullName: session.full_name,
          university: session.university,
          faculty: session.faculty,
          department: session.department,
          programme: session.programme,
          studyYear: session.study_year,
          academicSession: session.academic_session,
        },
        session: {
          id: session.session_id,
          expiresAt: session.expires_at,
        },
        csrfToken: createCsrfToken(refreshToken),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/refresh", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) return sendInvalidSession(req, res);
    if (!hasValidCsrfToken(req, refreshToken)) return sendCsrfError(req, res);

    const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const nextRefreshToken = randomBytes(32).toString("base64url");
    const nextRefreshTokenHash = createHash("sha256").update(nextRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    const client = await getPool().connect();
    let transactionStarted = false;
    let releaseError;
    let refreshedSession;
    let invalidSession = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;
      const sessionResult = await client.query(
        `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.replaced_by_session_id,
                u.status, u.email_verified_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.refresh_token_hash = $1
         FOR UPDATE OF s`,
        [refreshTokenHash],
      );
      const currentSession = sessionResult.rows[0];

      if (!currentSession) {
        invalidSession = true;
      } else {
        const expired = new Date(currentSession.expires_at).getTime() <= Date.now();
        const reused = Boolean(currentSession.revoked_at && currentSession.replaced_by_session_id);
        const userCanAuthenticate = currentSession.status === "active" && Boolean(currentSession.email_verified_at);

        if (reused) {
          await client.query(
            `UPDATE auth_sessions
             SET revoked_at = COALESCE(revoked_at, now())
             WHERE user_id = $1 AND revoked_at IS NULL`,
            [currentSession.user_id],
          );
          invalidSession = true;
        } else if (currentSession.revoked_at || expired || !userCanAuthenticate) {
          if (!currentSession.revoked_at) {
            await client.query(
              "UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
              [currentSession.id],
            );
          }
          invalidSession = true;
        } else {
          const inserted = await client.query(
            `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, expires_at`,
            [currentSession.user_id, nextRefreshTokenHash, expiresAt],
          );
          const replacement = inserted.rows[0];
          await client.query(
            `UPDATE auth_sessions
             SET revoked_at = now(), replaced_by_session_id = $2, last_used_at = now()
             WHERE id = $1 AND revoked_at IS NULL`,
            [currentSession.id, replacement.id],
          );
          refreshedSession = replacement;
        }
      }

      await client.query("COMMIT");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          releaseError = rollbackError;
        }
      }
      return next(error);
    } finally {
      client.release(releaseError);
    }

    if (invalidSession || !refreshedSession) return sendInvalidSession(req, res);
    setRefreshCookie(res, nextRefreshToken, refreshedSession.expires_at);
    return res.status(200).json({
      session: {
        id: refreshedSession.id,
        expiresAt: refreshedSession.expires_at,
      },
      csrfToken: createCsrfToken(nextRefreshToken),
    });
  });

  router.post("/logout", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const refreshToken = getRefreshToken(req);
    if (!hasTrustedOrigin(req)) return sendCsrfError(req, res);
    if (refreshToken && !hasValidCsrfToken(req, refreshToken)) return sendCsrfError(req, res);

    try {
      if (refreshToken) {
        await getPool().query(
          `UPDATE auth_sessions
           SET revoked_at = now(), last_used_at = now()
           WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
          [createHash("sha256").update(refreshToken).digest("hex")],
        );
      }
      clearRefreshCookie(res);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
