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

## Implemented in Phase 3

### Evidence validation by content

- Files are parsed by multer into memory with hard limits (5 files × 3 MB, no text fields) **after** the route has checked that the caller owns the case and it is open, so non-owners cannot make the server buffer uploads.
- `utils/fileSignature.js` identifies the type from magic bytes only: PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, PDF `%PDF-`. The client's filename and MIME type are ignored; anything else is `400 UNSUPPORTED_FILE_TYPE` (ADR-019). If any file in a request fails, nothing is stored.
- Stored names are sanitised (basename only, `[A-Za-z0-9 _-]`, extension from the detected type, ≤ 100 chars), so they are safe in `Content-Disposition`.

### Metadata stripping

`utils/stripImageMetadata.js` (pure JS, no image library, ADR-020) rewrites the container without decoding pixels:

- JPEG: drops APP1 (EXIF, XMP — GPS location, device serials) and APP13 (Photoshop/IPTC) segments; everything from SOS (start of scan) onwards is kept verbatim.
- PNG: drops `eXIf`, `tEXt`, `iTXt`, `zTXt` chunks; other chunks are copied with their CRCs intact.
- Structurally invalid images are rejected (`UNSUPPORTED_FILE_TYPE`).
- PDFs are **not** sanitised (`metadataStripped=false`) and are only ever served as downloads (`Content-Disposition: attachment`) inside a CSP sandbox (ADR-021).

The SHA-256 is computed over the stored (stripped) bytes.

### GridFS privacy

- Evidence bytes live in the GridFS bucket `evidence` in the same database, not on disk or a public bucket. Each GridFS file carries `metadata.collegeId` and `metadata.caseId`.
- No route addresses GridFS ids. Files are reached only through an `Evidence` document loaded via the tenant repository and matched to the case; `gridFsId` and `sha256` are never sent to students.

### Two-factor download (short link + session)

1. `POST /cases/:id/evidence/:evidenceId/link` checks access (owner student, or same-college staff; super admin 403; others 404) and returns `/api/v1/files/<token>`. The token is an HS256 JWT `{ eid, cid, uid, purpose: "evidence" }` signed with a key **derived** from `JWT_SECRET` via HMAC-SHA256 with the label `offershield:evidence-link:v1`, so it can never be used as a session token (or vice versa). Lifetime `EVIDENCE_LINK_TTL_SECONDS` (default 300 s).
2. `GET /files/:token` additionally requires a valid session whose user id equals `uid`, and re-checks that this user may still see the case and that the evidence belongs to it. A leaked link is useless without the owner's session; a stolen session cannot open files without a fresh link (ADR-022).

Each successful download is audited (`evidence.access`: actor, evidence id, case id — never the token or contents).

### Download response headers

