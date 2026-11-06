# Vaultori API

This directory contains the separate Express API and reversible PostgreSQL schema migrations. The API still starts without database credentials and does not connect to a database unless application code explicitly requests a database query. It supports student registration, email verification, cookie-based sessions, password recovery through a reusable Brevo transactional email service, student profile persistence, authenticated document metadata and private file storage, and restricted administrator authentication. Admin functionality is maintained separately from student APIs.

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
- `FRONTEND_URL`: frontend origin used to construct verification links; defaults to `FRONTEND_ORIGIN`.
- `JSON_BODY_LIMIT`: JSON request limit; defaults to `100kb`.
- `DATABASE_URL`: optional PostgreSQL connection string. It is required only when a database operation is requested. Use a dedicated local/test database for development; never put a real value in source control.
- `BREVO_API_KEY`: optional server-only Brevo API key; required only when sending a transactional email.
- `BREVO_FROM_EMAIL`: sender email configured and verified with Brevo.
- `BREVO_FROM_NAME`: sender display name.
- `SUPABASE_URL`: server-side Supabase project URL used for private object storage.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only credential for Storage operations; never expose it in frontend files or responses.
- `SUPABASE_STORAGE_BUCKET`: private bucket name; defaults to `student-documents`.
- `MAX_UPLOAD_BYTES`: server upload limit from 1 byte to 50 MiB; defaults to 10 MiB.
- `UPLOADS_PER_MINUTE`: per-user in-process upload rate limit; defaults to 10.

Do not put database passwords, Supabase service-role keys, JWT secrets, or other real secrets in frontend files or this example.

## Student document storage

Before enabling uploads, create the private Supabase Storage bucket named by `SUPABASE_STORAGE_BUCKET`. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment. Set the matching frontend build variable `VITE_MAX_UPLOAD_BYTES` when changing the default upload limit so file-picker validation and guidance stay aligned. Supported uploads are PDF, JPG, JPEG, and PNG.

Migration `003_create_student_documents.js` creates document metadata and ownership constraints. Review and apply it explicitly using the migration procedure below; API startup and tests never apply migrations. The `/api/student/documents` API requires a verified student session; upload, rename, archive, restore, and delete also require the session-bound CSRF token. Every database read or write is scoped to the authenticated session user. `GET /api/student/documents/summary` returns owner-scoped dashboard counts and storage totals. Download access uses short-lived signed URLs. The storage bucket must be configured before uploads or signed downloads can succeed.

**Camera scanning is deferred to a future update.** Existing scanner implementation is preserved for future development, but scanning, page editing/reordering, and optional PDF generation should not be considered a completed Version 1 feature. Basic authenticated uploads of PDF, JPG, JPEG, and PNG files remain available; students can upload photos directly as image files without converting them to PDF. Physical camera permission, device switching, and scanner workflows require additional manual browser/device verification before the scanner is treated as complete. Folder associations remain in-memory only and are not persisted with documents.

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

## Transactional email

The reusable service in `src/services/email.js` sends transactional email through Brevo's official API and accepts HTML content, plain-text content, or both. Its configuration is loaded by the existing `src/config.js` dotenv setup. Email settings are not required to start the API; sending requires `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`. Provider and network failures are converted to safe service errors without logging provider responses or API keys. Automated tests mock delivery and never send real email. Registration and verification-resend requests use this service.

## Administrator access

There is no public administrator registration endpoint. `POST /api/auth/admin/login` accepts only an existing user whose server-side role is `admin`, whose status is `active`, and whose email is verified. Protected admin routes use `requireAdminSession`; a valid student session is rejected even when the student knows valid credentials. Admin logout uses the same CSRF-validated, refresh-token revocation endpoint as student logout.

Provision the first administrator through a controlled operator procedure: create the account in a reviewed maintenance script or directly in the intended private database using the existing scrypt password format, set `role = 'admin'` only after verifying the operator's identity, and set `email_verified_at` through the same controlled process. Run this procedure from a restricted environment with audited access, never expose it as an HTTP route, never hardcode credentials, and never convert a student account automatically. Review the resulting row and revoke any temporary provisioning access before enabling admin use.

The local provisioning utility at `scripts/provision-first-admin.js` is fixed to the initial administrator email `chidoziev27@gmail.com`. It prompts for the password without echoing it and defaults to a no-database dry run:

```text
cd server
node scripts/provision-first-admin.js
```

After reviewing the procedure and explicitly approving the target database, run the insertion only with:

```text
cd server
node scripts/provision-first-admin.js --execute
```

Before requesting the password, `--execute` requires the operator to type exactly `CONFIRM` to attest control of `chidoziev27@gmail.com` and authorize marking the address email-verified. Any other input aborts without hashing or database access. The `--execute` mode uses one transaction, rejects an existing email, stores only the existing scrypt password hash format, and sets the new row to `admin`, `active`, and email-verified. It never prints credentials, hashes, tokens, or database values. Do not run `--execute` against Supabase until production approval is explicit.

## Student registration

`POST /api/auth/register` accepts a JSON body containing `fullName`, `email`, and `password`. Full name is limited to 120 characters, email is trimmed and lowercased, and passwords must contain 8-1024 UTF-8 bytes. Registration stores an scrypt password hash, creates the user with the server-assigned `student` role, creates the corresponding student profile, and stores a SHA-256 hash of a random verification token with a 24-hour expiry in one transaction. A verification email is sent through Brevo before the transaction commits; delivery failure rolls back the user, profile, and token records. Success returns HTTP 201 with the user ID, normalized email, full name, and role; duplicate email returns HTTP 409. Password hashes and raw verification tokens are never returned.

