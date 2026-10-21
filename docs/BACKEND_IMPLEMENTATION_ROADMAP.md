# Student Vault — Backend Implementation Roadmap

**Status:** Planning document based on a static audit of the current frontend  
**Scope:** Backend architecture, API, security, implementation and verification plan. No backend functionality is implemented by this document.

## 1. Executive summary

The repository is a React 18/Vite JavaScript frontend prototype. Its custom client router is in src/App.jsx and src/routeConfig.js. There is no Express server, PostgreSQL schema, API client, backend persistence or real authentication. Student records are sample data or in-memory React state; Admin figures and records live in separate fictional data modules. Backend work is therefore a new layer, not an integration with an existing API.

Agreed direction: retain the React 18/Vite JavaScript frontend and custom router; add a Node.js + Express REST API maintained in server/. Supabase provides PostgreSQL and private Supabase Storage. Express remains the application backend: it owns authentication, authorization, validation, business logic, database access, metadata, secure upload/download authorization, Admin permissions, auditing and safe errors. Do not replace Express with Supabase Edge Functions or turn the system into a Supabase-only backend. Develop locally while preparing to connect to a Supabase project approved for development. Application hosting is a separate later decision.

A hidden route, client-side role flag, menu item or mock login is not authorization. Every protected API operation must verify identity and enforce role and ownership at the resource/action boundary.

## 2. Audit scope and confidence

Inspected the repository tree, AGENTS.md, DESIGN.md, FRONTEND_PLAN.md, route configuration, application state owner, feature pages, data modules and relevant styles. This was a static audit. No application was started and no browser behavior was tested.

The actual project root contains package.json, src/, index.html and vite.config.js. Root dependencies are React, React DOM, Vite, the React plugin and lucide-react. Scripts are dev, build and preview; there are no test or lint scripts. Backend dependencies have not been installed. No server or database integration exists. Supabase is the agreed platform direction, but the project, credentials, environment separation and connection method remain unconfirmed. An existing dist/ directory does not prove the current source builds.

Static source search found no fetch, Axios, XHR, IndexedDB, localStorage, sessionStorage or /api/ usage. No email provider, cloud object store or live monitoring is configured. The user has reported prior Windows/OneDrive build stalls and a Vite realpath EPERM involving src/main.jsx. No build was run for this audit; current build status is unknown.

## 3. Current organization and behavior

### 3.1 Architecture

- src/main.jsx mounts React and imports global src/styles.css.
- src/App.jsx owns the custom router, browser history/popstate handling, reducers, shared state and callbacks. Keep this router; do not introduce React Router.
- src/routeConfig.js defines route metadata, navigation and dynamic document/student matching.
- Student and Admin shells are separate: src/components/AppShell.jsx and src/modules/admin/components/AdminAppShell.jsx.
- Feature code is under src/modules/. Shared focus management stays in src/hooks/useDialogFocus.js. Global tokens/reset/layout styles are in src/styles.css; src/organization.css and src/profile-settings.css are shared stylesheets.
- The root package has no automated test, lint or format scripts.

### 3.2 Route and feature audit

| Routes | Current behavior | Backend implication |
|---|---|---|
| /welcome, /onboarding | Welcome/landing prototype | Public entry; no session |
| /sign-up, /login, /forgot-password, /reset-password, /verify, /profile/setup | Student forms with client validation and simulated feedback | Server-backed account, session, verification and recovery required; current success states do not create accounts or send email |
| / | Dashboard combines sample modules with shared in-memory documents/profile | Needs owner-scoped summaries; some values are illustrative |
| /documents, /upload, /documents/:id | Search/filter/sort, active/archive views, details, rename, folder move, archive/restore/delete, preview and attachment-only download | Owner-scoped metadata CRUD and private file lifecycle |
| /folders | In-memory folder create/rename/delete-empty/move and unfiled view | User-scoped folder CRUD and transactional ownership checks |
| /academic-records | In-memory record list/detail/create/edit/delete | User-scoped CRUD and validation |
| /profile, /profile/edit | Read-only profile and separate edit form; shell identity follows state | Authenticated self-profile read/update |
| /settings, /change-password | Session-only notification preferences, document-derived overview, disconnected password UI | Persist preferences only after API; password change requires real auth |
| /goals, /reminders | Coming Soon placeholders | Deferred; exclude from Version 1 absent approval |
| /admin/login, /admin/signup, /admin/forgot-password, /admin/reset-password | Separate Admin auth pages with simulated submission | One identity/auth system; Admin role enforced server-side; no public unrestricted registration |
| /admin | Fictional overview and CSS activity chart | Role-protected aggregate endpoints |
| /admin/students, /admin/students/:id | Fictional searchable/filterable directory and read-only detail | Admin-only, minimized data and audit |
| /admin/usage | Illustrative aggregate storage/type/trend and accessible table | Admin aggregates; no quota/capacity claim |
| /admin/feedback | Communications UI: local drafts/preview/history and prototype “sent” state | Draft persistence and dispatch only after delivery infrastructure/policy approval |
| Document Share action | Unavailable/future-version affordance | Sharing is Version 2; no endpoint or share grant |

