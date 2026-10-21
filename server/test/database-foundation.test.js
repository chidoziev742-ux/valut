import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readDatabaseUrl } from "../src/db/config.js";
import { closePool, getPool } from "../src/db/pool.js";
import { down, up } from "../migrations/001_create_auth_schema.js";

test("database configuration is not required until a database operation is requested", () => {
  assert.throws(() => readDatabaseUrl({}), {
    message: "DATABASE_URL must be configured before database access.",
  });
});

test("database configuration accepts PostgreSQL URL schemes without exposing invalid values", () => {
  const localUrl = "postgresql://student:placeholder@127.0.0.1:5432/student_vault";
  assert.equal(readDatabaseUrl({ DATABASE_URL: localUrl }), localUrl);

  const invalidValue = "super-secret-not-a-database-url";
  assert.throws(
    () => readDatabaseUrl({ DATABASE_URL: invalidValue }),
    (error) => {
      assert.equal(error.message, "DATABASE_URL must be a valid PostgreSQL connection URL.");
      assert.equal(error.message.includes(invalidValue), false);
      return true;
    },
  );
});

test("requesting the pool without DATABASE_URL fails before opening a connection", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    assert.throws(() => getPool(), {
      message: "DATABASE_URL must be configured before database access.",
    });
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    await closePool();
  }
});

test("the initial migration defines the requested schema and a reverse migration", async () => {
  const upSql = [];
  const downSql = [];
  await up({ sql: (statement) => upSql.push(statement) });
  await down({ sql: (statement) => downSql.push(statement) });

  const schema = upSql.join("\n");
  for (const expected of [
    "CREATE TABLE users",
    "email_normalized varchar(254) NOT NULL",
    "password_hash text NOT NULL",
    "users_password_hash_nonempty_check",
    "DEFAULT 'student'",
    "CREATE TABLE student_profiles",
    "university varchar(120)",
    "study_year varchar(40)",
    "CREATE TABLE auth_sessions",
    "refresh_token_hash text NOT NULL",
    "replaced_by_session_id uuid",
    "auth_sessions_replaced_by_same_user_fk",
    "DEFERRABLE INITIALLY DEFERRED",
    "ON DELETE NO ACTION",
    "auth_sessions_refresh_token_hash_nonempty_check",
    "CREATE TABLE password_reset_tokens",
    "token_hash text NOT NULL",
    "invalidated_at timestamptz",
    "password_reset_tokens_hash_nonempty_check",
    "ON DELETE CASCADE",
    "CREATE INDEX auth_sessions_user_active_idx",
    "CREATE INDEX password_reset_tokens_active_expiry_idx",
    "CREATE UNIQUE INDEX password_reset_tokens_one_outstanding_per_user_idx",
    "WHERE used_at IS NULL AND invalidated_at IS NULL",
    "CREATE FUNCTION set_updated_at()",
    "CREATE TRIGGER users_set_updated_at",
    "CREATE TRIGGER student_profiles_set_updated_at",
    "CREATE TRIGGER auth_sessions_set_updated_at",
    "RLS without policies denies row access only for roles subject to RLS",
    "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY",
  ]) {
    assert.ok(schema.includes(expected), `migration is missing: ${expected}`);
  }

  const rollback = downSql.join("\n");
  assert.match(rollback, /DROP TRIGGER auth_sessions_set_updated_at[\s\S]*DROP FUNCTION set_updated_at\(\)[\s\S]*DROP TABLE password_reset_tokens[\s\S]*DROP TABLE users/);
  assert.ok(
    (await readFile(new URL("../migrations/001_create_auth_schema.js", import.meta.url), "utf8"))
      .includes("export async function down"),
  );
});
