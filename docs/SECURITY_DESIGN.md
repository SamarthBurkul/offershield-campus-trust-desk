# Security Design

## Implemented in Phase 1

| Control | Where | Detail |
| --- | --- | --- |
| Security headers | `app.js` | `helmet()` defaults (CSP, `X-Content-Type-Options: nosniff`, frame protection, etc.); `x-powered-by` disabled |
| CORS allow-list | `app.js`, `config/env.js` | Only origins in `CLIENT_ORIGINS` get `Access-Control-Allow-Origin`, with credentials; other origins get no CORS headers and no error |
| Body size limit | `app.js` | `express.json({ limit: '100kb' })` → `413 PAYLOAD_TOO_LARGE` |
| Rate limiting | `middleware/rateLimiter.js` | Baseline per-IP limit on all `/api` routes → `429 RATE_LIMITED` |
| Safe error handling | `middleware/errorHandler.js` | Standard envelope; fixed messages for parser errors (native messages can echo body content); no stack traces outside development; logs method, path and code only — never request bodies or headers |
| Env validation | `config/env.js` | zod schema, fail-fast at startup, errors list key names only (never values); `process.env` read only in this module (ESLint rule) |
| Secret hygiene | `.gitignore`, `.env.example` | `.env` files ignored; examples contain placeholders only |

## Rules for later phases (mandatory)

1. **`collegeId` comes from the session only.** It is never accepted from the request body, query string or URL params.
2. **Tenant isolation on every query.** Every repository function for a college-owned collection requires and filters by `collegeId`. No unscoped queries.
3. **Students see only their own cases** (filter by `studentId` = session user as well as `collegeId`).
4. **Staff see only their own college.** Placement officers and TPO heads are confined to their `collegeId`; `super_admin` does not get routine access to case content.
5. **Internal notes are separate.** Notes live in the `notes` collection; student-facing endpoints never query it, and responses are built from explicit field allow-lists.
6. **Only authorised TPO roles record final decisions** (`tpo_head`), and a reason is mandatory.
7. **Indicators are created only from authorised decisions.** Confirmed indicators trace back to a recorded decision (`decisionId`, `sourceCaseId`).
8. **Audit important admin actions** (decisions, registry changes, advisories, role changes, user status changes) in an append-only `auditLogs` collection.
9. **Private evidence.** Uploads are validated (MIME type sniffed from content, extension allow-list, size limit, randomised storage names), stored outside the public web root, and served only through short-lived, authorised links after an access check.
10. **No fetching of user-submitted URLs (SSRF prevention).** URLs in requests are stored and displayed as inert text; the server never requests them.
11. **No Aadhaar/PAN collection.** Forms and validators reject such fields; evidence guidance tells students to redact them.
12. **Allegations are never shown as confirmed fraud.** UI and API distinguish "reported" from "confirmed by the TPO"; only decided, confirmed findings appear as confirmed in the registry.
13. **Automated checks assist only.** They produce findings for staff and never set a decision.
14. **Cross-college isolation tests are required** for every feature that reads or writes college-owned data (a user of college A must get 404/403 for college B's resources).

## Planned authentication (Phase 2)

- JWT in an httpOnly, `Secure` (in production), `SameSite=Lax` cookie; no tokens in `localStorage`.
- Passwords hashed with a slow adaptive hash.
- Stricter rate limits on login and submission endpoints.
- CSRF considerations reviewed when cookie auth is introduced (same-origin deployment plus `SameSite`, and a CSRF token if cross-site use is ever needed).

## Known Phase 1 gaps

- `trust proxy` is not configured; behind a reverse proxy the rate limiter would see the proxy IP. To be set when deployment is defined.
- Rate-limit state is in memory (per process); a shared store is needed for multiple instances.