The custom router returns a not-found result for unknown URLs, renders authentication outside the shells, Admin inside AdminAppShell and students inside AppShell. Shell separation is visual only; it does not protect APIs.

### 3.3 State, mock data and CSS ownership

- src/App.jsx owns shared document, folder and academic-record reducers; profile and notification preference state; query/notice/dialog state; action callbacks; and preview object URL lifecycle.
- Student data modules include src/data/mockProfile.js, src/modules/dashboard/data/mockDashboard.js, src/modules/documents/data/mockDocuments.js, mockFolders.js and src/modules/academic-records/data/mockAcademicRecords.js.
- Admin-only fictional data is in src/modules/admin/data/mockAdminDashboard.js, mockAdminStudents.js, mockAdminUsage.js and mockAdminCommunications.js. Keep these boundaries.
- Document upload accepts PDF/JPG/JPEG/PNG/DOC/DOCX, with a 10 MB client limit. Actual selected files remain in browser memory; sample records have no actual attachments. Server must verify file bytes/type/size and ownership.
- Academic records are separate from document metadata. Whether they can attach documents remains undecided.
- Folder categories are fixed frontend constants; there is no category CRUD or user-owned category model.
- Admin communications are local-only. The current action does not email or notify users. Admin signup UI has no invitation field following a product correction; real Admin provisioning still needs a controlled design.
- styles.css owns global tokens/resets. organization.css and profile-settings.css are shared. Feature CSS is co-located in modules.

### 3.4 Findings to reconcile

1. No backend, persistence or API exists; all current form submissions and operations are prototypes.
2. No automated test/lint scripts exist.
3. Dashboard has illustrative/hardcoded values, including pending uploads and sample storage figures; Shared Files is deferred.
4. Admin dashboard and usage mock totals are independent and do not reconcile. Future server metrics need definitions and common queries.
5. Admin Usage intentionally has no configured quota. Do not invent a capacity percentage.
6. “Manage categories” does not establish that users can create categories.
7. There is no student Help & Feedback submission or private report history. Admin Surveys were replaced by Communications in the current UI.
8. Share is only a future-version affordance. No public or guessable file URL should be introduced.
9. Frontend validation and route separation are UX only; server authorization and validation are mandatory.

## 4. Agreed architecture and proposed backend structure

### 4.1 Responsibilities

- **Frontend:** existing React 18 + Vite application, JavaScript, standard CSS and existing custom router. Preserve URLs and prototype boundaries.
- **Application backend:** Node.js + Express REST API, maintained in server/. Express handles authentication, protected endpoints, server-side authorization/ownership, validation, business logic, database access, document metadata, secure file access, Admin permissions, audit and safe errors.
- **Database:** Supabase PostgreSQL. Store identity/profile, folders, document metadata, academic records and approved operational metadata. Never store document binaries in PostgreSQL.
- **File storage:** Supabase Storage with private student-document storage. Express authorizes upload/download and controls object access.
- **Authentication:** Express-managed authentication and authorization using the agreed JWT-based approach. JWT storage, lifetimes, refresh, revocation, logout, CSRF implications and key rotation require review before coding.
- **Development and hosting:** develop locally and prepare to connect to an approved Supabase project. Decide application hosting separately. Do not create or connect to any Supabase resource until project approval and credentials/connection decisions are explicit.

Supabase provides managed PostgreSQL and object storage; it does not replace the Express application backend. Do not move protected business logic to Supabase Edge Functions as a backend replacement.

### 4.2 Proposed server structure

Keep the frontend at repository root. Add an Express API under server/ with its own package manifest. Use migrations as schema history, parameterized SQL in repositories, business rules in services, HTTP mapping in controllers and centralized middleware for JWT verification, authorization, validation, safe errors and rate limits. Select tooling after review; do not assume an ORM.

Suggested shape; add folders as implementation begins:

    server/
      package.json
      .env.example
      src/
        app.js
        server.js
        config/
        db/
          pool.js
          migrations/
          repositories/
        middleware/
        modules/
          auth/
          profile/
          documents/
          folders/
          academic-records/
          admin/
          communications/
        services/
          supabase-storage/
          email/
        errors/
      tests/
        unit/
        integration/
        security/

The PostgreSQL client and migration tooling are not finalized. pg and node-pg-migrate are proposed candidates requiring review. Do not introduce a separate local PostgreSQL installation as the default plan. Testing may use an approved isolated Supabase test project or another explicitly approved isolated database setup; decide this before creating credentials or resources.

