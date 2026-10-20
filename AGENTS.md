# Student Vault — Project Guide

## Purpose and MVP
Student Vault helps students organize, find, and manage university documents and academic records scattered across email, messaging apps, devices, cloud drives, and paper. Tagline: “Your university life, organized in one place.”

The MVP should support account registration and sign-in; a private document library with upload, listing, search/filter, metadata, preview/download, and deletion; and basic academic record organization. Keep uploaded binaries in private cloud/object storage and store document metadata and storage references in PostgreSQL. Build only the features needed for this scope; confirm larger product decisions with the user.

## Fixed stack
Use PostgreSQL, an Express.js API, React with Vite, Node.js, JavaScript (not TypeScript), normal CSS (not Tailwind), JWT authentication, and private cloud/object storage for document binaries. PostgreSQL holds metadata, never file binaries. Do not replace or add a core stack technology without the user’s permission.

## Development workflow
- Work in small, reviewable steps. Before each step, state its goal and the files or behavior it affects.
- Explain meaningful implementation choices and tradeoffs in plain language.
- Add or update focused tests for changed behavior, and run the relevant tests before reporting completion. Keep test output and failures clear; do not claim checks passed unless they ran.
- Review the resulting changes for security, accessibility, responsiveness, and consistency before finishing.
- Do not create, edit, or run unrelated work as part of a change.

## Security requirements
- Apply security by design in every layer. Treat browser input, uploaded files, API requests, and stored references as untrusted.
- Require authentication and enforce authorization on every protected resource and action, including reads, uploads, downloads, edits, and deletion. Scope document queries and storage operations to the authenticated owner; never rely on client-supplied user IDs for ownership.
- Validate and normalize all untrusted inputs on the server, including parameters, query strings, request bodies, and file metadata/content. Use safe database query mechanisms. Restrict upload types and sizes, and use private storage with short-lived authorized access where needed.
- Return safe, consistent errors. Do not leak secrets, stack traces, private metadata, or whether another user’s document exists. Add abuse protection appropriate to the endpoint, including rate limits for authentication and other sensitive actions.
- Keep secrets in environment configuration, never in source control, client bundles, logs, or examples. Provide safe placeholders in documentation; validate required configuration at startup and avoid exposing server-only values to the frontend.
- Include an authorization test proving user B cannot list, view, download, update, or delete user A’s documents. Add equivalent ownership checks for newly introduced protected resources.

## UI and code quality
Build responsive interfaces for narrow and wide screens. Meet accessibility basics: semantic structure, keyboard operation, visible focus, labeled controls, useful error announcements, and readable contrast. Prefer reusable components with clear responsibilities. Keep CSS normal, organized, scoped to components or feature areas, and based on the tokens and conventions in DESIGN.md.

## Approval boundaries
Never delete or overwrite existing work without approval. Never create paid resources, connect production services, or expose real secrets without explicit approval. Do not infer approval from a request to build a feature.
