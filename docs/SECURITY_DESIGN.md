# Security Design

## Implemented in Phase 1

| Control | Where | Detail |
| --- | --- | --- |
| Security headers | `app.js` | `helmet()` (explicit CSP since Phase 7, see below); `x-powered-by` disabled |
| CORS allow-list | `app.js`, `config/env.js` | Only origins in `CLIENT_ORIGINS` get `Access-Control-Allow-Origin`, with credentials |
| Body size limit | `app.js` | `express.json({ limit: '100kb' })` → `413 PAYLOAD_TOO_LARGE` |
| Rate limiting | `middleware/rateLimiter.js` | Baseline limit on all `/api` routes → `429 RATE_LIMITED` (per user or per IP since Phase 7) |
| Safe error handling | `middleware/errorHandler.js` | Standard envelope; fixed messages for parser and mongoose validation errors; no stack traces outside development; logs request id and code only (Phase 7) |
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
Superseded in Phase 7 (keyed per user / per IP + email, see "Fair rate limits"). The Phase 2 design was a per-IP baseline (300 / 15 min) and one shared login + registration limiter (10 / 15 min / IP).

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

## Implemented in Phase 5

### Allegation vs finding

Student-reported values stay case indicators (allegations). A **confirmed fraud indicator** exists only when a TPO head records a confirmed_fraud decision selecting it from the case's own indicators. Only `decision.service` (via `indicator.service`) and the head's manual revoke write `FraudIndicator`; there is no create route. Reopening the source case removes it as a source and revokes the indicator when no confirmed source remains, so a withdrawn finding stops warning students immediately.

### Conflict rules

- A confirmed indicator whose domain, email domain or URL host belongs to a **verified** recruiter of the college is rejected (409 `CONFLICTS_WITH_VERIFIED_RECRUITER`) **before** the decision's atomic update: nothing changes, nothing is audited. The head must suspend the recruiter first.
- A recruiter domain, contact email or phone that is an **active** fraud indicator is rejected (409 `CONFLICTS_WITH_FRAUD_INDICATOR`) on create, update, approve and renew.
- Recruiter domains and contacts can never be free-mail (ADR-033); officer-created recruiters need head approval (ADR-034).

### Lookup data minimisation

- College-scoped; students, officers and heads only (super admin 403); per-user rate limit.
- Responses contain only registry facts: indicator type/value/confirmation date and verified recruiter name/domains/methods/dates. Never case data, student data, `sourceCaseIds` (staff get case links only), evidence notes, verifier names, or pending/suspended recruiters.
- `LookupEvent` stores who/role/query type/result for metrics; **never the query text**.
- Guidance never says "safe" or "genuine"; "not reviewed" explicitly "does not mean safe".

### No network calls

Look-alike detection (tldts + punycode + homoglyph skeleton + edit distance), SimHash and signals are pure string computations. The server performs no HTTP, DNS, RDAP or WHOIS request for any submitted value (ADR-032).

### Staff-only derived data

Signals, related cases, `textHash`, `linked` events and source-case links are serialized only by staff views. Signals never change status or priority and never block a request. Linking never crosses colleges and ignores free-mail domains and verified recruiters' domains, so legitimate shared contacts do not link unrelated students.

## Implemented in Phase 6

### Advisory content rules

- **Confirmed findings only:** an advisory can link only ACTIVE fraud indicators of the college (checked on save and again on publish). Revoked indicators disappear from student views immediately and flag the advisory `needsReview` for staff.
- **No student identity:** when an advisory comes from a case, its title and body are rejected if they contain the reporting student's name or email (`CONTAINS_STUDENT_IDENTITY`); the prefilled template contains neither. `sourceCaseId` and author fields are never sent to students.
- **Privacy guard:** PAN/Aadhaar detection applies to advisory text.
- **Head-only publishing, immutable once published:** officers draft; only the TPO head publishes or withdraws. Published text cannot be edited — corrections are a withdraw plus a new advisory, so what students saw is always auditable (ADR-038, ADR-039).
- **Targeting** uses year/branch only; acknowledgement breakdowns are counts, never names.

### Notification template allow-list

Notification text is produced only by `services/notifications/templates.js` from an allow-listed context: case number, claimed company, the student-visible decision message (≤ 200 chars), advisory title and severity. Callers cannot pass a title or body. Decision basis and checks, note bodies, recommendation basis, reopen reasons, signals and related cases can therefore never reach a notification; a leak test verifies this with distinctive strings. Links must be internal paths. Notification failures never fail the main action (errors are swallowed; only the error code is logged). Every inbox query filters by both `collegeId` and `userId`.

