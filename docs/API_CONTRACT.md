# API Contract

## Base path

All endpoints are served under **`/api/v1`**. Requests and responses use JSON (`Content-Type: application/json`). Request bodies are limited to **100 kb**.

## Authentication

- A successful `register`, `login` or `change-password` sets the session cookie **`os_session`** (signed JWT; `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, `Max-Age` = `JWT_EXPIRES_IN`, default 8 h). Tokens never appear in response bodies.
- Every authenticated request reloads the user from the database. The session is rejected (`401 UNAUTHENTICATED`) if the token is missing, invalid, expired or tampered, the user is missing or disabled, the user's `tokenVersion` changed (password change, disable), or the user's college is suspended.
- A user with `mustChangePassword: true` may only call `GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout`; everything else returns `403 PASSWORD_CHANGE_REQUIRED`.
- All request bodies are validated with zod `.strict()` schemas: unknown keys (e.g. `role`, `collegeId`) → `400 VALIDATION_ERROR`.
- `collegeId` is never accepted from the client; it always comes from the authenticated user.

## Standard error envelope

```json
{ "error": { "code": "UPPER_SNAKE_CASE", "message": "Human-readable, safe message" } }
```

No stack traces are returned in `production` (or `test`). In `development` only, unexpected 500 errors may include `error.stack`.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `BAD_REQUEST` | Other unreadable bodies |
| 400 | `VALIDATION_ERROR` | Body fails its schema (message names fields and rules, never values) |
| 400 | `REGISTRATION_REJECTED` | Unknown/suspended college code, email domain not allowed, or wrong join code (one generic message) |
| 400 | `EMAIL_DOMAIN_MISMATCH` | Staff email domain is not one of the college's domains |
| 400 | `INVALID_CURRENT_PASSWORD` | Change password with a wrong current password |
| 400 | `CANNOT_MODIFY_SELF` | TPO head tries to change their own status |
| 400 | `SENSITIVE_ID_DETECTED` | Request text or contacts contain a PAN or a checksum-valid Aadhaar number (value never echoed) |
| 400 | `UNSUPPORTED_FILE_TYPE` | Evidence is not PNG/JPEG/PDF by content, or the image is damaged |
| 400 | `TOO_MANY_FILES` | More than 5 files in one upload, or more than 10 on one case |
| 400 | `NO_FILES` | Upload without any file in the `files` field |
| 400 | `INVALID_UPLOAD` | Malformed multipart body or unexpected fields |
| 401 | `LINK_INVALID` | Evidence link expired, tampered, or issued to a different user |
| 409 | `CASE_CLOSED` | Reply or upload on a closed case |
| 413 | `FILE_TOO_LARGE` | An evidence file is over 3 MB |
| 401 | `UNAUTHENTICATED` | No/invalid session |
| 401 | `INVALID_CREDENTIALS` | Login failed (unknown email, wrong password, disabled user, suspended college — identical body) |
| 403 | `FORBIDDEN` | Role not allowed, super admin on a college route, or target is a TPO head |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Temporary password must be changed first |
| 404 | `NOT_FOUND` | No route, or resource does not exist **or belongs to another college** |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 409 | `COLLEGE_CODE_TAKEN` | College code already used |
| 409 | `CONFLICT` | Other unique-index violation |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kb |
| 429 | `RATE_LIMITED` | Baseline `/api` limit, or the stricter auth limit on login/register |
| 500 | `INTERNAL_ERROR` | Any unexpected error |

## Objects

**SafeUser** (the only user shape ever returned by `/auth/*`):

```json
{
  "id": "665f…", "name": "Asha Rao", "email": "asha@alpha.demo.edu", "role": "student",
  "collegeId": "665e…", "status": "active", "mustChangePassword": false,
  "year": 3, "branch": "COMP", "lastLoginAt": "2026-11-10T09:00:00.000Z", "createdAt": "2026-11-10T08:00:00.000Z"
}
```

`year`/`branch` are `null` for non-students; `collegeId` is `null` for `super_admin`. Never includes `passwordHash` or `tokenVersion`.

**StaffSummary**: `{ "id", "name", "email", "role", "status" }`.

**CollegeView** (super admin only): `{ "id", "name", "code", "emailDomains", "branches", "status", "staffCount", "createdAt", "updatedAt" }` — never students, the join code or its hash.

## Endpoints

| Method | Path | Roles | Success | Error codes |
| --- | --- | --- | --- | --- |
| GET | `/health` | public | 200 | 429 |
| POST | `/auth/register` | public (creates `student`) | 201 + cookie | 400 `VALIDATION_ERROR` / `REGISTRATION_REJECTED`, 409 `EMAIL_TAKEN`, 429 |
| POST | `/auth/login` | public | 200 + cookie | 400, 401 `INVALID_CREDENTIALS`, 429 |
| POST | `/auth/logout` | public (clears cookie) | 204 | — |
| GET | `/auth/me` | any signed-in | 200 | 401 |
| POST | `/auth/change-password` | any signed-in | 200 + new cookie | 400 `VALIDATION_ERROR` / `INVALID_CURRENT_PASSWORD`, 401 |
| POST | `/admin/colleges` | super_admin | 201 | 400, 401, 403, 409 `COLLEGE_CODE_TAKEN` |
| GET | `/admin/colleges` | super_admin | 200 | 401, 403 |
| GET | `/admin/colleges/:id` | super_admin | 200 | 401, 403, 404 |
| PATCH | `/admin/colleges/:id` | super_admin | 200 | 400, 401, 403, 404 |
| POST | `/admin/colleges/:id/rotate-join-code` | super_admin | 200 | 400, 401, 403, 404 |
| POST | `/admin/colleges/:id/tpo-heads` | super_admin | 201 | 400 `VALIDATION_ERROR` / `EMAIL_DOMAIN_MISMATCH`, 401, 403, 404, 409 `EMAIL_TAKEN` |
| GET | `/admin/colleges/:id/staff` | super_admin | 200 | 401, 403, 404 |
| GET | `/college/me` | student, placement_officer, tpo_head | 200 | 401, 403 |
| GET | `/staff/members` | placement_officer, tpo_head | 200 | 401, 403 |
| POST | `/staff/officers` | tpo_head | 201 | 400 `VALIDATION_ERROR` / `EMAIL_DOMAIN_MISMATCH`, 401, 403, 409 |
| PATCH | `/staff/officers/:id/status` | tpo_head | 200 | 400 `VALIDATION_ERROR` / `CANNOT_MODIFY_SELF`, 401, 403 `FORBIDDEN` (target is a TPO head), 404 |
| POST | `/cases` | student | 201 | 400 `VALIDATION_ERROR` / `SENSITIVE_ID_DETECTED`, 401, 403, 429 |
| GET | `/cases/mine` | student | 200 | 400, 401, 403 |
| GET | `/cases/:id` | student (owner) | 200 | 401, 403, 404 |
| POST | `/cases/:id/messages` | student (owner) | 201 | 400 `VALIDATION_ERROR` / `SENSITIVE_ID_DETECTED`, 401, 403, 404, 409 `CASE_CLOSED` |
| POST | `/cases/:id/evidence` | student (owner) | 201 | 400 `UNSUPPORTED_FILE_TYPE` / `TOO_MANY_FILES` / `NO_FILES` / `INVALID_UPLOAD`, 401, 403, 404, 409, 413 `FILE_TOO_LARGE` |
| POST | `/cases/:id/evidence/:evidenceId/link` | student (owner), placement_officer, tpo_head (same college) | 200 | 401, 403 (super admin, other roles), 404 |
| GET | `/files/:token` | the user the link was issued to (session required) | 200 (file stream) | 401 `UNAUTHENTICATED` / `LINK_INVALID`, 404 |

Any authenticated route can also return `403 PASSWORD_CHANGE_REQUIRED` (except the three allowed auth routes).

### `GET /health`

```json
{ "status": "ok", "service": "offershield-api", "version": "0.1.0", "environment": "development",
  "uptimeSeconds": 12, "timestamp": "2026-11-10T07:30:00.000Z", "database": "connected" }
```

`database` is `"connected"` when the mongoose connection is open, otherwise `"disconnected"`.

### `POST /auth/register`

Request: `{ "name", "email", "password", "collegeCode", "joinCode", "year": 1-5, "branch" }`

- `email` is lowercased; its domain must be one of the college's `emailDomains`.
- `collegeCode` is lowercased; the college must be `active`.
- `joinCode` is compared case-insensitively, ignoring spaces and dashes, against the stored hash.
- `branch` is uppercased and must be one of the college's branches (otherwise `400 VALIDATION_ERROR`, checked only after the college details are accepted).
- Password: 10+ characters, at least one letter and one number, at most 72 bytes.

Response `201`: `{ "user": SafeUser }` and the session cookie. Audit: `auth.register`.

### `POST /auth/login`

Request: `{ "email", "password" }` → `200 { "user": SafeUser }` + cookie. Updates `lastLoginAt`. Failure: `401 { "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }`.

### `POST /auth/logout`

No body. Clears `os_session`; `204`.

### `GET /auth/me`

`200 { "user": SafeUser, "college": { "id", "name", "code", "branches" } | null }` (`null` for super admin).

### `POST /auth/change-password`

Request: `{ "currentPassword", "newPassword" }`. The new password must meet the policy and differ from the current one. Sets `mustChangePassword=false`, increments `tokenVersion` (all older sessions stop working) and issues a new cookie. `200 { "user": SafeUser }`. Audit: `auth.password_change`.

### `POST /admin/colleges`

Request: `{ "name", "code", "emailDomains": ["college.edu"], "branches"?: ["COMP", …] }`

Response `201`: `{ "college": CollegeView, "studentJoinCode": "K7Q2M9XHRA" }` — a 10-character code from an unambiguous alphabet (no 0/O/1/I/L). **Returned only here and on rotation**; only its hash is stored. Audit: `college.create`.

### `GET /admin/colleges` / `GET /admin/colleges/:id`

`200 { "colleges": CollegeView[] }` / `200 { "college": CollegeView }`. Malformed or unknown id → 404.

### `PATCH /admin/colleges/:id`

Request (at least one): `{ "name"?, "emailDomains"?, "branches"?, "status"?: "active" | "suspended" }`. `code` cannot be changed. `200 { "college": CollegeView }`. Suspending a college immediately blocks logins and live sessions of its users. Audit: `college.update` (`metadata.fields`, and `metadata.status` `{from,to}` when it changes).

### `POST /admin/colleges/:id/rotate-join-code`

Empty body. `200 { "college": CollegeView, "studentJoinCode": "…" }`. The previous code stops working immediately. Audit: `college.join_code_rotate`.

### `POST /admin/colleges/:id/tpo-heads`

Request: `{ "name", "email" }` (email domain must belong to the college). `201 { "user": StaffSummary, "temporaryPassword": "…" }` — a 16-character password **returned once**; the account has `mustChangePassword=true`. Audit: `staff.create`.

### `GET /admin/colleges/:id/staff`

`200 { "staff": StaffSummary[] }` — TPO heads and placement officers only.

### `GET /college/me`

`200 { "college": { "name", "code", "branches" } }` for the caller's own college.

### `GET /staff/members`

`200 { "staff": StaffSummary[] }` — staff of the caller's college only.

### `POST /staff/officers`

Request: `{ "name", "email" }` (email domain must belong to the caller's college). `201 { "user": StaffSummary, "temporaryPassword": "…" }`, `mustChangePassword=true`. Audit: `staff.create`.

### `PATCH /staff/officers/:id/status`

Request: `{ "status": "active" | "disabled" }`.

| Target | Result |
| --- | --- |
| Placement officer in own college | `200 { "user": StaffSummary }`; disabling increments `tokenVersion` (immediate logout). Audit `staff.status_change` `{from,to}` (no entry if unchanged) |
| Caller themself | `400 CANNOT_MODIFY_SELF` |
| Another TPO head in own college | `403 FORBIDDEN` |
| Student in own college | `404 NOT_FOUND` (not an officer) |
| Any account in another college, unknown or malformed id | `404 NOT_FOUND` |

### Student verification requests (Phase 3)

All `/cases` routes require a session and the `student` role (plus a tenant); the evidence-link route also allows same-college `placement_officer` and `tpo_head`. `collegeId` and `studentId` always come from the session. Another student's case, or any other college's case, returns `404 NOT_FOUND`.

**StudentCaseView** (`toStudentCaseView`, the only case shape students receive):

```json
{
  "id": "…", "caseNumber": "OS-DEMO-ALPHA-0001", "claimedCompany": "XYZ Careers Pvt Ltd", "roleTitle": "Data Intern",
  "channel": "whatsapp", "receivedAt": "2026-11-09T00:00:00.000Z", "messageText": "…",
  "links": ["https://…"], "contacts": { "emails": [], "phones": [], "upiIds": [] },
  "moneyRequested": { "requested": true, "amount": 499, "purpose": "registration" },
  "paidAlready": false, "documentsShared": false, "studentNote": null, "status": "submitted",
  "indicators": [{ "type": "upi", "value": "careers.desk@okaxis", "source": "extracted" }],
  "decision": null, "lastActivityAt": "…", "createdAt": "…", "updatedAt": "…"
}
```

Never included: `assigneeId`, `priority`, `signals`, `linkedCaseIds`, `studentId`, `collegeId`, `decision.decidedBy`. `decision` (Phase 4) is `{ type, basis, decidedAt }` or null.

#### `POST /cases`

JSON body (strict; `collegeId`, `studentId`, `status`, `priority`, `assigneeId`, `decision` or any other extra key → 400):

| Field | Rules |
| --- | --- |
| `claimedCompany` | 2–120 |
| `roleTitle` | optional, ≤ 120 |
| `channel` | whatsapp, telegram, email, linkedin, instagram, job_portal, sms, phone_call, other |
| `receivedAt` | date/ISO string, not in the future |
| `messageText` | 10–5000 |
| `links` | optional, ≤ 10, http/https only, ≤ 500 chars each (stored as text, never fetched) |
| `contacts` | optional `{ emails ≤5, phones ≤5, upiIds ≤5 }` |
| `moneyRequested` | `{ requested: boolean, amount?: number ≥ 0 or null, purpose?: registration, training, security_deposit, document_verification, equipment, other or null }` |
| `paidAlready`, `documentsShared` | boolean |
| `studentNote` | optional, ≤ 2000 |
| `consent` | must be `true` |

The server runs the privacy guard (`messageText`, `studentNote`, company, role, contacts), extracts indicators, assigns the next per-college `caseNumber`, sets `priority` (high if money requested or paid), stores `consentAt`, writes a visible `created` event and audits `case.create`. Rate limit: `CASE_CREATE_LIMIT_PER_HOUR` per student (default 10) → 429. Response `201 { "case": StudentCaseView }`.

#### `GET /cases/mine?status=&page=&limit=`

Own cases, newest first. `status` optional (one of the case statuses), `page` ≥ 1 (default 1), `limit` 1–50 (default 10). Response `200 { "cases": [{ id, caseNumber, claimedCompany, channel, status, receivedAt, createdAt, lastActivityAt }], "page", "limit", "total" }`.

#### `GET /cases/:id`

`200 { "case": StudentCaseView, "events": [...], "evidence": [{ id, originalName, mime, size, createdAt }] }`. `events` are only those with `visibleToStudent: true`, oldest first, shaped `{ id, type, actor: "student" or "placement_cell" or "system", body, metadata, createdAt }` (staff identities are not exposed; metadata limited to `from/to` and `count/names`).

#### `POST /cases/:id/messages`

`{ "body": "1–3000 chars" }`. Owner only; closed case → 409 `CASE_CLOSED`. Privacy guard applies. Writes a visible `student_message` event; if the status was `awaiting_student` it becomes `under_review` with a visible `status_changed` event. Updates `lastActivityAt` and merges newly extracted indicators. Response `201` with the same shape as `GET /cases/:id`. Audit `case.student_message`.

#### `POST /cases/:id/evidence`

`multipart/form-data`, field `files`, 1–5 files, ≤ 3 MB each, ≤ 10 per case. Owner only, open cases only (checked before the body is read). Type is detected from magic bytes (PNG, JPEG, PDF); the claimed name/MIME type are ignored. EXIF/XMP/IPTC/text metadata is removed from images; PDFs are stored unchanged. Response `201 { "evidence": [{ id, originalName, mime, size, createdAt }] }`. Writes a visible `evidence_added` event and audits `evidence.upload`. If any file is rejected, nothing from the request is stored.

#### `POST /cases/:id/evidence/:evidenceId/link`

Empty body. Allowed: the owning student, or a placement officer / TPO head of the same college; super admin → 403; anyone else, other colleges, or evidence of a different case → 404. Response `200 { "url": "/api/v1/files/<token>", "expiresAt": "ISO" }`, valid for `EVIDENCE_LINK_TTL_SECONDS` (default 300).

#### `GET /files/:token`

Requires **both** the link token and a valid session of the same user (`uid`), who must still have access. Streams the file with:

| Header | Value |
| --- | --- |
| `Content-Type` | stored MIME type |
| `Content-Disposition` | `attachment` for PDF, `inline` for PNG/JPEG, with the sanitised filename |
| `X-Content-Type-Options` | `nosniff` |
| `Cache-Control` | `no-store` |
| `Content-Security-Policy` | `sandbox` |

No session → 401 `UNAUTHENTICATED`; expired/tampered/other user's token → 401 `LINK_INVALID`; evidence gone → 404. Each successful download is audited as `evidence.access`.

## Planned route groups (not implemented)

| Group | Phase | Purpose |
| --- | --- | --- |
| `/api/v1/staff/cases/*` (indicative) | 4 | Staff case desk, assignment, internal notes, info requests, decisions |
| `/api/v1/registry/*`, `/api/v1/lookup` | 5 | Registry, student lookup, linking, warning signals |
| `/api/v1/advisories`, `/api/v1/notifications`, `/api/v1/stats` | 6 | Advisories, notifications, statistics |
| `/api/v1/audit-logs` | 4 | Read-only audit trail for the TPO head |
