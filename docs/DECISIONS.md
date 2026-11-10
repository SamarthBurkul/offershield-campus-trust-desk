# Architecture Decision Records

## ADR-001: npm workspaces monorepo

- **Context:** Client and server are developed together by a small team and change in step.
- **Decision:** One repository with npm workspaces `client` and `server`; the root orchestrates scripts and holds only `concurrently`.
- **Consequence:** One `npm install`, one lockfile, shared scripts. Each package keeps its own dependencies, so either can be deployed separately later.

## ADR-002: CommonJS on the server

- **Context:** Jest's native ESM support still requires experimental Node flags.
- **Decision:** The server uses CommonJS (`require`, `"type": "commonjs"`). The client stays ESM (Vite).
- **Consequence:** Jest and Supertest run with no flags or transforms. Pure-ESM-only packages would need dynamic `import()`; none are used.

## ADR-003: Express 5

- **Context:** Express 5 is the current stable major version.
- **Decision:** Use Express 5.x.
- **Consequence:** Rejected promises in async handlers reach the error handler automatically; path syntax follows path-to-regexp v8 (e.g. no bare `*` wildcards). The 404 handler is a terminal middleware, so no wildcard route is needed.

## ADR-004: Tailwind CSS v4 via the Vite plugin

- **Context:** Tailwind v4 ships a first-party Vite plugin and no longer needs PostCSS or a config file for basic use.
- **Decision:** Use `tailwindcss` + `@tailwindcss/vite`, with `@import 'tailwindcss';` in `src/index.css`.
- **Consequence:** No `tailwind.config.js` or `postcss.config.js`. Theme customisation, when needed, goes in CSS (`@theme`).

## ADR-005: Vite dev proxy for same-origin API calls

- **Context:** Auth will use httpOnly cookies; cross-origin cookies in development need extra `SameSite=None`/HTTPS setup.
- **Decision:** The client calls relative `/api/v1` URLs; Vite proxies `/api` to `http://localhost:5000` in development.
- **Consequence:** The browser treats the API as same-origin. Production should also serve both from one origin; CORS stays as a strict allow-list for any other origin.

## ADR-006: JWT in httpOnly cookies (planned, Phase 2)

- **Context:** Tokens in `localStorage` are readable by any injected script.
- **Decision:** Issue a signed JWT in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie. `JWT_SECRET` is already declared as an optional, validated (≥ 32 chars) config key.
- **Consequence:** Client JS never handles tokens; axios uses `withCredentials: true`. CSRF exposure is limited by same-origin deployment and `SameSite`, reviewed in Phase 2.

## ADR-007: No recruiter self-registration in the MVP

- **Context:** Letting recruiters create their own records would let bad actors present themselves as trusted.
- **Decision:** Recruiter records are created only by authorised college staff from reviewed cases or TPO entry.
- **Consequence:** No recruiter accounts or portal in the MVP (listed as deferred).

## ADR-008: Automated checks assist only

- **Context:** Automated judgements of "fraud" can be wrong and defamatory, and the college is accountable for its findings.
- **Decision:** Automated checks (registry matches, duplicates, format checks) only produce findings for staff. Only a `tpo_head` records a final decision, with reasons.
- **Consequence:** No AI or automated labelling decides outcomes; UI never presents an allegation as confirmed fraud.

## ADR-009: Client linting with oxlint

- **Context:** The current Vite React template (create-vite 9) ships oxlint, not ESLint, as its linter.
- **Decision:** Keep the template's oxlint (with its React rules-of-hooks rule) for the client; use ESLint 10 flat config for the server as specified.
- **Consequence:** Two linters, each a single dev dependency. The server ESLint config also forbids `process.env` outside `config/env.js`. The client could be moved to ESLint later if shared rules are needed.

## ADR-010: Extra dev dependencies `@eslint/js` and `globals`

- **Context:** ESLint 10 flat config does not bundle the recommended rule set or Node/Jest global definitions.
- **Decision:** Add `@eslint/js` and `globals` as server dev dependencies.
- **Consequence:** Two small, official dev-only packages; no runtime impact.
