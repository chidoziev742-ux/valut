import { Pool } from "pg";
import { readDatabaseUrl } from "./config.js";

let pool;

/** Create the pool only when a caller actually requests a query. */
export function getPool() {
  if (pool) return pool;

  const connectionString = readDatabaseUrl();
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
  });

  // Do not print the driver error because connection errors can contain sensitive details.
  pool.on("error", () => {
    console.error("An idle PostgreSQL client error occurred.");
  });

  return pool;
}

/**
 * Execute a parameterized query. Use PostgreSQL placeholders ($1, $2, ...) and
 * pass all untrusted values in `values`; never concatenate input into `text`.
 */
export function query(text, values = []) {
  if (typeof text !== "string" || !Array.isArray(values)) {
    throw new TypeError("Database queries require SQL text and an array of values.");
  }

  return getPool().query(text, values);
}

/** Close the pool if it was created; this function never creates a connection. */
export async function closePool() {
  if (!pool) return;

  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