`Content-Type` = stored (detected) MIME type; `X-Content-Type-Options: nosniff`; `Cache-Control: no-store`; `Content-Security-Policy: sandbox` (overrides helmet's page CSP: no scripts, forms, plugins or same-origin access even if a crafted file is rendered); `Content-Disposition: attachment` for PDF and `inline` for PNG/JPEG with the sanitised filename.

### Privacy guard (Aadhaar / PAN)

`utils/privacyGuard.js` returns `400 SENSITIVE_ID_DETECTED` for case creation (message, note, company, role, contacts) and replies containing:

- a PAN: `[A-Z]{5}[0-9]{4}[A-Z]`, case-insensitive, as a standalone token;
- an Aadhaar number: 12 digits, first digit 2–9, optionally grouped 4-4-4 with one consistent space or hyphen, not preceded by `+` or a digit and not followed by a digit, **and** passing the Verhoeff checksum (`utils/verhoeff.js`). The checksum keeps random 12-digit references and `+91` phone numbers from being rejected.

The message asks the student to remove or mask the number; the matched value is never echoed in the response or written to logs. The UI also shows a banner asking students not to type or upload Aadhaar/PAN and to crop IDs out of screenshots.

### No URL fetching

Links, domains, emails, phones and UPI IDs are processed as strings only (`services/indicators/`). The server makes no HTTP request, DNS lookup or preview for submitted values; a test spies on `fetch`, `http.request`, `https.request` and `dns.lookup` during creation and reply. IDNs are converted to punycode with `url.domainToASCII` (no network). In the UI, indicators and links are shown as inert text, not anchors.

### Student serializer

Students only receive `toStudentCaseView` / `toStudentCaseSummary` / `toStudentEventView` / `toStudentEvidenceView` (`utils/caseViews.js`), built from explicit allow-lists. Excluded: `assigneeId`, `priority`, `signals`, `linkedCaseIds`, `decision.decidedBy`, staff ids, events with `visibleToStudent=false`, `gridFsId`, `sha256`. `CaseEvent.visibleToStudent` is required with no default, so every writer must decide.

### Other Phase 3 controls

- Strict schemas reject `collegeId`, `studentId`, `status`, `priority`, `assigneeId` and `decision` in bodies.
- Per-student creation limit (`CASE_CREATE_LIMIT_PER_HOUR`, keyed by user id, not IP, because campus networks share IPs).
- Closed cases accept no replies or evidence (`409 CASE_CLOSED`).
- Audit: `case.create`, `case.student_message`, `evidence.upload`, `evidence.access`.

## Implemented in Phase 4

### Internal notes are a separate collection

Staff notes live in `notes` (append-only, same plugin as the audit log). No student-facing route, service or serializer imports the Note model or `noteRepository`; notes are never joined into, embedded in or serialized with student data. Recommendations live on the case but are only serialized by `toStaffCaseView`, and `recommendation_made` events are always `visibleToStudent=false`.

### Serializer rules

| Field | Staff (`toStaffCaseView`) | Student (`toStudentCaseView`) |
| --- | --- | --- |
| Offer, contacts, money, indicators, status | yes | yes |
| priority, isStale, assignee, student identity | yes | no |
| recommendation | yes | no |
| decision | full (basis, checks, indicators, domains, dismiss reason, duplicate, decidedBy) | only `{ type, decidedAt, message }` |
| decisionHistory, reopen reasons | yes | no |
| signals, linkedCaseIds | yes | no |
| events | all, with `visibleToStudent`, actor and metadata | only `visibleToStudent=true`, no metadata, actor reduced to student/placement_cell/system |
| notes | yes (separate array) | never |
| evidence | name, mime, size, sha256, metadataStripped | name, mime, size |
| gridFsId | never | never |

Tests serialize the student response to JSON and assert note text, recommendation basis, decision basis, checks, `decidedBy` and the reopen reason are absent.

### Decision authority

Only `tpo_head` may record decisions (all four types) and reopen cases (route-level `requireRole('tpo_head')`; officers get 403). Officers and heads can recommend. See ADR-024.

### Atomic state transitions

`services/caseStateMachine.js` defines which trigger may move which status to which. Every transition is one `findOneAndUpdate` through the tenant repository with `status: { $in: allowedFrom }` in the filter. If nothing matches: 404 when the case is not in this college, otherwise 409 (`CASE_CLOSED` or `INVALID_TRANSITION`). Two concurrent decisions therefore cannot both succeed (tested with `Promise.all`). Final statuses can only be produced by the decision trigger; the status endpoint's schema accepts only `under_review`; reopen is the only way out of a final status and also matches the current `decision.decidedAt` (ADR-027).

### Tenant isolation on the desk

`collegeId` always comes from `req.user`. Every `/staff/cases/:id*` endpoint returns 404 for another college's case and leaves it unchanged (table-driven test). Queue, counts and search are scoped by the tenant repository, so another college's case is invisible even by exact case number or indicator. Assignees and duplicate-of cases are looked up inside the tenant.

### Audit actions (Phase 4)

| Action | Metadata (never free text) |
| --- | --- |
| `case.assign` | from, to (user ids), statusChanged |
| `case.status_change` | from, to |
| `case.info_request` | from (previous status) |
| `case.staff_message` | length |
| `case.note_add` | noteId, length — never the body |
| `case.recommend` | type — never the basis |
| `case.decision` | type, checks, confirmedIndicatorCount, verifiedDomainCount, dismissReason — never the basis or student message |
| `case.reopen` | previousStatus, previousDecisionType — never the reason |

`GET /staff/audit` is TPO-head only and tenant-scoped; entries remain append-only.

## Known limitations

- **No email OTP verification in the MVP.** Student registration is controlled by the college email domain plus the college's join code (the pilot control, ADR-012). Someone who knows the join code could register with an address on the college's domain that they do not own. Mitigations: rotate the join code, disable accounts, add email verification later.
- No password reset by email; staff passwords are reset by re-creating access (planned later).
- Logout clears the cookie but does not revoke a copied token before it expires (≤ 8 h). Password change or disabling the account does revoke it.
- Rate-limit state is in memory per process and `trust proxy` is not configured yet; both are set in Phase 7 (Render deployment).
- PDFs are not sanitised (they may carry author metadata or active content); they are only downloaded as attachments under `CSP: sandbox` and opened in the user's own viewer.
- Images are not decoded or re-encoded: metadata segments are removed, but pixel content (e.g. a visible ID card in a screenshot) is not inspected. Students are asked to crop IDs out.
- No malware scanning of uploads in the MVP.
- Decisions are recorded by a single TPO head; there is no second-person approval (ADR-024).
- Reopening a case does not yet revoke registry entries — there is no registry until Phase 5, which must revoke entries created from a reopened decision.
- The privacy guard detects PAN and Aadhaar formats only; other identifiers (passport, voter ID, bank account numbers) are not detected.

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