Keep credentials in approved server-side environment/secret management, never in source control or the browser bundle. Supabase service-role credentials, if selected for server-side operations, must remain server-only and must never be exposed to Vite/client code.

### 4.3 Email provider and delivery plan

SendByte Africa is the planned primary transactional email provider. EmailJS is a candidate secondary provider only; it is not finalized, and its suitability for backend use, security controls, delivery guarantees, idempotency, webhook support and failover behavior must be evaluated. Leave room to evaluate other suitable transactional providers. Do not claim EmailJS offers guarantees or automatic failover equivalent to SendByte Africa without verification.

All security-sensitive and transactional mail must go through a provider-independent email service/adapter owned by the Express backend. Authentication, email verification and password-reset logic call the application email service contract, never a provider SDK directly. The adapter should isolate provider clients, templates/message identifiers, delivery events and provider-specific errors. Never send password-reset or verification messages from the React frontend.

Plan bounded retries with backoff, per-provider and application-level rate limits, request timeouts, provider health monitoring, structured operational logs and accurate states (for example queued, accepted by provider, delivered, bounced, failed, or delivery unknown where supported). Do not treat provider acceptance as proof of inbox delivery. Never log credentials, authorization headers, password-reset tokens, verification tokens, or sensitive message contents. Verify webhook signatures and event authenticity before accepting delivery events; reject invalid or replayed events and make event handling idempotent.

Prevent duplicate messages when a provider times out or returns an uncertain result. Use provider idempotency keys where supported. Before fallback, reconcile the original attempt using an idempotency lookup, provider status API, signed delivery event, or other verified mechanism. If the outcome cannot be established safely, keep it in an explicit unknown/reconciliation state and do not blindly send through another provider. Failover must be bounded and policy-driven, never an unverified automatic resend.

Actual email delivery remains disabled until provider configuration, domain authentication (including approved SPF/DKIM/DMARC setup as applicable), backup/failover behavior, webhook verification, secret handling, rate limits and security tests have been reviewed and approved. Do not configure a provider or domain in this planning task.

### 4.4 Proposed data entities

Use UUID primary keys unless deployment standards require otherwise, UTC timestamptz, foreign keys, indexes, uniqueness constraints and transactions. Minimize personal data.

| Entity | Core fields/relations | Purpose and constraints |
|---|---|---|
| users | id, normalized_email, password_hash, role, status, email_verified_at, timestamps | Unique normalized email; role constrained to student/admin; never return password hash |
| student_profiles | user_id PK/FK, full_name, university, faculty, department, programme, academic_level, academic_session, updated_at | One-to-one profile; matric number omitted from current approved UI |
| email_verification_tokens | user_id, token_hash, expires_at, consumed_at | Hash only, short-lived, single-use |
| password_reset_tokens | user_id, token_hash, expires_at, consumed_at | Hash only, single-use; generic request response |
| sessions or refresh_tokens | user_id, token_hash, expires_at, revoked_at, timestamps | Depends on approved JWT lifecycle design; never persist raw refresh credential |
| notification_preferences | user_id PK/FK, document_updates, account_updates, updated_at | Only approved preference semantics |
| folders | id, owner_user_id, name, timestamps | Owner FK; naming/deletion policy to decide |
| documents | id, owner_user_id, folder_id nullable, name, original_filename, category, academic_session, mime_type, file_size_bytes, object_key, status, timestamps, archived_at | Metadata only; private Supabase Storage object key; validate owner and folder ownership |
| academic_records | id, owner_user_id, record_type, title, institution, programme, academic_session, academic_level, semester, details, timestamps | Type-specific validation; attachment relation undecided |
| admin_audit_events | actor_user_id, action, resource_type/id, outcome, occurred_at, request_id, minimal metadata | Audit privileged access without recording secrets or document contents |
| communications | created_by_admin_id, subject, body, recipient_scope, channel, status, timestamps, dispatched_at | Draft/history; no delivered state until actual delivery evidence |
| communication_recipients (conditional) | communication_id, user_id, delivery_status, delivered_at, failure_code | Only after recipient targeting/delivery are approved |
| in_app_notifications (conditional) | user_id, source_id, title, body, read_at, created_at | Add only if operational in-app delivery is approved |

Do not add tables for sharing, payments, subscriptions, upgrades, goals/reminders, surveys or student feedback reports in the current baseline. Define retention, account deletion and orphan object cleanup before production.

## 5. API contract catalogue

Use /api/v1. JSON metadata/forms; bounded pagination; consistent status/error conventions. Suggested error form: { error: { code, message, fields, requestId } }. Never return stack traces, SQL, secrets, raw provider errors or account existence during recovery. Endpoint list is a review proposal, not an implemented API.

