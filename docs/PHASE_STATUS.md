# Phase Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: monorepo, Express API with health endpoint, security baseline, validated config, React client shell, tests, docs | **Passed (architect-reviewed 2026-11-10)** |
| 2 | MongoDB, authentication, four roles, college tenancy and isolation, staff management, append-only audit log, seed scripts | **Passed (architect-reviewed 2026-11-10)** |
| 3 | Student verification requests, evidence (GridFS), indicator extraction | **Implemented — awaiting architect review** |
| 4 | Case desk, decisions, audit views | Not started |
| 5 | Registry, lookup, linking, warning signals | Not started |
| 6 | Advisories, notifications, stats | Not started |
| 7 | Security test suite, deployment (one Render web service), docs | Not started |

## Phase 3 — details

**Status:** Implemented — awaiting architect review (not yet passed).

### Implemented

- Models `Counter`, `Case` (full schema for Phases 4–5), `CaseEvent`, `Evidence`; GridFS bucket `evidence`; shared constants (`CLOSED_STATUSES` etc.).
- Student API: create (strict schema, privacy guard, indicator extraction, per-college case numbers, priority, per-user rate limit), list own (paginated), detail (student serializer, visible events, evidence list), reply (re-extraction, awaiting_student → under_review).
- Evidence: multer memory upload (5 × 3 MB per request, 10 per case), magic-byte validation, JPEG/PNG metadata stripping, SHA-256, GridFS storage with tenant metadata, `evidence_added` events, audit.
- Short-lived evidence links (derived key, 300 s default) + session-bound download with nosniff, no-store, CSP sandbox and disposition headers; staff of the same college can open evidence; audit `evidence.access`.
- Privacy guard: PAN and Verhoeff-validated Aadhaar → `SENSITIVE_ID_DETECTED`.
- Indicator extraction (email, domain incl. IDN→punycode and allow-listed bare domains, URL, Indian mobile, UPI), dedup with student_entered precedence.
- Client: student home action cards, New request (sections, privacy banner, list inputs, file checks, consent), My requests (status labels, filter), Request detail (summary, money, indicators, evidence View, timeline, reply, add evidence).

### Tests executed (2026-11-10, Node v22.13.1, MongoDB 8.2.6 in memory)

| Command | Result | Exit code |
| --- | --- | --- |
| `npm run test:server` | Test Suites: 13 passed, 13 total; Tests: 145 passed, 145 total | 0 |
| `npm run test:client` | Test Files 4 passed (4); Tests 19 passed (19) | 0 |
| `npm test` | 145 server + 19 client passed, 0 failed | 0 |
| `npm run lint` | ESLint 0 problems; oxlint 0 warnings, 0 errors | 0 |
| `npm run build` | `client/dist` produced | 0 |
| Smoke (HTTP through the Vite proxy against Atlas, demo accounts) | steps 1–7 as specified (see final report) | — |

### Limitations

- PDFs not sanitised; images not re-encoded; no malware scan (see SECURITY_DESIGN.md).
- No staff case views yet (Phase 4); staff can only open evidence by link.
- Smoke steps were exercised over HTTP through the dev proxy rather than by clicking in a browser.

## Phase 2 — details

**Status:** Passed (architect-reviewed 2026-11-10).

### Implemented

- Mongoose 9 connection (`config/db.js`); `server.js` connects before listening and exits 1 on failure without printing the URI. Health reports `database: "connected" | "disconnected"`.
- Config: `MONGODB_URI` and `JWT_SECRET` required in development/production; `JWT_EXPIRES_IN` (8h), `AUTH_RATE_LIMIT_WINDOW_MS` (900000), `AUTH_RATE_LIMIT_MAX` (10), seed keys, derived `cookieSecure`.
- Models `College`, `User`, `AuditLog` (append-only hooks) — see DATA_MODEL.md.
- `tenantRepository` with `forTenant(collegeId)`; 404 for cross-tenant records.
- Cookie auth (`os_session`, httpOnly, SameSite=Lax, Secure in production), bcrypt cost 12, password policy, `tokenVersion` revocation, generic login errors, suspended-college blocking, strict auth rate limiter.
- Middleware `authenticate`, `requireRole`, `requireTenant`, `enforcePasswordChange`, `authRateLimiter`, `validateBody`.
- Routes: auth (register, login, logout, me, change-password), super admin (colleges CRUD-lite, join-code rotation, TPO heads, staff list), college (`/college/me`), staff (members, officers, officer status) — see API_CONTRACT.md.
- Seed scripts `seed:superadmin` and `seed:demo` (idempotent; no secrets printed; demo refuses production).
- Client: `AuthProvider`/`useAuth`, `ProtectedRoute`, Login, Register, Change password, Forbidden, Student home, Staff home, Staff members, Admin colleges, Admin college detail; header with name, role and logout; one-time secret panel with copy button.

### Tests executed (2026-11-10, Node v22.13.1, npm 10.9.2, MongoDB 8.2.6 in memory)

| Command | Result | Exit code |
| --- | --- | --- |
| `npm run test:server` | Test Suites: 8 passed, 8 total; Tests: 85 passed, 85 total | 0 |
| `npm run test:client` | Test Files 3 passed (3); Tests 13 passed (13) | 0 |
| `npm test` | 85 server + 13 client passed, 0 failed | 0 |
| `npm run lint` | ESLint: 0 problems; oxlint: 0 warnings, 0 errors | 0 |
| `npm run build` | `client/dist` produced | 0 |
| `npm run seed:superadmin -w server` (twice, Atlas) | created, then "already exists; nothing changed" | 0 |
| `npm run seed:demo -w server` (twice, Atlas) | 2 colleges + 8 users created, then all "exists" | 0 |
| Smoke via `npm run dev` (HTTP through the Vite proxy) | health `connected`; super admin login → `super_admin`, `/admin` served; alpha TPO head sees only alpha staff; new demo-alpha student registered (201) | — |

### Limitations

- No email OTP: join code + college email domain is the pilot registration control (ADR-012).
- No password reset; logout does not revoke a copied token before expiry (password change/disable does).
- Rate-limit store in memory; `trust proxy` not set (Phase 7).
- Smoke steps 2–4 were exercised over HTTP through the dev proxy rather than by clicking through a browser.

## Phase 1 — details

**Status:** Passed (architect-reviewed 2026-11-10).

- npm workspaces monorepo; Express 5 API (CommonJS) with `app.js`/`server.js` split; helmet, CORS allow-list, 100 kb JSON limit, baseline rate limiter, standard error envelope; zod-validated frozen config; `GET /api/v1/health`.
- React 19 + Vite 8 + Tailwind v4 client shell with HealthStatus and a single axios instance.
- Tests at sign-off: server 18/18, client 5/5; build and lint exit 0.

**Next authorised phase:** none until architect approval of Phase 3.
