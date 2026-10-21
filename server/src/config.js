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

const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? "100kb";
if (!/^\d+(?:b|kb|mb)?$/i.test(jsonBodyLimit)) {
  throw new Error("JSON_BODY_LIMIT must be a byte count or use b, kb, or mb.");
}

export const config = Object.freeze({
  host: process.env.HOST || "127.0.0.1",
  port: readPort(process.env.PORT),
  frontendOrigin: readFrontendOrigin(process.env.FRONTEND_ORIGIN),
  jsonBodyLimit,
});
