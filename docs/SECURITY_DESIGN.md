# Security Design

## Implemented in Phase 1

| Control | Where | Detail |
| --- | --- | --- |
| Security headers | `app.js` | `helmet()` defaults; `x-powered-by` disabled |
| CORS allow-list | `app.js`, `config/env.js` | Only origins in `CLIENT_ORIGINS` get `Access-Control-Allow-Origin`, with credentials |
| Body size limit | `app.js` | `express.json({ limit: '100kb' })` → `413 PAYLOAD_TOO_LARGE` |
| Rate limiting | `middleware/rateLimiter.js` | Baseline per-IP limit on all `/api` routes → `429 RATE_LIMITED` |
| Safe error handling | `middleware/errorHandler.js` | Standard envelope; fixed messages for parser and mongoose validation errors; no stack traces outside development; logs method, path and code only |
| Env validation | `config/env.js` | zod schema, fail-fast, key names only in errors; only module reading `process.env` (ESLint rule) |
| Secret hygiene | `.gitignore`, `.env.example` | `.env` ignored; examples hold placeholders only |

## Implemented in Phase 2

### Session cookie

| Attribute | Value |
| --- | --- |
| Name | `os_session` |
| Content | HS256 JWT `{ sub, role, collegeId, tv }` signed with `JWT_SECRET` (≥ 32 chars, required in development/production) |
| `HttpOnly` | always |
| `SameSite` | `Lax` |
| `Secure` | when `NODE_ENV=production` (`cookieSecure`) |
| `Path` | `/` |
| `Max-Age` | `JWT_EXPIRES_IN` (default `8h`), same value as the JWT `exp` |

The token is never placed in a response body or readable by client JavaScript. `authenticate` verifies the signature with an explicit algorithm allow-list, then reloads the user on every request; it rejects disabled users, `tokenVersion` mismatches and users of suspended colleges. Password change and account disable increment `tokenVersion`, which revokes every existing session.

CSRF: the API is cookie-authenticated and same-origin (Vite proxy in development; one Render service in production, ADR-015). `SameSite=Lax` stops cross-site `POST`/`PATCH` from carrying the cookie, all state-changing routes use non-GET methods, and every body must be `application/json` (cross-site forms cannot send that without a CORS preflight, which disallowed origins fail).

### Tenant isolation

- `collegeId` is taken **only** from `req.user.collegeId`, which `authenticate` loads from the database. `requireTenant` copies it to `req.tenant`; bodies containing `collegeId` fail `.strict()` validation.
- `repositories/tenantRepository.js` wraps college-owned models. `forTenant(collegeId)` throws `TenantScopeError` (→ 500) when `collegeId` is missing or malformed; `find`, `findOne`, `findById`, `count`, `updateOne`, `deleteOne` and `create` always AND/stamp the tenant's `collegeId` (overriding any `collegeId` in the filter), and updates that touch `collegeId` are refused.
- The only direct `User` model reads outside the repository are identity lookups that happen before a tenant is known (login by unique email, session reload by the id in the verified JWT, email-uniqueness checks) and the super admin's staff counts.
- `super_admin` has no tenant: it gets `403` on every college route (`/college/*`, `/staff/*`), and its own views never include students, cases or secrets.
- **404 for cross-tenant access:** a request for a specific record of another college returns `404 NOT_FOUND`, identical to a non-existent id, so other colleges' records cannot be confirmed to exist (ADR-014).

### Passwords

- bcrypt, cost 12. Policy: 10+ characters, at least one letter and one number, at most 72 bytes (bcrypt's input limit — longer inputs are rejected instead of silently truncated).
- Login returns one `401 INVALID_CREDENTIALS` body for unknown email, wrong password, disabled account and suspended college. When no account matches, a dummy bcrypt comparison runs so response time does not reveal whether the email exists.
- A new password must differ from the current one.

### Temporary passwords and join codes

- Staff accounts (TPO heads by the super admin, placement officers by a TPO head) get a 16-character random temporary password (crypto `randomInt`, letters + digits). It is returned **once** in the creation response, never stored in plain text or logged, and the account has `mustChangePassword=true`; `enforcePasswordChange` then allows only `GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout` (ADR-013).
- Each college has a student join code: 10 characters from an unambiguous alphabet, generated with `randomInt`, stored only as a bcrypt hash (`select: false`), returned **once** on creation and on rotation. Rotation invalidates the old code immediately. Registration rejects an unknown college, wrong domain or wrong join code with one generic `400 REGISTRATION_REJECTED`; registration-time email-existence checks only run after the join code is accepted, limiting account enumeration to people who hold the code.
- The client shows these values in a "shown only once" panel with a copy button and never stores them.

### Rate limits

| Limiter | Scope | Default |
| --- | --- | --- |
| Baseline | all `/api` | 300 requests / 15 min / IP |
| Auth | `POST /auth/login` and `POST /auth/register` (shared counter) | 10 requests / 15 min / IP (`AUTH_RATE_LIMIT_*`) |

Both answer `429 RATE_LIMITED`.

### Audit log

Services append `AuditLog` entries after successful actions: `auth.register`, `auth.password_change`, `college.create`, `college.update`, `college.join_code_rotate`, `staff.create`, `staff.status_change`. Each records `collegeId`, actor id and role, entity, IP and non-secret metadata; metadata keys resembling passwords, hashes, tokens, secrets or join codes are stripped. The model is append-only: update, replace and delete query hooks, document `updateOne`/`deleteOne`, `bulkWrite` and re-saves all throw. No API route modifies audit entries.

### Other hardening

- Mongoose `strictQuery` is on; request bodies are parsed by strict zod schemas into plain values, so query operators cannot be injected through them.
- Seed scripts never print passwords or the super admin email, refuse demo seeding in production, and print only error names for driver errors (which can contain host names). The server never logs `MONGODB_URI` and exits with code 1 if it cannot connect.
- Tests never read `server/.env` and use `mongodb-memory-server` only (ADR-011).

## Known limitations

- **No email OTP verification in the MVP.** Student registration is controlled by the college email domain plus the college's join code (the pilot control, ADR-012). Someone who knows the join code could register with an address on the college's domain that they do not own. Mitigations: rotate the join code, disable accounts, add email verification later.
- No password reset by email; staff passwords are reset by re-creating access (planned later).
- Logout clears the cookie but does not revoke a copied token before it expires (≤ 8 h). Password change or disabling the account does revoke it.
- Rate-limit state is in memory per process and `trust proxy` is not configured yet; both are set in Phase 7 (Render deployment).

## Rules for later phases (mandatory)

1. `collegeId` comes from the session only.
2. Every college-owned query goes through `tenantRepository`.
3. Students see only their own cases (filter by `studentId` as well as `collegeId`).
4. Staff see only their own college; `super_admin` gets no routine access to case content.
5. Internal notes live in `notes`; student-facing endpoints never query it, and responses use explicit field allow-lists.
6. Only `tpo_head` records final decisions, with a mandatory reason.
7. Indicators are created only from authorised decisions.
8. Audit important admin actions through `audit.service`.
9. Private evidence: validated uploads (content-sniffed MIME type, extension allow-list, size limit), stored in GridFS, served only after an access check.
10. Never fetch user-submitted URLs (SSRF).
11. No Aadhaar/PAN collection.
12. Allegations are never shown as confirmed fraud.
13. Automated checks assist only.
14. Cross-college isolation tests are required for every feature touching college-owned data (404 for another college's records).