`POST /api/auth/verify-email` accepts a JSON body containing `token`. It finds the token by its SHA-256 hash, then locks the user and token rows in a transaction and rechecks that the token is unused, not invalidated, and unexpired. On success it sets `users.email_verified_at` and marks the token used. Invalid, expired, used, or otherwise unavailable tokens receive the same generic HTTP 400 response.

`POST /api/auth/resend-verification` accepts an email address. It responds with the same generic HTTP 202 message whether or not an active, unverified account exists. For an eligible account, it locks the user, invalidates the previous outstanding token, stores a hash of a new random token with a 24-hour expiry, and sends a replacement email. The raw token is included only in the verification email and is never returned or logged.

`POST /api/auth/login` accepts `email` and `password`, normalizes email, and verifies the stored scrypt password hash. Unknown emails, incorrect passwords, and disabled accounts receive the same HTTP 401 response. A correct password for an unverified account receives HTTP 403 with `EMAIL_NOT_VERIFIED`; no authentication session is created. Successful verified login creates a 30-day session, stores only a SHA-256 hash of its cryptographically random refresh token in `auth_sessions`, and sets the raw token in an `HttpOnly`, `Secure`, `SameSite=None` cookie scoped to `/api` so API routes can authenticate it. The JSON response contains the safe user/session data and a CSRF token, never the refresh token.

`GET /api/auth/session` validates the refresh cookie and returns the safe user, student profile, session expiry, and CSRF token. `POST /api/auth/refresh` rotates the refresh token transactionally, revokes the old session, and returns a fresh CSRF token while setting a replacement cookie. Reuse of a rotated token revokes the user's active sessions. `POST /api/auth/logout` revokes the current session and clears the refresh cookie. Refresh and logout require the CSRF token in `X-CSRF-Token`; it is cryptographically bound to the refresh token. State-changing session endpoints also reject a supplied origin that differs from the configured `FRONTEND_ORIGIN`. Credentialed CORS permits only that exact frontend origin.

`POST /api/auth/forgot-password` accepts an email address and responds with the same HTTP 202 message whether or not an account exists. For an existing account, it locks the user row, invalidates any outstanding reset token, stores a SHA-256 hash of a cryptographically random token in `password_reset_tokens` with a 30-minute expiry, and sends a reset link through Brevo. Token creation and email delivery are part of one transaction; delivery failure rolls back token changes while returning the same generic response. The raw token appears only in the outgoing email link and is never returned or logged.

`POST /api/auth/reset-password` accepts `token` and `newPassword`. It validates the existing password policy, locks the user and reset-token rows in a transaction, and rechecks that the token is unused, not invalidated, and unexpired. On success it updates the password using the registration scrypt format, consumes that token, invalidates other outstanding reset tokens, and revokes the user's existing sessions. Invalid, expired, used, or otherwise unavailable tokens receive the same generic HTTP 400 response.

## Student profile

`GET /api/student/profile` returns the authenticated student's saved profile or HTTP 404 with `PROFILE_NOT_FOUND` when no profile exists. `PUT /api/student/profile` creates or updates the profile using `fullName`, `university`, `faculty`, `department`, `programme`, `studyYear`, and `academicSession`; all fields must be supplied as strings, and empty optional values are stored as `NULL`. Both endpoints require a valid student session. Updates also require the session-bound CSRF token in `X-CSRF-Token` and reject an untrusted supplied `Origin`. The owner ID comes only from the validated server-side session; client-supplied identity, email, role, and account-status fields are rejected. No schema migration is required.

## Database schema and migrations

Install dependencies from this directory with `npm install`. Migrations are in `migrations/`. Review each migration before applying it. Migration `002_create_email_verification_tokens.js` creates the separate verification-token table with a cascading user foreign key, hash and expiry constraints, indexes, one-outstanding-token-per-user enforcement, and a down migration. Migration `003_create_student_documents.js` adds student-owned document metadata and indexes. To apply migrations, explicitly set `DATABASE_URL` to the intended database and run `npm run db:migrate`. To reverse the latest migration, run `npm run db:migrate:down`.

Migration commands connect to the database named by `DATABASE_URL`. They are never run automatically by API startup or tests. `npm run db:migrate:down` drops the tables created by the latest migration and all data in those tables, so use it only on a disposable database unless data loss is intended. Do not point migration commands at the hosted Supabase project until the migration has been reviewed and the project/database target has been explicitly approved. The built-in tests cover API behavior and inspect configuration and migration structure; they do not prove PostgreSQL behavior.

The initial schema gives each user one profile, keeps optional university/academic fields nullable, and stores only hashes for refresh, password-reset, and email-verification tokens. User roles are server-controlled and default to `student`. Password-reset and verification tokens are outstanding until used or invalidated. Issuance must use one transaction: lock the owning user row with `SELECT ... FOR UPDATE`, invalidate any outstanding token, then insert the replacement. Locking the same user row serializes concurrent issuance for that user; the partial unique indexes are additional integrity guards. The deferred same-user session-replacement foreign key uses `NO ACTION`, avoiding PostgreSQL 15's column-list `SET NULL` syntax; a referenced replacement session must be revoked or its predecessor link cleared before it can be deleted. Row-level security is enabled on the tables, but no-policy denial applies only to roles subject to RLS. Table grants, table owners/privileged roles, and the Express runtime role's privileges and RLS behavior require review; RLS alone does not guarantee user-data isolation. `updated_at` is maintained by database triggers on users, profiles, and sessions.
