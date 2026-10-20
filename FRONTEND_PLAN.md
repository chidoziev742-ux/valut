# Student Vault Frontend Plan

## Purpose and rules
This document records the approved MVP screen inventory and the phased frontend implementation sequence. Preserve the approved dashboard and the design system in DESIGN.md: forest green, warm cream, restrained gold/coral, readable typography, clear spacing, visible focus, and responsive layouts. Values remain guided by DESIGN.md and its adjustable initial tokens.

## Approved screen inventory

1. **Authentication and onboarding** — welcome/onboarding, sign up, login, forgot password, reset password, email/identity verification, and student profile setup.
2. **Student dashboard** — approved dashboard with overview metrics, recent documents, quick actions, categories, and storage overview presentation.
3. **Document management** — document library, upload flow, preview, details, search, filtering, sorting, rename, download, archive, and delete with confirmation.
4. **Folders, categories and academic records** — folder browsing/creation/management, category management, and academic record list, add, view, and edit flows.
5. **Student profile and settings** — profile, preferences/settings, notifications, and storage overview.
6. **Admin interface** — admin dashboard, student management, usage overview, and feedback/survey screens.
7. **Shared application states** — consistent empty, loading, error, success, validation, and confirmation states across screens, including responsive navigation and accessible feedback.

## Eight implementation phases

Each phase is a reviewable frontend increment. Add focused tests for the phase and run the relevant checks before requesting review. Sample records and simulated outcomes must remain visibly identified as prototype data and behavior.

### Phase 1 — Routing and shared application shell
Add client-side routes, responsive navigation, shared page/layout primitives, and a route structure for the approved screen inventory. Keep the existing dashboard design and visual language intact.

**Exit checks:** every planned destination resolves to an intentional route or an explicitly staged placeholder; navigation and browser back/forward work; shell adapts to narrow and wide viewports; the approved dashboard remains represented; keyboard focus and active navigation are clear.

### Phase 2 — Welcome, authentication and onboarding
Build the welcome, sign-up, login, forgot-password, reset-password, verification, and student profile setup screens. Validate form inputs in the browser and show designed validation, pending, error, and success states as simulations.

**Exit checks:** each flow can be traversed and returned from using frontend-only sample state; invalid inputs receive accessible feedback; successful-looking states are explicitly prototype simulations and do not imply an account, email, password reset, or verification actually exists.

### Phase 3 — Student dashboard
Refine the approved dashboard as the signed-in student landing screen. Move illustrative records into clearly identified mock data and make dashboard links/actions navigate to the relevant frontend destinations or explain that an action is not yet implemented.

**Exit checks:** the approved desktop/mobile visual hierarchy is preserved; sample metrics and profile data are labeled; no control implies real persistence, upload, authentication, sharing, or storage; dashboard states have empty/loading/error presentation where relevant.

### Phase 4 — Document library and retrieval
Build the document list/library, document search, filters, and sorting using mock data. Include relevant empty, no-results, loading, and error presentations.

**Exit checks:** search, filters, and sort work predictably against sample records; clear/reset behavior works; results and no-results states are accessible; narrow screens do not require horizontal scrolling; no search result is represented as server data.

### Phase 5 — Document lifecycle and detail flows
Build upload, preview, document details, rename, download, archive, and delete interactions, including file selection feedback and confirmation states. Keep all resulting operations simulated and clearly labeled; do not create fake backend APIs.

**Exit checks:** controls lead to complete prototype flows with validation and confirmation; cancel paths preserve current sample state; any local file selection clearly states it is not uploaded or stored; no action claims to have downloaded, archived, renamed, or permanently deleted a real document; error and success states are distinguishable and accessible.

### Phase 6 — Folders, categories and academic records
Build folder browsing and management, category management, and academic record list/add/view/edit screens using mock data.

**Exit checks:** users can navigate the sample folder/category/record flows and see coherent empty, validation, confirmation, and feedback states; sample counts and records remain identified as illustrative; responsive and keyboard behavior is consistent with the shared shell.

### Phase 7 — Student profile, settings, notifications and storage overview
Build student profile and settings/preferences, notification screens, and storage overview. All preferences, notifications, and storage figures remain frontend simulations.

**Exit checks:** settings and notification controls provide clear simulated outcomes; storage numbers are labeled illustrative and do not claim actual quota or usage; forms provide accessible validation and feedback; the flows work at mobile and desktop widths.

### Phase 8 — Admin interface and frontend acceptance review
Build the admin dashboard, student management, usage overview, and feedback/survey screens. Complete a cross-phase acceptance pass for navigation, states, responsiveness, accessibility, visual consistency, and test coverage.

**Exit checks:** admin destinations and primary sample workflows are navigable; student/admin screens are clearly identified as prototypes and do not imply real privileges or data access; all in-scope screens have appropriate empty/loading/error/success/confirmation states; focused tests and responsive/accessibility checks pass; remaining limitations are documented before frontend completion is proposed.

## Explicitly deferred

- **Goals and reminders:** excluded from the approved MVP unless separately approved later.
- **Shared Files and document sharing:** excluded. The dashboard Shared Files concept is not an implemented feature; do not imply access to files shared by other users.
- **Payments and subscriptions:** excluded. Do not build checkout, billing, paid tiers, or paid-resource integrations.

## Fixed technology and design system

Use React with Vite, JavaScript (not TypeScript), standard CSS with custom properties, and lucide-react where appropriate. Follow the existing design system in DESIGN.md and preserve the approved dashboard direction. Do not introduce Tailwind CSS or change the stack without explicit approval.

## Frontend-only boundaries

Use clearly labeled mock data and simulated interactions for this frontend milestone. Do not claim or imply real authentication, account verification, password changes, backend/API behavior, database persistence, cloud storage, private uploads, sharing permissions, actual storage measurements, admin authorization, or email delivery. Do not add fake backend APIs or hardcode secrets. Keep boundaries visible in UI copy and implementation notes. Backend services and integrations belong to a later, separately reviewed phase.

## Security requirements carried into backend development

- Treat browser inputs, uploaded files, identifiers, and storage references as untrusted. Validate and normalize all untrusted input on the server.
- Require authentication for protected operations and enforce authorization on **every protected resource and action**, including list/read, upload, preview/download, update/rename, archive, and delete. Derive ownership from the authenticated server-side identity, not a client-supplied user ID; scope database and object-storage operations to that owner.
- Keep secrets server-side and out of source control, client bundles, logs, and examples. Use safe error responses that do not disclose private data belonging to another user or whether their document exists. Add suitable abuse protection and upload restrictions.
- Add and run an authorization test proving **User B cannot access User A documents** through listing, viewing, downloading, updating, or deleting them. Add equivalent ownership checks for future protected resources.

## Review cadence and phase approval

Implement **one phase at a time**. Before each phase, state its goal and expected files/behavior. At the end, report changed files, tests/checks run and their results, and remaining issues. Stop and wait for the user review and explicit approval before beginning the next phase. Do not start backend development as part of this frontend plan.