### 5.1 Public/system and authentication

| Method and path | Purpose | Access and controls |
|---|---|---|
| GET /api/v1/health | Readiness/liveness | Minimal public response; no config dump |
| POST /api/v1/auth/signup | Student account/profile setup | Public, throttled; role fixed to student; normalize email/hash password |
| POST /api/v1/auth/login | Authenticate identity | Public, throttled; generic failure |
| POST /api/v1/auth/logout | Revoke current session | Authenticated; idempotent |
| GET /api/v1/auth/session | Minimal current identity/role/setup status | Authenticated |
| POST /api/v1/auth/verify-email/request | Issue verification | Rate-limited; provider adapter |
| POST /api/v1/auth/verify-email/confirm | Consume verification token | Single-use and expiry checked |
| POST /api/v1/auth/password/forgot | Recovery request | Same response for known/unknown address; throttled |
| POST /api/v1/auth/password/reset | Set password from reset token | One-time token; revoke sessions per policy |
| POST /api/v1/auth/password/change | Change current account password | Authenticated; check current password and policy |
| POST /api/v1/auth/admin-registration | Controlled Admin provisioning | Do not expose until bootstrap/invitation/operator process is approved |

Admin login is not another identity system. A separate page can use the common login endpoint; the server assigns and returns roles. Public student signup never accepts role.

### 5.2 Student profile, preferences and dashboard

| Method and path | Purpose | Access and controls |
|---|---|---|
| GET /api/v1/me | Current account/profile summary | Authenticated, self only |
| PATCH /api/v1/me/profile | Update profile fields | Allowlist fields; no role/status/password mutation |
| GET /api/v1/me/notification-preferences | Read preferences | Self only |
| PATCH /api/v1/me/notification-preferences | Update approved booleans | Self only; does not imply delivery |
| GET /api/v1/me/dashboard | Counts/recent own records | Owner-scoped, defined metric semantics |
| GET /api/v1/me/storage-summary | Actual records/attached byte totals | No quota without approved quota policy |

### 5.3 Documents and folders

| Method and path | Purpose | Access and controls |
|---|---|---|
| GET /api/v1/documents | Search/filter/sort/page own documents | Authenticated; owner in DB query; bounded page |
| POST /api/v1/documents/upload-intents | Request private upload target | Validate metadata, size/type policy and owner; short-lived |
| POST /api/v1/documents/:id/complete-upload | Verify object and finalize metadata | Owner only; verify key, size, type/checksum; idempotency |
| GET /api/v1/documents/:id | Read metadata | Owner only; foreign/absent IDs return indistinguishable not-found |
| PATCH /api/v1/documents/:id | Rename/category/session/folder | Owner only; allowlisted fields; verify destination folder |
| POST /api/v1/documents/:id/archive | Archive | Owner only |
| POST /api/v1/documents/:id/restore | Restore | Owner only |
| DELETE /api/v1/documents/:id | Delete metadata and schedule object cleanup | Owner only; retryable cleanup |
| GET /api/v1/documents/:id/download | Authorize stream or short-lived private URL | Owner checked before object access |
| GET /api/v1/folders | List own folders/counts | Owner scoped |
| POST /api/v1/folders | Create folder | Validate trimmed name and uniqueness policy |
| PATCH /api/v1/folders/:id | Rename folder | Owner only |
| DELETE /api/v1/folders/:id | Delete under approved empty/move policy | Owner only; transaction |
| POST /api/v1/folders/:id/move-documents | Move own docs to folder/unfiled | Verify all records and destination ownership atomically |

Do not create share links or share grants in Version 1. A document ID is never proof of access.

### 5.4 Academic records

| Method and path | Purpose | Access and controls |
|---|---|---|
| GET /api/v1/academic-records | List own records | Owner scoped, bounded |
| POST /api/v1/academic-records | Create record | Validate fields and record-type requirements |
| GET /api/v1/academic-records/:id | Read one | Owner only |
| PATCH /api/v1/academic-records/:id | Edit | Owner only; allowlist |
| DELETE /api/v1/academic-records/:id | Delete | Owner only; explicit UX confirmation |

### 5.5 Admin and communications

| Method and path | Purpose | Access and controls |
|---|---|---|
| GET /api/v1/admin/dashboard | Defined platform metrics | Server Admin role; documented time/count definitions; audit |
| GET /api/v1/admin/students | Search/filter/page directory | Admin only; minimal fields; bounded query |
| GET /api/v1/admin/students/:id | Approved student detail | Admin only; no document contents; audit |
| GET /api/v1/admin/usage | Aggregate storage/type/trend | Admin only; no undefined capacity percentage |
| GET /api/v1/admin/communications | Draft/history list | Admin only, paginated |
| POST /api/v1/admin/communications | Create draft | Admin only; validate content/scope/channel |
| GET /api/v1/admin/communications/:id | Read detail | Admin only |
| PATCH /api/v1/admin/communications/:id | Edit eligible draft | Admin only; define immutability after dispatch |
| POST /api/v1/admin/communications/:id/dispatch | Deliver communication | Do not implement until providers, recipient policy, consent, auditing, retry and approval are defined |
| GET /api/v1/admin/audit-events | Review privileged activity | Least privilege; minimize exposed data |