### Aggregation tenant guard

`tenantRepository.forTenant(id).aggregate(pipeline)` always prepends `{ $match: { collegeId } }` and refuses `$lookup`, `$graphLookup`, `$unionWith`, `$out`, `$merge` and `$facet` (stages that can reach other collections or hide sub-pipelines); a stage with more than one operator is refused too. Cross-collection data is fetched with a second scoped query instead (ADR-040).

### Polling instead of sockets

The client polls the unread count every 30 s (paused while the tab is hidden, refreshed on focus). No WebSocket, push or email channel exists, so there is no extra authenticated long-lived connection to secure (ADR-037).

## Implemented in Phase 7

### Fair rate limits on shared campus IPs

Many students reach the service from one campus NAT address, so IP-only limits would lock out a whole college (ADR-042).

| Limiter | Key | Default (config) |
| --- | --- | --- |
| Baseline `/api`, signed in | user id from the session JWT (signature/expiry check only, no DB query) | 600 / 15 min (`API_USER_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS`) |
| Baseline `/api`, anonymous or invalid cookie | IP | 300 / 15 min (`API_RATE_LIMIT_MAX`) |
| `POST /auth/login` | IP + normalised email | 10 / 15 min (`AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`) |
| `POST /auth/login` | IP | 200 / 15 min (`AUTH_IP_RATE_LIMIT_MAX`) |
| `POST /auth/register` | IP | 60 / hour (`REGISTER_RATE_LIMIT_MAX`, `REGISTER_RATE_LIMIT_WINDOW_MS`) |
| `POST /cases`, `GET /lookup` | user (unchanged) | `CASE_CREATE_LIMIT_PER_HOUR`, `LOOKUP_LIMIT_PER_10MIN` |

A forged or expired cookie does not verify, so it is counted by IP and cannot borrow another user's budget. `TRUST_PROXY` (default 0 locally, 1 in production) sets Express `trust proxy`, so behind Render's proxy `req.ip` is the client address from `X-Forwarded-For`; with 0 that header is ignored and cannot be used to dodge limits. IPv6 addresses are grouped by subnet (`ipKeyGenerator`). All limiters answer `429 RATE_LIMITED`; counters are in memory per process.

### Manual-approval students

