import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
dotenv.config({ path: envPath });

function readPort(value) {
  const port = Number(value ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function readFrontendOrigin(value) {
  if (!value) {
    throw new Error("FRONTEND_ORIGIN must be set to the exact local frontend origin.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("FRONTEND_ORIGIN must be a valid origin URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value) {
    throw new Error("FRONTEND_ORIGIN must contain only an HTTP or HTTPS origin.");
  }

  return parsed.origin;
}

function readFrontendUrl(value) {
  if (!value) {
    throw new Error("FRONTEND_URL must be set to the frontend origin.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("FRONTEND_URL must be a valid HTTP or HTTPS URL.");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("FRONTEND_URL must be a valid HTTP or HTTPS URL without credentials or query parameters.");
  }

  return parsed.origin;
}

const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? "100kb";
if (!/^\d+(?:b|kb|mb)?$/i.test(jsonBodyLimit)) {
  throw new Error("JSON_BODY_LIMIT must be a byte count or use b, kb, or mb.");
}
const frontendOrigin = readFrontendOrigin(process.env.FRONTEND_ORIGIN);
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10485760);
const uploadsPerMinute = Number(process.env.UPLOADS_PER_MINUTE ?? 10);
if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1 || maxUploadBytes > 52428800) {
  throw new Error("MAX_UPLOAD_BYTES must be an integer between 1 and 52428800.");
}
if (!Number.isSafeInteger(uploadsPerMinute) || uploadsPerMinute < 1 || uploadsPerMinute > 100) {
  throw new Error("UPLOADS_PER_MINUTE must be an integer between 1 and 100.");
}

export const config = Object.freeze({
  host: process.env.HOST || "127.0.0.1",
  port: readPort(process.env.PORT),
  frontendOrigin,
  frontendUrl: readFrontendUrl(process.env.FRONTEND_URL || frontendOrigin),
  jsonBodyLimit,
  brevo: Object.freeze({
    apiKey: process.env.BREVO_API_KEY?.trim(),
    fromEmail: process.env.BREVO_FROM_EMAIL?.trim(),
    fromName: process.env.BREVO_FROM_NAME?.trim(),
  }),
  storage: Object.freeze({
    supabaseUrl: process.env.SUPABASE_URL?.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "student-documents",
    maxUploadBytes,
    uploadsPerMinute,
  }),
});