The current /admin/feedback URL shows Communications. Preserve it until route changes are approved. No feedback submission, private reports, surveys or real email delivery is implied.

## 6. Security-by-design requirements

1. **Identity/session:** the agreed approach is Express-managed JWT authentication/authorization. Before coding, review secure token storage, signing keys/rotation, issuer/audience/claims, access expiry, refresh storage/rotation, revocation, logout and concurrent sessions. Require HTTPS/TLS. If refresh credentials use cookies, apply Secure, HttpOnly, SameSite and CSRF protections as appropriate. Never bundle server secrets client-side.
2. **Password storage:** store only adaptive salted password hashes; never log/store raw passwords. Apply current OWASP guidance. Recovery must not reveal account existence.
3. **Authorization:** authenticate centrally; enforce role and resource ownership in service/repository queries on every protected action. Never trust client owner IDs or roles.
4. **Required isolation release gate:** create User A and User B; A owns a document. As B attempt list/detail/rename/move/archive/restore/delete/upload-completion/download using A's ID. Assert B cannot read or mutate the row/object and foreign metadata is not leaked through counts/search/errors. Repeat for folders and academic records. Separately prove students are denied every Admin endpoint.
5. **Validation/database:** validate format, length, enum, range, body size and request shape at server boundary. Parameterized SQL only. Normalize email and allowlist mutable fields; enforce DB constraints too.
6. **Abuse protection:** rate-limit login, signup, reset, verification, upload and communications. Bound pagination/search/body sizes and timeouts. Avoid account-enumeration signals.
7. **File safety:** Supabase Storage buckets must be private by policy. Express checks ownership before any upload/download authorization and uses only the approved server-side storage method; do not expose a service-role key. Validate actual bytes, not only filename/MIME; random keys, size/type limits, safe content disposition, malware quarantine/scanning policy and retryable cleanup before production.
8. **Safe errors/logs:** generic client errors plus request IDs. Never expose stack traces, SQL, secrets, tokens, passwords, file contents or unnecessary PII. Redact and limit logs.
9. **Admin:** no unrestricted public Admin role creation. Provision first Admin through approved operations; least privilege and audit sensitive access/actions. Shell and route visibility are not security.
10. **Secrets/deployment:** commit placeholder .env.example only; validate config without printing secrets. Supabase URL and server-only database/storage credentials must never enter the browser bundle; never expose a service-role key. Separate environment credentials. Never expose real secrets or create production services without explicit approval.
11. **Supabase RLS relationship:** Express authentication and authorization remain the application security boundary and must enforce role/ownership for every operation. RLS is an additional database defense only when policies and the Express database role are explicitly configured and tested. Do not assume RLS is enabled/configured by default. Do not expose a Supabase service-role key to the client. Test both API authorization and effective RLS behavior; decide how Express accesses rows under the chosen role/policy design.
12. **Email delivery security:** keep SendByte Africa as the planned primary and EmailJS as an unevaluated candidate secondary. The Express email adapter owns all provider calls. Enforce bounded retries/timeouts/rate limits, health checks, structured redacted logs, signed webhook verification and idempotent event processing. Reconcile uncertain provider outcomes before fallback to prevent duplicates. Do not log provider credentials or reset/verification tokens. Keep delivery disabled until provider/domain/backup/security approval.
13. **Privacy/recovery:** define verification, retention, export/deletion and object cleanup. Do not create paid resources or connect production services without approval.

