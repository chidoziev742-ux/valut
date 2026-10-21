/**
 * Resolve and validate the database URL only when database access is requested.
 * Error messages intentionally never include the supplied value.
 */
export function readDatabaseUrl(env = process.env) {
  const value = env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL must be configured before database access.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length < 2
  ) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  return value;
}
