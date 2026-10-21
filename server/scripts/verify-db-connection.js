import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { closePool, query } from "../src/db/pool.js";

// Load the ignored server/.env file without echoing configuration values.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

let result;
let failed = false;

try {
  const { rows } = await query(
    "SELECT current_database() AS database_name, current_user AS role, version() AS postgres_version",
  );

  result = {
    database_name: rows[0].database_name,
    role: rows[0].role,
    postgres_version: rows[0].postgres_version,
  };
} catch (error) {
  failed = true;

  const safeCodes = {
    ENOTFOUND: "DNS lookup failed: hostname could not be resolved.",
    EAI_AGAIN: "DNS lookup temporarily failed.",
    ECONNREFUSED: "Connection refused by the database endpoint.",
    ETIMEDOUT: "Connection timed out.",
    ECONNRESET: "Connection was reset.",
    ECONNREFUSED: "Connection refused by the database endpoint.",
    "28P01": "Database authentication failed.",
    "3D000": "The specified database does not exist.",
    28000: "Database authorization failed.",
    "08006": "Database connection failure.",
    "08001": "Could not establish a database connection.",
    CERT_HAS_EXPIRED: "The TLS certificate has expired.",
    SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate verification failed.",
  };

  const code = typeof error?.code === "string" ? error.code : undefined;
  console.error("Error name:", error?.name ?? "Unknown");
  console.error("Error code:", code ?? "No error code");
  console.error("Error class:", error?.constructor?.name ?? "Unknown");
  console.error(
    "Database verification failed:",
    safeCodes[code] ??
      "Unclassified error; inspect configuration and SSL settings.",
  );

  if (code && !safeCodes[code]) {
    console.error("Error code:", code);
  }
}
try {
  await closePool();
} catch {
  failed = true;
  console.error("The database connection could not be closed cleanly.");
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