Primary references: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html), [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [Express production security best practices](https://expressjs.com/en/advanced/best-practice-security/). Re-check evolving guidance before implementation.

## 7. Ordered implementation phases

Implement one coherent phase at a time. Report changed files, tests and outcomes, then stop for user review before the next phase. None of these phases is implemented by this roadmap.

### Phase 1 — Confirm remaining architecture and Supabase project decisions
**Prerequisite:** planning review. Decide whether an approved development Supabase project exists, region/data location, environment separation, server database connection/credentials, test database plan, RLS/backend role, private Storage policy, file limits/scanning/retention/deletion, backup/recovery and expected costs. Confirm JWT lifecycle details and deployment will be decided separately.  
**Likely artifacts:** approved decision records and API contract.  
**Checks/exit:** all trust boundaries, secrets, database/storage policies and API/error contracts reviewed. No project, database, bucket, paid service or credentials created.

### Phase 2 — Express skeleton and health endpoint
**Prerequisite:** Phase 1 decisions sufficient for local server setup.  
**Likely files:** server/package.json, server/src/app.js, server.js, config, health route, middleware, .env.example, tests.  
Create app factory, local startup/shutdown, validated config, request limits, HTTPS deployment assumptions, request IDs and generic errors.  
**Checks/exit:** health, unknown route, config and redaction tests; no secret output. Do not claim Supabase readiness before connection exists.

### Phase 3 — Express connection to Supabase PostgreSQL and migrations
**Prerequisite:** Phase 2 and approved development project/connection method/credentials.  
**Likely files:** server/src/db/pool.js, migrations, repositories, tests.  
Connect from Express using the approved server-only credential method; add migration runner, transaction helper and initial users/profile schema. pg and node-pg-migrate remain proposed pending approval. Do not install local PostgreSQL as the default.  
**Checks/exit:** migrations run reproducibly against an approved isolated development/test target; connection failure is not reported ready; secrets are never logged or exposed. RLS policies and the Express database role are tested as explicitly configured, not presumed.

### Phase 4 — Authentication and authorization
**Prerequisite:** phases 1–3; JWT lifecycle and controlled Admin provisioning approved.  
Implement Express JWT authentication, verification/recovery/change-password flows and role/ownership middleware. Admin uses the same identity system; role is assigned only through controlled provisioning.  
**Checks/exit:** expiry, refresh, revocation, logout, key handling, role spoofing, rate limits, recovery privacy and CSRF/storage implications are tested and reviewed. No actual email delivery until provider approval.

### Phase 5 — Student profiles, preferences and dashboard APIs
**Prerequisite:** authenticated identity.  
Implement own-profile read/update, notification preferences and defined dashboard/storage summaries; connect only the relevant frontend slice.  
**Checks/exit:** allowlists, validation, Alice/Bob isolation, per-user preferences and reconciled counts pass; no mock data presented as live.

### Phase 6 — Document folders and metadata
**Prerequisite:** phases 1–5 and approved category/folder/delete rules.  
Implement folders, document metadata CRUD, search/filter/sort/pagination, move, archive/restore and metadata deletion.  
**Checks/exit:** ownership tests, transaction invariants, archive/list behavior and bounded queries pass. File bytes remain outside PostgreSQL.

### Phase 7 — Private Supabase Storage and secure file flows
**Prerequisite:** approved Supabase project, bucket policy, connection/credential approach and file safety decisions.  
Integrate private Supabase Storage. Express authorizes uploads/downloads and validates metadata/object ownership; use short-lived access or server streaming per approved strategy. Implement object verification and retryable deletion.  
**Checks/exit:** spoofed type, size, expiry, cross-user access, private bucket policy and cleanup retry tests pass. No bucket/resource is created before approval.

### Phase 8 — Academic records
**Prerequisite:** auth/schema and approved fields/attachment decision.  
Implement own-record CRUD and type-dependent validation.  
**Checks/exit:** Alice/Bob isolation, CRUD, boundary tests and frontend regression pass.

### Phase 9 — Protected Admin APIs and audit logging
**Prerequisite:** controlled Admin provisioning, authorization, audit policy and metric definitions.  
Implement Admin dashboard, minimized student directory/detail, usage aggregation and audit events.  
**Checks/exit:** students denied every Admin endpoint; Admin access is authorized/audited; searches are bounded; aggregates reconcile without excess PII.

### Phase 10 — Communications drafts and email-service readiness
**Prerequisite:** Admin authorization and approved draft/recipient semantics. SendByte Africa is the planned primary transactional provider; EmailJS is only a candidate secondary, with other suitable providers open for evaluation.
Persist Communications drafts/history and define the provider-independent Express email-service/adapter contract used by authentication, verification and password recovery. Plan bounded retries, timeouts, rate limits, provider health, structured safe logs, accurate status tracking, signed webhook verification, idempotency and reconciliation of uncertain outcomes before fallback. Do not couple auth logic to a provider SDK.
Keep actual email dispatch disabled until provider configuration, domain authentication, backup/failover behavior and security tests are approved. Email credentials remain server-side.
**Checks/exit:** draft validation and access pass; adapter contract and delivery state model are reviewed; webhook signature/replay tests, duplicate-prevention and ambiguous-timeout/fallback tests pass before any sending is enabled. No UI or status claims real delivery while disabled.

### Phase 11 — Existing frontend integration and full application verification
**Prerequisite:** relevant API slices individually accepted.  
Replace mocks one at a time while preserving React/Vite/custom router, URLs and shells. Add loading/error/retry states and remove prototype labels only for data truly served by the backend. Decide application hosting separately.  
**Checks/exit:** full build, API/security tests, browser E2E desktop/mobile, user isolation, Admin role matrix, accessibility, backup/recovery and deployment checks pass. Report historical Windows/OneDrive build issue if it recurs.

## 8. Granular implementation checklist

| ID | Work | Prerequisite | Likely files | Definition of done |
|---|---|---|---|---|
| 1.1 | Confirm Supabase project, region, environments, roles/RLS, credentials, Storage, limits, backup/cost and JWT lifecycle | none | decision records | Open decisions listed in Section 11 resolved or explicitly deferred; no resources created |
| 2.1 | Add Express factory/startup, validated config, safe middleware and health | 1.1 | server package/app/server/config/routes | Health/config/unknown route/error tests; no secrets in output |
| 3.1 | Connect Express to approved Supabase PostgreSQL using server credentials | 2.1 and project approved | db pool/config | Connection is server-only; failure not presented as ready |
| 3.2 | Add approved migration tooling and initial schema | 3.1 | migrations/repositories | pg/node-pg-migrate decision recorded; migrations reproducible on isolated target |
| 3.3 | Configure and test RLS/backend database role relationship | 3.1–3.2 | Supabase SQL migrations/policies and integration tests | Actual policies/role verified; no assumption that defaults protect data |
| 4.1 | Implement JWT verification/signing and access-token policy | 3 | auth middleware/service/tests | Algorithms/key management/claims/expiry validated; no client-supplied role trust |
| 4.2 | Implement refresh, rotation, revocation and logout | 4.1 | auth/session storage/tests | Raw refresh tokens not persisted; replay/reuse/expiry/revoke cases tested |
| 4.3 | Implement student signup/login/recovery/verification | 4.1–4.2 | auth routes/tokens/tests | Password hashes only; generic recovery; rate limits; SendByte Africa is the planned primary transactional provider; EmailJS is a candidate secondary pending evaluation; actual email delivery remains disabled until required configuration, security and provider decisions are approved |
| 4.4 | Add controlled Admin provisioning and role tests | 4.3 | Admin auth/provisioning tests | Student cannot self-assign Admin; student denied Admin endpoints |
| 5.1 | Add profiles/preferences/dashboard endpoints | 4 | profile/dashboard modules | Allowlist, validation, current-user isolation and metric definitions pass |
| 6.1 | Implement folder/document metadata operations | 5 | folders/documents modules | Search/filter/sort/archive/move/delete metadata with owner scoping |
| 6.2 | Add mandatory Bob-versus-Alice document regression | 6.1 | security integration tests | Bob denied read/download/edit/delete, listing leakage and all other actions on Alice records |
| 7.1 | Add private Supabase Storage upload/download lifecycle | 1.1, 6.1 | storage adapter/routes/jobs | Object validation, owner authorization, private access and retryable deletion pass |
| 8.1 | Add academic-record schema and CRUD | 4 and field approval | academic module | Type-specific rules and Alice/Bob tests pass |
| 9.1 | Add Admin audit trail and protected read APIs | 4, Admin policy | Admin/audit modules | Student denied, Admin least privilege and audited sensitive reads/actions |
| 10.1 | Persist Communications drafts/history and define provider-independent Express email adapter | 9 | Communications module and email service contract | Draft behavior accurate; auth calls app adapter, not provider SDK; no email delivery or false delivered state |
| 10.2 | Evaluate SendByte Africa primary configuration and EmailJS/other secondary candidates; test delivery controls without enabling sending | 10.1 | server email adapters, config schema and isolated tests | Provider capabilities verified; timeout/uncertain result reconciliation prevents duplicates; signatures/rate limits/log redaction tested; provider/domain/backup/security approval recorded before enablement |
| 11.1 | Integrate accepted endpoints one frontend feature at a time | APIs accepted | targeted frontend modules | Existing routes and mock behavior preserved until each slice is replaced |
| 11.2 | Complete release verification and recovery review | integration complete | tests/deployment docs | Build/tests/browser, security, accessibility, backup and restore evidence recorded |

## 9. Verification strategy and existing build issue

Use layered verification:

1. Unit tests for validators, normalization, services and safe error mapping.
2. Integration tests against an isolated disposable PostgreSQL database for migrations, constraints and transactions.
3. API tests for status/error contracts, pagination, sessions, roles, ownership, rate limits and idempotency.
4. Mandatory User A/User B isolation test covering documents, folders and records, plus student denial of Admin APIs.
5. File lifecycle tests for spoofed MIME, size boundaries, expired upload target, wrong owner, private access and cleanup retry.
6. Frontend regression per connected slice: preserve every current URL/custom routing/shell and document interactions.
7. Accessibility/responsive checks for keyboard dialogs/navigation, focus, announcements and narrow layouts.
8. Operational checks for redacted logs, migration policy, health/readiness, backups, restore and deployment smoke tests.

The root package has no test/lint scripts. Prior builds reportedly stalled and encountered Windows/OneDrive EPERM realpath at src/main.jsx. This audit did not run npm run build, so current status is unknown. Diagnose the file-lock/OneDrive condition once before relying on a later build; capture output/exit code. A stalled build or existing dist/ is not a pass. No browser verification was performed for this roadmap.

## 10. Deferred scope

- **Version 2:** document sharing, share links/permissions, payments, subscriptions and storage upgrades/paid resources.
- **Deferred MVP:** Goals and Reminders.
- **Not currently implemented/approved backend features:** student Help & Feedback submission and private report history; Surveys (current Admin route is Communications); Admin Email Centre/provider mail delivery. Reassess only with product approval.
- Communications remain drafts until recipient groups, authorization, consent, delivery state, audit and retries are approved. SendByte Africa is the planned primary transactional email provider; EmailJS is a candidate secondary pending evaluation, and other suitable providers may be considered. Use a provider-independent Express adapter.
- Do not grant Admin through unrestricted public signup. The present Admin signup screen is frontend-only.
- Do not define storage quota or capacity percentages without product policy.
- Do not connect production email/storage or create paid resources as part of planning.

## 11. Supabase and architecture decisions still open

These items are unresolved. Do not infer approval or create resources from this roadmap.

1. Does an approved Supabase project already exist for development? If so, what is its project identity and how is approval documented?
2. Which Supabase region satisfies data-location requirements?
3. How will development, testing and production Supabase projects/environments be separated?
4. What secure server-side PostgreSQL connection method and credentials are approved for local development and deployment? How will they be rotated and supplied without source-control exposure?
5. What Express database role will be used? Which least-privilege grants are needed? Which RLS policies are required, who owns them, and how will tests verify the actual policies? How will server access work with RLS without exposing a service-role key?
6. What private Supabase Storage bucket policies apply? Will Express stream files or issue short-lived signed upload/download access only after authorization?
7. What file-size limits and allowed types apply? Is malware scanning/quarantine required, and what are retention/deletion rules?
8. What backup, point-in-time recovery and restore arrangements are available, and what expected costs/retention apply?
9. Which PostgreSQL client/migration tooling is approved? pg and node-pg-migrate are proposals only; should either be selected?
10. JWT details for review: signing algorithm/key storage and rotation, claims/audience/issuer, access-token lifetime, refresh-token storage and rotation, revocation, logout, concurrent sessions, and secure client storage. The JWT-based Express approach is agreed; these implementation details are not.
11. How will the first Admin be provisioned/revoked, and what actions require audit or approval?
12. Are categories fixed or user-managed? Can academic records attach documents?
13. What do notification preferences mean and which channels actually deliver?
14. For Communications, define recipient groups, permissions, draft review and consent/opt-out. SendByte Africa is the planned primary transactional provider; verify its API, delivery events, idempotency support, limits, webhook signature method, domain authentication and terms before configuration.
15. Evaluate EmailJS as a candidate secondary provider, including backend suitability, security, idempotency, webhooks, delivery tracking and failover behavior. Do not assume equivalence to SendByte Africa or automatic failover. Other suitable transactional providers may also be evaluated.
16. Define fallback triggers and reconciliation for ambiguous timeouts/provider outcomes. Which verified status mechanism proves the outcome, and when is fallback safe without duplicates?
17. Approve provider/domain configuration, SPF/DKIM/DMARC responsibilities, server-side secret management, bounded retries/timeouts/rate limits, provider health monitoring, webhook signature/replay protection and delivery-status semantics before enabling real sending. Email remains disabled until approval and security tests pass.
18. Define Admin metrics and date windows; whether any per-student usage may be exposed and under what audit/minimization rule.
19. Define account export/deletion, retention, privacy jurisdiction and object cleanup guarantees.
20. Keep /admin/feedback as the Communications URL or migrate later?
21. Application hosting is intentionally separate and will be decided later. Which test/deployment actions or resources need separate approval?

## 12. Source inventory reviewed

Project instructions: AGENTS.md, DESIGN.md, FRONTEND_PLAN.md. App setup/router: package.json, vite.config.js, index.html, src/main.jsx, src/App.jsx, src/routeConfig.js. Shared state/layout/styles: src/components/AppShell.jsx, src/modules/admin/components/AdminAppShell.jsx, src/hooks/useDialogFocus.js, src/styles.css, src/organization.css, src/profile-settings.css. Feature pages/data under src/modules/auth, dashboard, documents, academic-records, profile, settings and admin, plus src/data/mockProfile.js and src/pages/PlaceholderPage.jsx.

This inventory is an audit aid; confirm paths and references again before implementation.
