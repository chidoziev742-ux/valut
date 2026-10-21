# Student Vault API foundation

This directory contains the separate Express API scaffold and the initial reversible PostgreSQL schema migration. The API still starts without database credentials and does not connect to a database unless application code explicitly requests a database query. It does not yet authenticate users, upload files, send email, or provide Admin functionality.

## Requirements

- Node.js 20.11 or newer
- npm
- PostgreSQL 13 or newer (`gen_random_uuid()` is used for UUID defaults).

## Install

From this directory:

```sh
npm install
```

## Configure

Copy `.env.example` to `.env` and keep the example placeholders only. Set `FRONTEND_ORIGIN` to the exact local Vite origin (the default example is `http://localhost:5173`). The API rejects invalid or non-origin values. The root `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`.

Available settings:

- `HOST`: bind address; defaults to `127.0.0.1`.
- `PORT`: API port; defaults to `4000`.
- `FRONTEND_ORIGIN`: exact browser origin allowed by CORS; required.
- `JSON_BODY_LIMIT`: JSON request limit; defaults to `100kb`.
- `DATABASE_URL`: optional PostgreSQL connection string. It is required only when a database operation is requested. Use a dedicated local/test database for development; never put a real value in source control.

Do not put database passwords, Supabase service-role keys, JWT secrets, or other real secrets in frontend files or this example.

## Start

From this directory:

```sh
npm start
```

For local development with automatic Node watch/restart:

```sh
npm run dev
```

## Check health

With the server running:

```sh
curl http://127.0.0.1:4000/api/health
```

Expected response:

```json
{"status":"ok","service":"student-vault-api"}
```

The endpoint confirms only that the Express process is serving requests. It does not indicate database, authentication, or storage readiness.

## Database schema and migrations

Install dependencies from this directory with `npm install`. The initial migration is in `migrations/`. Review it before applying it. Set `DATABASE_URL` explicitly to the intended database, then run `npm run db:migrate`. To reverse the latest migration, run `npm run db:migrate:down`.

Migration commands connect to the database named by `DATABASE_URL`. They are never run automatically by API startup or tests. `npm run db:migrate:down` drops the tables created by the latest migration and all data in those tables, so use it only on a disposable database unless data loss is intended. Do not point migration commands at the hosted Supabase project until the migration has been reviewed and the project/database target has been explicitly approved. The built-in tests inspect configuration and migration structure only; they do not prove PostgreSQL behavior.

The initial schema gives each user one profile, keeps optional university/academic fields nullable, and stores only hashes for refresh and password-reset tokens. User roles are server-controlled and default to `student`. Password-reset tokens are outstanding until used or invalidated. Issuance must use one transaction: lock the owning user row with `SELECT ... FOR UPDATE`, invalidate any outstanding token, then insert the replacement. Locking the same user row serializes concurrent issuance for that user; the partial unique index is an additional integrity guard. The deferred same-user session-replacement foreign key uses `NO ACTION`, avoiding PostgreSQL 15's column-list `SET NULL` syntax; a referenced replacement session must be revoked or its predecessor link cleared before it can be deleted. Row-level security is enabled on all four tables, but no-policy denial applies only to roles subject to RLS. Table grants, table owners/privileged roles, and the Express runtime role's privileges and RLS behavior require review; RLS alone does not guarantee user-data isolation. `updated_at` is maintained by database triggers on users, profiles, and sessions.
