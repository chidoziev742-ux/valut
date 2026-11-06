import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const refreshCookieName = "vaultori_refresh";
const csrfTokenHeader = "x-csrf-token";

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

export function hasValidSessionCsrfToken(req) {
  const origin = req.get("origin");
  if (origin && origin !== config.frontendOrigin) return false;

  const refreshToken = getRefreshToken(req);
  const provided = req.get(csrfTokenHeader);
  if (!refreshToken || typeof provided !== "string") return false;

  const expectedBuffer = Buffer.from(createCsrfToken(refreshToken));
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export const hasValidStudentCsrfToken = hasValidSessionCsrfToken;

function sendInvalidSession(req, res) {
  return res.status(401).json({
    error: {
      code: "INVALID_SESSION",
      message: "Your session is invalid or has expired. Please log in again.",
      requestId: req.requestId,
    },
  });
}

export function requireStudentSession({ getPool }) {
  return async (req, res, next) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) return sendInvalidSession(req, res);

    try {
      const { rows } = await getPool().query(
        `SELECT s.id, s.user_id
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.refresh_token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > clock_timestamp()
           AND u.status = 'active'
           AND u.email_verified_at IS NOT NULL
           AND u.role = 'student'`,
        [createHash("sha256").update(refreshToken).digest("hex")],
      );
      if (!rows[0]) return sendInvalidSession(req, res);

      req.studentUserId = rows[0].user_id;
      req.studentSessionId = rows[0].id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireAdminSession({ getPool }) {
  return async (req, res, next) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) return sendInvalidSession(req, res);

    try {
      const { rows } = await getPool().query(
        `SELECT s.id, s.user_id
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.refresh_token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > clock_timestamp()
           AND u.status = 'active'
           AND u.email_verified_at IS NOT NULL
           AND u.role = 'admin'`,
        [createHash("sha256").update(refreshToken).digest("hex")],
      );
      if (!rows[0]) return sendInvalidSession(req, res);

      req.adminUserId = rows[0].user_id;
      req.adminSessionId = rows[0].id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