- `College.studentVerification`: `email_domain` (default, unchanged) or `manual_approval` for colleges without student email addresses (ADR-043). In manual mode any valid email registers, but the college code and join code are still required, and the account starts as `pending_approval`.
- A pending student can sign in, but `enforcePasswordChange` → `enforceApproved` (`middleware/pendingApproval.js`), applied by every authenticated router, answers `403 ACCOUNT_PENDING_APPROVAL` for everything except `GET /auth/me`, `POST /auth/logout` and `POST /auth/change-password`. Pending students are not part of advisory audiences (active students only).
- `rejected` and `disabled` accounts cannot sign in (the same generic 401) and lose their sessions (`tokenVersion` is incremented).
- Approve, reject, bulk approve and enable/disable are college-scoped through the tenant repository (another college's id → 404, bulk approve silently skips it) and audited as `student.approve`, `student.reject` (only whether a reason was given) and `student.status_change`.
- The `student_pending` notification to staff is template text only, with no name or email.
- `isDemo` is not accepted by any API schema (strict → 400); only seed scripts set it.

### Staff-assisted password reset

No email is sent (ADR-044). `POST /staff/users/:id/reset-password`: a TPO head may reset placement officers and students, an officer only students, nobody their own account here, and TPO heads only via `POST /admin/users/:id/reset-password` (super admin). The target is loaded through the tenant repository (another college → 404). The response carries a fresh 16-character temporary password **once**; the account gets `mustChangePassword=true` and `tokenVersion+1` (all sessions end). Audit `user.password_reset` stores only the target role; the password is never stored in plain text, logged or audited, and the client shows it in the one-time panel.

### Consent

Registration requires `acceptPolicies: true` (strict schema, otherwise 400). The user stores `policiesAcceptedAt` and `policiesVersion`; the audit entry `auth.register` records the version. `/privacy` and `/terms` describe the actual data handling; `GET /api/v1/policies` serves the version, `RETENTION_MONTHS` and `SUPPORT_EMAIL` (no secrets).

### Production hardening (one service)

- In production Express also serves `client/dist` (ADR-045): `/assets/*` `Cache-Control: public, max-age=31536000, immutable`, `index.html` `no-cache`, SPA fallback for non-`/api` GETs that accept HTML, JSON 404 for unknown `/api/*`, plain 404 for a missing asset.
- Helmet CSP (all environments): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`. HSTS `max-age=15552000; includeSubDomains` in production only. Evidence downloads keep their own `Content-Security-Policy: sandbox`.
- `compression` for responses.
- Startup refuses to run in production (exit 1, message names keys and rules only) when `MONGODB_URI` is missing, `JWT_SECRET` is shorter than 32 characters or equals the `.env.example` placeholder, or `CLIENT_ORIGINS` is not set.
- `COOKIE_SECURE_OVERRIDE=false` is a development-only escape hatch for a local production smoke on plain http; it is ignored when `APP_BASE_URL` is https.
- Graceful shutdown on SIGTERM/SIGINT: stop accepting connections, finish in-flight requests, disconnect MongoDB, force-exit after 10 s.

### Request logging

`middleware/requestId.js` gives every request an id (a safe incoming `X-Request-Id` is kept) and returns it as `X-Request-Id`. `middleware/requestLogger.js` writes one JSON line per request `{ t, requestId, method, path, status, ms, uid? }`. `path` never includes the query string (lookup queries are personal data); bodies, headers, cookies and tokens are never logged. The error handler logs `{ t, requestId, code }` only (before Phase 7 it logged `req.originalUrl`, which included query strings; removed). A sweep found no other `console.*` of bodies, queries, tokens or passwords.

### Demo isolation and retention

- `College.isDemo` marks demo colleges (`demo-campus`, `demo-alpha`, `demo-beta`). `seed:showcase --reset` deletes data only for colleges with `isDemo: true` (every collection by `collegeId`, GridFS files by `metadata.collegeId`), so a real college can never be reset (ADR-046). Seeds refuse to run in production unless `ALLOW_DEMO_SEED=true`. All showcase scam contacts are fictional (`-demo.xyz` domains, UPI handles containing `demo`, `+91 90000 0000X` phones).
- `ops:retention` (dry run by default) deletes evidence files of cases decided more than `RETENTION_MONTHS` ago, never the cases, and records a staff-only `evidence_purged` event and an `evidence.purged` audit entry per case (ADR-047).
- The client shows "Demo environment — sample data" for users of an `isDemo` college (`isDemo` is part of the `/auth/me` college summary).

### Dependency audit

`npm audit --omit=dev`: 0 vulnerabilities at the end of Phase 7. The only new dependency is `compression`.

See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) for the test that proves each rule.

## Known limitations

- **No email OTP verification in the MVP.** Student registration is controlled by the college email domain plus the college's join code (the pilot control, ADR-012). Someone who knows the join code could register with an address on the college's domain that they do not own. Mitigations: rotate the join code, disable accounts, add email verification later.
- No self-service password reset: a student or officer asks staff, who hand over a temporary password in person or by phone (ADR-044). A TPO head is reset by the super admin.
- In manual-approval colleges, staff must check each registration against their enrolment list; a person who knows the join code can still create a pending account.
- Logout clears the cookie but does not revoke a copied token before it expires (≤ 8 h). Password change or disabling the account does revoke it.
- Rate-limit state is in memory per process: a restart resets counters, and running more than one instance would need a shared store.
- Request logs go to stdout only (the platform's log view); there is no log shipping or alerting.
- The retention script is run by hand (no scheduler on the free plan) and deletes evidence only; case text is kept.
- PDFs are not sanitised (they may carry author metadata or active content); they are only downloaded as attachments under `CSP: sandbox` and opened in the user's own viewer.
- Images are not decoded or re-encoded: metadata segments are removed, but pixel content (e.g. a visible ID card in a screenshot) is not inspected. Students are asked to crop IDs out.
- No malware scanning of uploads in the MVP.
- Notifications are in-app only (no email/SMS); a student who never signs in will not see advisories.
- The student-identity check on advisories matches the exact name and email only; staff must still avoid other identifying details.
- Look-alike detection is heuristic (ADR-030): it can miss novel tricks and can flag legitimate sister domains until they are added to the recruiter.
- Recruiter verification relies on the staff member's evidence note; there is no automated domain ownership check (no DNS/RDAP in the MVP).
- Decisions are recorded by a single TPO head; there is no second-person approval (ADR-024).
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

## Implemented in Phase 9

### Google sign-in (OIDC, server-side code flow)

- `GET /auth/google/start` creates `state` (32 bytes), `nonce` and a PKCE S256 verifier; they live only in the signed `os_oauth` cookie (httpOnly, SameSite=Lax, `Path=/api/v1/auth/google`, 10 minutes, HMAC-SHA256 with a key derived from `JWT_SECRET`, cookie name bound into the MAC). The query accepts only `intent=login|register`, so no redirect target can be injected.
- The callback clears `os_oauth` first (single use), compares `state`, exchanges the code with the verifier at the fixed token URL, and verifies the ID token itself: RS256 signature against Google's JWKS (`crypto.createPublicKey({ format: 'jwk' })`), `iss` (`accounts.google.com` or `https://accounts.google.com`), `aud` = client id (and `azp` when several audiences), `exp`/`iat` with 60 s skew, `nonce`, `email_verified === true`. `alg: none` and unknown keys are rejected.
- Every outcome redirects to a fixed internal path (`/student`, `/staff`, `/admin`, `/pending-approval`, `/register/google`, `/login?error=google_failed|account_unavailable`). Failures log an error code only, never the code, token or Google's response.
- Unknown accounts get a signed `os_google_signup` cookie (`sub`, email, name, `hd`; 10 minutes). `POST /auth/google/complete` applies the same college, join-code, branch and domain checks as registration (`hd` may satisfy the domain rule) and creates a Google-only student (`passwordHash` null).
- Linking by email is described in ADR-060; an account linked to another Google subject is never taken over. Disabled/rejected accounts get `account_unavailable`; a suspended college gets the generic failure.
- Google-only accounts fail password login with the same generic 401; change-password returns `PASSWORD_NOT_SET`; a staff-assisted reset adds `password` to `authMethods`.

### Email verification codes

- 6 digits from `crypto.randomInt`, stored as HMAC-SHA256 (key derived from `JWT_SECRET` with its own label) over `userId:code`, so a stored hash is useless for any other account. 10-minute expiry, 5 attempts counted atomically before the comparison (`timingSafeEqual`), resend after 60 s and at most 5 per hour; a resend replaces the code. `emailOtp` is `select: false`.
- `enforceEmailVerified` (inside the shared account-state gate) returns `403 EMAIL_NOT_VERIFIED` except for `/auth/me`, logout, change-password, verify-email and resend. It reads the per-app config, so it is off unless `REQUIRE_EMAIL_VERIFICATION` is on.

### Self-service password reset

- `POST /auth/forgot-password` always answers the same 202 at the same speed (work runs after the response). Limits: 20 per IP and 3 per address per hour.
- Tokens: 32 random bytes (base64url), SHA-256 stored, 30 minutes, single use (claimed atomically), at most three active per user, TTL index on `expiresAt`. A successful reset increments `tokenVersion` (all sessions end), clears `mustChangePassword`, invalidates the other links, is audited (`auth.password_reset_self`, no token) and triggers a critical "password changed" email. The link carries the token in the fragment (ADR-063).

### Email content and delivery

- Only `services/email/templates.js` produces email text, from allow-listed fields (`name`, `code`, `link`, `caseNumber`, `claimedCompany`, `advisoryTitle`, `severity`); everything in HTML is escaped and line breaks are stripped from subjects. Emails never include the decision message or basis, notes, recommendations, signals, related cases or other students' data; case emails only say that something happened and link to the page.
- Recipients must be active and verified; opted-out users are recorded as `skipped_pref`. `EmailLog` never stores bodies, addresses, codes, links or tokens.
- Sending happens after the API response; failures are logged by code and never change the response.

### Configuration guards

- Production refuses to start with `REQUIRE_EMAIL_VERIFICATION=true` and `EMAIL_PROVIDER=log`, with `brevo` but no `BREVO_API_KEY`/`EMAIL_FROM`, or with only one of `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Errors name keys, never values.
- Outbound calls: only `https://oauth2.googleapis.com/token`, `https://www.googleapis.com/oauth2/v3/certs` and `https://api.brevo.com/v3/smtp/email`. CSP is unchanged.
