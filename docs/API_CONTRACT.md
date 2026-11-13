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

A few errors add a structured, non-sensitive `error.details` object (currently only `CONFLICTS_WITH_VERIFIED_RECRUITER`: `{ recruiterId, companyName, indicator }`).

No stack traces are returned in `production` (or `test`). In `development` only, unexpected 500 errors may include `error.stack`.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `BAD_REQUEST` | Other unreadable bodies |
| 400 | `VALIDATION_ERROR` | Body fails its schema (message names fields and rules, never values) |
| 400 | `REGISTRATION_REJECTED` | Unknown/suspended college code, email domain not allowed, or wrong join code (one generic message) |
| 400 | `EMAIL_DOMAIN_MISMATCH` | Staff email domain is not one of the college's domains |
| 400 | `INVALID_CURRENT_PASSWORD` | Change password with a wrong current password |
| 400 | `CANNOT_MODIFY_SELF` | TPO head tries to change their own status, or staff try to reset their own password |
| 400 | `SENSITIVE_ID_DETECTED` | Request text or contacts contain a PAN or a checksum-valid Aadhaar number (value never echoed) |
| 400 | `UNSUPPORTED_FILE_TYPE` | Evidence is not PNG/JPEG/PDF by content, or the image is damaged |
| 400 | `TOO_MANY_FILES` | More than 5 files in one upload, or more than 10 on one case |
| 400 | `NO_FILES` | Upload without any file in the `files` field |
| 400 | `INVALID_UPLOAD` | Malformed multipart body or unexpected fields |
| 401 | `LINK_INVALID` | Evidence link expired, tampered, or issued to a different user |
| 400 | `INVALID_ASSIGNEE` | Assignee is not an active placement officer / TPO head of the caller's college |
| 400 | `INDICATOR_NOT_ON_CASE` | A confirmed indicator or verified domain is not one of the case's indicators |
| 400 | `FREE_MAIL_NOT_ALLOWED` | Recruiter domain or contact email on a free-mail provider |
| 400 | `CONTACT_DOMAIN_MISMATCH` | Recruiter contact email not on one of its domains |
| 400 | `VERIFICATION_REQUIRED` | Changing a verified recruiter's domains without new methods and evidence note |
| 400 | `INVALID_LINK` | Linking a case to itself |
| 409 | `CONFLICTS_WITH_VERIFIED_RECRUITER` | A confirmed indicator belongs to a verified recruiter (suspend it first); includes `details` |
| 409 | `CONFLICTS_WITH_FRAUD_INDICATOR` | A recruiter domain/contact is an active confirmed fraud indicator |
| 409 | `INVALID_STATE` | Recruiter is not in a state that allows the action (approve/renew/suspend) |
| 409 | `ALREADY_REVOKED` | Revoking an already revoked indicator |
| 400 | `INVALID_INDICATOR` | Advisory links an indicator that is not ACTIVE in your college (on save or publish) |
| 400 | `INVALID_SOURCE_CASE` | Advisory source case is not a confirmed_fraud case of your college |
| 400 | `CONTAINS_STUDENT_IDENTITY` | Advisory title/body contains the reporting student's name or email |
| 409 | `ADVISORY_NOT_EDITABLE` | Editing/publishing a non-draft, or withdrawing a non-published advisory |
| 409 | `CASE_CLOSED` | Reply, upload, staff message, info request, assignment or recommendation on a closed case |
| 409 | `INVALID_TRANSITION` | The case is not in a status that allows this action (e.g. a concurrent decision won) |
| 413 | `FILE_TOO_LARGE` | An evidence file is over 3 MB |
| 401 | `UNAUTHENTICATED` | No/invalid session |
| 401 | `INVALID_CREDENTIALS` | Login failed (unknown email, wrong password, disabled user, suspended college — identical body) |
| 403 | `FORBIDDEN` | Role not allowed, super admin on a college route, or target is a TPO head |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Temporary password must be changed first |
| 403 | `ACCOUNT_PENDING_APPROVAL` | Student of a manual-approval college not yet approved (everything except `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`) |
| 409 | `INVALID_STATUS_CHANGE` | Student approve/reject/enable/disable from a status that does not allow it |
| 404 | `NOT_FOUND` | No route, or resource does not exist **or belongs to another college** |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 409 | `COLLEGE_CODE_TAKEN` | College code already used |
| 409 | `CONFLICT` | Other unique-index violation |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kb |
| 429 | `RATE_LIMITED` | Baseline `/api` limit (per user when signed in, else per IP), login (per IP + email and per IP), registration (per IP), case creation or lookup (per user) |
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
| GET | `/health/ready` | public | 200 / 503 | 429 |
| GET | `/policies` | public | 200 | 429 |
| POST | `/auth/register` | public (creates `student`; `pending_approval` in manual-approval colleges) | 201 + cookie | 400 `VALIDATION_ERROR` (incl. missing `acceptPolicies`) / `REGISTRATION_REJECTED`, 409 `EMAIL_TAKEN`, 429 |
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
| POST | `/admin/users/:id/reset-password` | super_admin (target: TPO head) | 200 | 400, 401, 403, 404 |
| GET | `/college/me` | student, placement_officer, tpo_head | 200 | 401, 403 |
| GET | `/staff/members` | placement_officer, tpo_head | 200 | 401, 403 |
| POST | `/staff/officers` | tpo_head | 201 | 400 `VALIDATION_ERROR` / `EMAIL_DOMAIN_MISMATCH`, 401, 403, 409 |
| PATCH | `/staff/officers/:id/status` | tpo_head | 200 | 400 `VALIDATION_ERROR` / `CANNOT_MODIFY_SELF`, 401, 403 `FORBIDDEN` (target is a TPO head), 404 |
| POST | `/staff/users/:id/reset-password` | tpo_head (officers, students), placement_officer (students) | 200 | 400 `CANNOT_MODIFY_SELF`, 401, 403 `FORBIDDEN`, 404 |
| GET | `/staff/students` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| POST | `/staff/students/:id/approve` | placement_officer, tpo_head | 200 | 400, 401, 403, 404, 409 `INVALID_STATUS_CHANGE` |
| POST | `/staff/students/:id/reject` | placement_officer, tpo_head | 200 | 400, 401, 403, 404, 409 `INVALID_STATUS_CHANGE` |
| POST | `/staff/students/bulk-approve` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| PATCH | `/staff/students/:id/status` | placement_officer, tpo_head | 200 | 400, 401, 403, 404, 409 `INVALID_STATUS_CHANGE` |
| POST | `/cases` | student | 201 | 400 `VALIDATION_ERROR` / `SENSITIVE_ID_DETECTED`, 401, 403, 429 |
| GET | `/cases/mine` | student | 200 | 400, 401, 403 |
| GET | `/cases/:id` | student (owner) | 200 | 401, 403, 404 |
| POST | `/cases/:id/messages` | student (owner) | 201 | 400 `VALIDATION_ERROR` / `SENSITIVE_ID_DETECTED`, 401, 403, 404, 409 `CASE_CLOSED` |
| POST | `/cases/:id/evidence` | student (owner) | 201 | 400 `UNSUPPORTED_FILE_TYPE` / `TOO_MANY_FILES` / `NO_FILES` / `INVALID_UPLOAD`, 401, 403, 404, 409, 413 `FILE_TOO_LARGE` |
| POST | `/cases/:id/evidence/:evidenceId/link` | student (owner), placement_officer, tpo_head (same college) | 200 | 401, 403 (super admin, other roles), 404 |
| GET | `/staff/cases` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| GET | `/staff/cases/counts` | placement_officer, tpo_head | 200 | 401, 403 |
| GET | `/staff/cases/:id` | placement_officer, tpo_head | 200 | 401, 403, 404 |
| PATCH | `/staff/cases/:id/assign` | officer (self only), tpo_head | 200 | 400 `VALIDATION_ERROR` / `INVALID_ASSIGNEE`, 401, 403, 404, 409 `CASE_CLOSED` |
| PATCH | `/staff/cases/:id/status` | placement_officer, tpo_head | 200 | 400, 401, 403, 404, 409 `INVALID_TRANSITION` / `CASE_CLOSED` |
| POST | `/staff/cases/:id/info-request` | placement_officer, tpo_head | 201 | 400, 401, 403, 404, 409 `CASE_CLOSED` |
| POST | `/staff/cases/:id/messages` | placement_officer, tpo_head | 201 | 400, 401, 403, 404, 409 `CASE_CLOSED` |
| POST | `/staff/cases/:id/notes` | placement_officer, tpo_head | 201 | 400, 401, 403, 404 |
| POST | `/staff/cases/:id/recommendation` | placement_officer, tpo_head | 200 | 400, 401, 403, 404, 409 `CASE_CLOSED` |
| POST | `/staff/cases/:id/decision` | tpo_head | 200 | 400 `VALIDATION_ERROR` / `INDICATOR_NOT_ON_CASE`, 401, 403, 404, 409 `INVALID_TRANSITION` |
| POST | `/staff/cases/:id/reopen` | tpo_head | 200 | 400, 401, 403, 404, 409 `INVALID_TRANSITION` |
| GET | `/staff/audit` | tpo_head | 200 | 400, 401, 403 |
| POST | `/staff/cases/:id/links` | placement_officer, tpo_head | 201 | 400 `INVALID_LINK`, 401, 403, 404 |
| DELETE | `/staff/cases/:id/links/:otherId` | placement_officer, tpo_head | 200 | 401, 403, 404 |
| POST | `/staff/cases/:id/signals/recompute` | placement_officer, tpo_head | 200 | 401, 403, 404 |
| GET | `/staff/registry/recruiters` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| POST | `/staff/registry/recruiters` | placement_officer (→ pending), tpo_head (→ verified) | 201 | 400, 401, 403, 404 (sourceCaseId), 409 `CONFLICTS_WITH_FRAUD_INDICATOR` |
| PATCH | `/staff/registry/recruiters/:id` | tpo_head; officer only own pending | 200 | 400 (incl. `VERIFICATION_REQUIRED`), 401, 403, 404, 409 |
| POST | `/staff/registry/recruiters/:id/approve` | tpo_head | 200 | 401, 403, 404, 409 `INVALID_STATE` |
| POST | `/staff/registry/recruiters/:id/renew` | tpo_head | 200 | 400, 401, 403, 404, 409 |
| POST | `/staff/registry/recruiters/:id/suspend` | tpo_head | 200 | 400, 401, 403, 404, 409 |
| GET | `/staff/registry/indicators` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| POST | `/staff/registry/indicators/:id/revoke` | tpo_head | 200 | 400, 401, 403, 404, 409 `ALREADY_REVOKED` |
| GET | `/lookup` | student, placement_officer, tpo_head | 200 | 400, 401, 403, 429 |
| GET | `/staff/advisories` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| GET | `/staff/advisories/audience-count` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| POST | `/staff/advisories` | placement_officer, tpo_head | 201 | 400 (incl. `INVALID_INDICATOR`, `INVALID_SOURCE_CASE`, `CONTAINS_STUDENT_IDENTITY`, `SENSITIVE_ID_DETECTED`), 401, 403 |
| GET | `/staff/advisories/:id` | placement_officer, tpo_head | 200 | 401, 403, 404 |
| PATCH | `/staff/advisories/:id` | author or tpo_head (drafts) | 200 | 400, 401, 403, 404, 409 `ADVISORY_NOT_EDITABLE` |
| POST | `/staff/advisories/:id/publish` | tpo_head | 200 | 400 `INVALID_INDICATOR`, 401, 403, 404, 409 |
| POST | `/staff/advisories/:id/withdraw` | tpo_head | 200 | 400, 401, 403, 404, 409 |
| GET | `/advisories` | student | 200 | 401, 403 |
| GET | `/advisories/:id` | student | 200 | 401, 403, 404 |
| POST | `/advisories/:id/ack` | student | 200 | 401, 403, 404 |
| GET | `/notifications` | student, placement_officer, tpo_head | 200 | 400, 401, 403 |
| GET | `/notifications/unread-count` | student, placement_officer, tpo_head | 200 | 401, 403 |
| POST | `/notifications/:id/read` | owner | 200 | 401, 403, 404 |
| POST | `/notifications/read-all` | student, placement_officer, tpo_head | 200 | 401, 403 |
| GET | `/staff/stats` | placement_officer, tpo_head | 200 | 400, 401, 403 |
| GET | `/files/:token` | the user the link was issued to (session required) | 200 (file stream) | 401 `UNAUTHENTICATED` / `LINK_INVALID`, 404 |

Any authenticated route can also return `403 PASSWORD_CHANGE_REQUIRED` or `403 ACCOUNT_PENDING_APPROVAL` (except the three allowed auth routes). Every response carries an `X-Request-Id` header.

### `GET /health`

```json
{ "status": "ok", "service": "offershield-api", "version": "0.1.0", "commit": null, "environment": "development",
  "uptimeSeconds": 12, "timestamp": "2026-11-10T07:30:00.000Z", "database": "connected" }
```

`database` is `"connected"` when the mongoose connection is open, otherwise `"disconnected"`. `commit` is `RENDER_GIT_COMMIT` when set (Phase 7).

### `POST /auth/register`

Request: `{ "name", "email", "password", "collegeCode", "joinCode", "year": 1-5, "branch", "acceptPolicies": true }`

- `email` is lowercased. In `email_domain` colleges its domain must be one of the college's `emailDomains`; in `manual_approval` colleges any valid address is accepted and the user starts as `pending_approval` (staff get a `student_pending` notification).
- `acceptPolicies` must be `true`; `policiesAcceptedAt` and `policiesVersion` are stored on the user.
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

`200 { "user": SafeUser, "college": { "id", "name", "code", "branches", "studentVerification", "isDemo" } | null }` (`null` for super admin). Also works for `pending_approval` users.

### `POST /auth/change-password`

Request: `{ "currentPassword", "newPassword" }`. The new password must meet the policy and differ from the current one. Sets `mustChangePassword=false`, increments `tokenVersion` (all older sessions stop working) and issues a new cookie. `200 { "user": SafeUser }`. Audit: `auth.password_change`.

### `POST /admin/colleges`

Request: `{ "name", "code", "emailDomains": ["college.edu"], "branches"?: ["COMP", …], "studentVerification"?: "email_domain" | "manual_approval" }` (`isDemo` is rejected: strict schema)

Response `201`: `{ "college": CollegeView, "studentJoinCode": "K7Q2M9XHRA" }` — a 10-character code from an unambiguous alphabet (no 0/O/1/I/L). **Returned only here and on rotation**; only its hash is stored. Audit: `college.create`.

### `GET /admin/colleges` / `GET /admin/colleges/:id`

`200 { "colleges": CollegeView[] }` / `200 { "college": CollegeView }`. Malformed or unknown id → 404.

### `PATCH /admin/colleges/:id`

Request (at least one): `{ "name"?, "emailDomains"?, "branches"?, "status"?: "active" | "suspended", "studentVerification"? }` (`isDemo` → 400). `code` cannot be changed. `200 { "college": CollegeView }`. Suspending a college immediately blocks logins and live sessions of its users. Audit: `college.update` (`metadata.fields`, and `metadata.status` `{from,to}` when it changes).

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

Never included: `assigneeId`, `priority`, `signals`, `linkedCaseIds`, `studentId`, `collegeId`, `recommendation`, `decisionHistory`, notes, and the decision's `basis`, `checks`, `confirmedIndicators`, `verifiedDomains`, `dismissReason`, `duplicateOfCaseId` and `decidedBy`. `decision` is `{ type, decidedAt, message }` (message = the TPO head's `studentMessage`) or null.

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

`200 { "case": StudentCaseView, "events": [...], "evidence": [{ id, originalName, mime, size, createdAt }] }`. `events` are only those with `visibleToStudent: true`, oldest first, shaped `{ id, type, actor: "student" or "placement_cell" or "system", body, createdAt }`. Staff identities and event `metadata` are never sent to students (Phase 4).

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

### Staff investigation desk (Phase 4)

All routes are under `/staff` (authenticate → enforcePasswordChange → requireTenant) and then `requireRole('placement_officer', 'tpo_head')`; `decision`, `reopen` and `audit` are `tpo_head` only. Students and the super admin get 403. Any `:id` that is not a case of the caller's college → 404 on every endpoint. Bodies and queries are strict. Every mutation answers with the refreshed **StaffCaseView** (`{ "case": … }`), writes its CaseEvent and audit entry after the atomic update succeeds, and updates `lastActivityAt`.

#### `GET /staff/cases`

| Query | Values |
| --- | --- |
| `status` | a case status, `open` or `closed` |
| `priority` | normal, high |
| `assignee` | `me`, `unassigned` or a user id |
| `channel` | a channel |
| `q` | matches exact caseNumber (case-insensitive), a claimedCompany substring (regex characters escaped), or an indicator value equal to `q` run through the phone/domain/email/UPI/URL normalisers (so `98765 43210` finds `+919876543210`) |
| `from`, `to` | createdAt range |
| `sort` | lastActivity (default), created, priority |
| `page`, `limit` | limit 1–50, default 20 |

Response `{ cases: [{ id, caseNumber, claimedCompany, roleTitle, channel, status, priority, student: { name, year, branch }, assignee: { id, name } or null, evidenceCount, lastActivityAt, createdAt, isStale }], page, limit, total }`. `isStale` = open and `lastActivityAt` older than `CASE_STALE_DAYS` (default 3).

#### `GET /staff/cases/counts`

`{ counts: { submitted, under_review, awaiting_student, open, closed, unassignedOpen, staleOpen } }`.

#### `GET /staff/cases/:id` — StaffCaseView

All case fields plus `priority`, `isStale`, `student { id, name, email, year, branch }`, `assignee`, `recommendation { type, basis, by, at }`, `decision` (full, with `decidedBy { id, name, role }`), `decisionHistory` (with `reopenedBy`, `reopenedAt`, `reopenReason`), `signals`, `linkedCaseIds`, `events` (all, each with `visibleToStudent`, `actor`, `metadata`), `notes` (separate array) and `evidence` (`id, originalName, mime, size, sha256, metadataStripped, createdAt` — never `gridFsId`).

#### `PATCH /staff/cases/:id/assign` — `{ "assigneeId": "<id>" or null }`

Assignee must be an active placement_officer/tpo_head of the same college (else 400 `INVALID_ASSIGNEE`; other colleges' users are simply not found). Officers may only assign themselves or release their own assignment (403 otherwise). Assigning a `submitted` case atomically moves it to `under_review` with a visible `status_changed` event. Writes an internal `assigned` event. Audit `case.assign`.

#### `PATCH /staff/cases/:id/status` — `{ "status": "under_review", "reason"? }`

Only `submitted` or `awaiting_student` → `under_review`; any other value fails validation (final statuses can never be set here). Visible `status_changed` event with a generic body. Audit `case.status_change`.

#### `POST /staff/cases/:id/info-request` — `{ "message": "10–2000" }`

Open case → `awaiting_student`; visible `info_requested` event with the message. Audit `case.info_request`. Closed → 409 `CASE_CLOSED`.

#### `POST /staff/cases/:id/messages` — `{ "body": "1–3000" }`

Visible `staff_message`; status unchanged. Closed → 409. Audit `case.staff_message`.

#### `POST /staff/cases/:id/notes` — `{ "body": "1–5000" }`

Creates a staff-only Note (open or closed cases). Audit `case.note_add` (metadata: note id and length only).

#### `POST /staff/cases/:id/recommendation` — `{ "type", "basis": "10–2000" }`

Open cases only; replaces any previous recommendation; internal `recommendation_made` event. Audit `case.recommend`.

#### `POST /staff/cases/:id/decision` (tpo_head)

`{ type, basis, checks, studentMessage, confirmedIndicators?, verifiedDomains?, dismissReason?, duplicateOfCaseId? }` — rules in DATA_MODEL.md. One atomic update (`status ∈ open statuses`) sets the status, `decision` and `lastActivityAt`; the assignee is kept. Then a visible `decision_recorded` event (body = studentMessage only) and a visible `status_changed` event. Audit `case.decision` with `{ type, checks, confirmedIndicatorCount, verifiedDomainCount, dismissReason }` — never the basis or message. Concurrent decisions: exactly one 200, the other 409 `INVALID_TRANSITION`. No registry entries are created here (Phase 5).

#### `POST /staff/cases/:id/reopen` (tpo_head) — `{ "reason": "10–1000" }`

Final status only (else 409). Pushes the current decision to `decisionHistory` with `reopenedBy/At/Reason`, sets `decision=null` and `under_review`. Visible `reopened` event with the generic body "Your request has been reopened for further review."; the reason is kept in event metadata (never sent to students). Audit `case.reopen` `{ previousStatus, previousDecisionType }`.

#### `GET /staff/audit` (tpo_head)

Query `action`, `entityType`, `entityId`, `actorId`, `from`, `to`, `page`, `limit` (≤ 100, default 25). College-scoped, newest first. `{ entries: [{ id, actor: { id, name, role }, action, entity: { type, id }, metadata, createdAt }], page, limit, total }`.

### Registry, lookup, links and signals (Phase 5)

No route creates a fraud indicator (`POST /staff/registry/indicators` → 404). Every registry, lookup and link query is college-scoped; another college's ids → 404.

#### `GET /lookup?q=` (student, placement_officer, tpo_head)

`q`: 3–200 characters (strict query). Per-user limit `LOOKUP_LIMIT_PER_10MIN` (default 60) → 429. Detection order: email → UPI → phone → URL (http/https) → domain → company text.

| Check | Matches |
| --- | --- |
| fraud | active indicators equal to the value; plus, for email/URL/domain, the domain, the host and the registrable domain. Never for company text. |
| verified | verified recruiters owning the domain/host (same domain or a parent listed in `domains`), exact contact email or phone, or (company text) an escaped case-insensitive substring of `companyName`. Free-mail domains never match. |
| lookalike | only for domain-bearing queries with no verified match: any verified recruiter domain for which `isLookalike` is true |

`resultStatus` precedence: `confirmed_fraud` > `lookalike_warning` > `verified` > `verified_expired` > `not_reviewed`.

```json
{
  "resultStatus": "lookalike_warning",
  "queryType": "domain",
  "fraudMatches": [{ "type": "upi", "value": "x@ybl", "confirmedAt": "ISO" }],
  "verifiedRecruiters": [{ "id": "…", "companyName": "Infosys", "domains": ["infosys.com"], "methods": ["called_official_number"], "verifiedAt": "ISO", "expiresAt": "ISO", "isExpired": false }],
  "lookalikeOf": [{ "companyName": "Infosys", "domain": "infosys.com" }],
  "guidance": "fixed text per status"
}
```

Never included: case or student data, `sourceCaseIds` (staff callers get `fraudMatches[].sourceCases [{ id, caseNumber }]`), `evidenceNote`, verifier names, pending or suspended recruiters. Guidance never uses "safe" or "genuine"; `not_reviewed` says "Not reviewed does not mean safe." A LookupEvent (no query text) is stored.

#### `/staff/registry/recruiters`

- `GET` — `q` (escaped company substring, or exact domain/email/phone), `status`, `page`, `limit ≤ 50`. Items include verification (with evidenceNote and verifier), history, `isExpired`.
- `POST` — `{ companyName, domains, contactEmails?, contactPhones?, methods, evidenceNote, expiresInDays? (30–730, default RECRUITER_VERIFICATION_DAYS=365), sourceCaseId? }`. Officer → `pending_approval`; head → `verified` (verifiedBy, verifiedAt, expiresAt). Audit `recruiter.create`.
- `PATCH /:id` — `{ companyName?, domains?, contactEmails?, contactPhones?, methods?, evidenceNote?, expiresInDays? }`. Head: any record; officer: only own pending. Domain change on a verified record requires methods + evidenceNote and pushes history. Audit `recruiter.update` (field names only).
- `POST /:id/approve` (head) pending → verified; `/:id/renew` (head) `{ methods, evidenceNote, expiresInDays? }` verified only, pushes history; `/:id/suspend` (head) `{ reason 10–500 }`. Audited.

Recruiter changes recompute signals of the college's open cases.

#### `/staff/registry/indicators`

- `GET` — `type`, `status`, `q` (normalised exact), `page`, `limit ≤ 100`. Items: `{ id, type, value, status, sourceCases [{ id, caseNumber }], firstConfirmedAt, lastConfirmedAt, revokedAt, revokeReason }`.
- `POST /:id/revoke` (head) `{ reason 10–500 }` → revoked; audit `indicator.revoke` (no reason text); signals recomputed.

#### Links and signals on a case

- `POST /staff/cases/:id/links` `{ caseId }` → reason `manual` on both cases; audit `case.link`; staff-only `linked` events.
- `DELETE /staff/cases/:id/links/:otherId` → removed on both sides; audit `case.unlink`.
- `POST /staff/cases/:id/signals/recompute` (empty body) → refreshed StaffCaseView.

StaffCaseView now also has `signals`, `signalsComputedAt` and `related [{ caseId, caseNumber, status, claimedCompany, reasons, sharedIndicators, similarity, detectedAt }]`; queue items have `relatedCount` and `topSignal`. Student views never include `signals`, `related`, `linkedCaseIds` or `textHash`.

#### Decision side effects (Phase 5)

- `confirmed_fraud`: before the atomic update, any confirmed indicator whose domain (domain, email domain or URL host) belongs to a verified recruiter → 409 `CONFLICTS_WITH_VERIFIED_RECRUITER` with `details`. After the update: each confirmed indicator is upserted active with the case as a source; audit `indicator.publish`; open cases carrying them get signals recomputed.
- Reopen of a confirmed_fraud case: the case is removed as a source; indicators left with no source are revoked (`source_case_reopened`); audit `indicator.revoke`; signals recomputed.

### Advisories, notifications and stats (Phase 6)

#### Staff advisories (`/staff/advisories`)

- `GET /` — `status`, `page`, `limit ≤ 50`. Items: `{ id, title, body, severity, target, indicators [{ id, type, value, status }], indicatorIds, sourceCaseId, status, needsReview, publishedAt, withdrawnAt, withdrawReason, expiresAt, audienceCount, acknowledgedCount, ackRate, … }`. `needsReview` is true when any linked indicator is no longer active. `audienceCount` is live for drafts and the notified count for published advisories.
- `GET /audience-count?years=1,2&branches=COMP` → `{ audienceCount }` (active students; empty = all).
- `POST /` — `{ title, body, severity?, target?, indicatorIds?, sourceCaseId?, expiresAt? }` → draft. Validations: branches of the college; indicators ACTIVE in the college; source case confirmed_fraud in the college; privacy guard on title/body; no student name/email when `sourceCaseId` is set; `expiresAt` in the future. Audit `advisory.create`.
- `GET /:id` — staff view plus `acknowledgementBreakdown { byYear [{ year, count }], byBranch [{ branch, count }] }` (counts only).
- `PATCH /:id` — drafts only (409 `ADVISORY_NOT_EDITABLE`), author or head (403). Same validations. Audit `advisory.update` (field names).
- `POST /:id/publish` (head) — draft only; indicators must still be active; sets published/publishedBy/publishedAt/audienceCountAtPublish; fans out `advisory_published` notifications (insertMany in batches of 500). Audit `advisory.publish { audienceCount, indicatorCount }`.
- `POST /:id/withdraw` (head) `{ reason 10–500 }` — published only. Audit `advisory.withdraw`.

#### Student advisories (`/advisories`, student only)

- `GET /` → `{ advisories: [{ id, status, title, body, severity, publishedAt, acknowledged, indicators [{ type, value }] }] }` — published, not expired, targeted at the student's year and branch; unacknowledged first (critical first), then newest. Only ACTIVE indicators; never `sourceCaseId`, authors or withdrawn advisories.
- `GET /:id` — same shape; 404 when not visible, except `{ advisory: { id, status: 'withdrawn' } }` for a withdrawn advisory the student was notified about.
- `POST /:id/ack` → `{ acknowledged: true }`, idempotent; 404 when not visible.

#### Notifications (`/notifications`; students and staff; super admin 403)

- `GET /?unread=true&page=&limit=` → `{ notifications: [{ id, type, title, body, link, read, createdAt }], page, limit, total, unreadCount }`.
- `GET /unread-count` → `{ unreadCount }`; `POST /:id/read` (another user's or college's id → 404); `POST /read-all` → `{ updated }`.

| Event | Recipients | Type | Link |
| --- | --- | --- | --- |
| Student creates a case | all active staff | case_submitted | /staff/cases/:id |
| Student replies | the active assignee, else all active staff | case_student_reply | /staff/cases/:id |
| Info request | the student | case_info_requested | /student/requests/:id |
| Staff message | the student | case_staff_message | /student/requests/:id |
| Decision | the student (includes the student message, ≤ 200 chars) | case_decision | /student/requests/:id |
| Reopen | the student (generic text) | case_reopened | /student/requests/:id |
| Assignment | the new assignee | case_assigned | /staff/cases/:id |
| Recommendation | all active TPO heads | case_recommendation | /staff/cases/:id |
| Advisory published | targeted active students | advisory_published | /advisories/:id |

The actor is never notified about their own action. Delivery is in-app only; the client polls `unread-count` every 30 s.

#### `GET /staff/stats?from=&to=` (placement_officer, tpo_head; default last 90 days)

`{ stats: { range, cases: { byStatus, byChannel, createdPerWeek [8 × { week: 'YYYY-Www', weekStart, count }], openCount, staleOpenCount, unassignedOpenCount }, decisions: { byType, medianHoursToDecision }, money: { casesWithFeeRequested, totalAmountRequested, studentsReportedPaid }, registry: { activeFraudIndicators, verifiedRecruiters, expiredRecruiters, pendingRecruiters }, lookups: { <resultStatus>: count }, advisories: { publishedCount, overallAckRate }, relatedCaseLinks } }`. Range-based: case breakdowns, money, lookups and relatedCaseLinks (by createdAt) and decisions (by decidedAt). Current snapshot: open/stale/unassigned counts, registry and advisories.

### Pilot readiness (Phase 7)

#### `GET /health/ready`

`200 { "status": "ready", "database": "connected" }` or `503 { "status": "unavailable", "database": "disconnected" }`. Use it as the Render health check.

#### `GET /policies`

`200 { "version": "2026-11-12", "retentionMonths": 12, "supportEmail": "…" | null }` for the privacy and terms pages.

#### Students (`/staff/students`, placement_officer and tpo_head, own college only)

- `GET /?status=pending_approval|active|disabled|rejected&year=&branch=&q=&page=&limit≤100` → `{ students: [{ id, name, email, year, branch, status, mustChangePassword, createdAt, lastLoginAt }], page, limit, total, pendingCount }`. `q` matches name or email (regex-escaped).
- `POST /:id/approve` (empty body) — from `pending_approval` or `rejected` → `active`. `{ student }`. Audit `student.approve`.
- `POST /:id/reject` `{ reason? ≤ 500 }` — from `pending_approval` → `rejected`, sessions revoked. Audit `student.reject` (`hasReason` only).
- `POST /bulk-approve` `{ ids: [1–100 ids] }` → `{ approved: [ids], skipped: n }`; ids of other colleges, non-pending or unknown students are skipped. One `student.approve` audit entry per student.
- `PATCH /:id/status` `{ status: "active" | "disabled" }` — active ↔ disabled only; disabling revokes sessions. Audit `student.status_change`.
- Another college's id → 404; a staff account id → 404.

#### Password resets

- `POST /staff/users/:id/reset-password` (empty body): tpo_head → placement officers and students; placement_officer → students. `200 { user: StaffSummary, temporaryPassword }` (returned once). Sets `mustChangePassword=true`, increments `tokenVersion`. Self → 400 `CANNOT_MODIFY_SELF`; a role you may not reset (incl. any TPO head) → 403; another college → 404. Audit `user.password_reset { targetRole }`.
- `POST /admin/users/:id/reset-password` (super_admin): TPO heads only; any other id → 404.

#### Notifications

New type `student_pending` → all active staff, link `/staff/students`, text "New student awaiting approval" (no name or email).

#### Production behaviour

In production the same service serves the client: non-`/api` GETs that accept HTML return `index.html` (`Cache-Control: no-cache`), `/assets/*` are immutable for a year, unknown `/api/*` stay JSON 404.

### Accounts, Google sign-in and email (Phase 9)

| Method | Path | Roles | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/policies` | public | 200 adds `googleEnabled`, `emailEnabled` (booleans) | — |
| GET | `/auth/me` | signed in | 200 adds `emailVerificationRequired`; `user` adds `emailVerified`, `authMethods` | 401 |
| POST | `/auth/verify-email` `{ code }` | signed in | 200 `{ user }` | 400 `INVALID_CODE` / `VALIDATION_ERROR`, 401, 429 |
| POST | `/auth/resend-verification` | signed in | 200 `{ sent, retryAfterSeconds }` | 429 `RESEND_TOO_SOON` / `RESEND_LIMIT` (`details.retryAfterSeconds`), 401 |
| POST | `/auth/forgot-password` `{ email }` | public | 202 `{ message }` (always the same) | 400, 429 `RATE_LIMITED` (20/h per IP, 3/h per address) |
| POST | `/auth/reset-password` `{ token, newPassword }` | public | 200 `{ message }` | 400 `INVALID_TOKEN` / `VALIDATION_ERROR`, 429 |
| GET | `/auth/google/start?intent=login|register` | public | 302 to Google; sets `os_oauth` | 400, 404 when Google is not configured |
| GET | `/auth/google/callback` | public (Google redirect) | 302 to `/student`, `/staff`, `/admin`, `/pending-approval` (session set) or `/register/google[?notice=no_account]` (sets `os_google_signup`) | 302 `/login?error=google_failed` or `/login?error=account_unavailable`; 404 when not configured |
| GET | `/auth/google/pending` | Google sign-up in progress | 200 `{ email, name }` | 401 `GOOGLE_SIGNUP_EXPIRED` |
| POST | `/auth/google/complete` `{ collegeCode, joinCode, year, branch, acceptPolicies: true }` | Google sign-up in progress | 201 `{ user }` + session | 400 `REGISTRATION_REJECTED` / `VALIDATION_ERROR`, 401 `GOOGLE_SIGNUP_EXPIRED`, 409 `EMAIL_TAKEN`, 429 |
| GET | `/account` | any signed-in role | 200 `{ account }` (safe user + `hasPassword`, `emailPrefs`) | 401, 403 gates |
| PATCH | `/account` `{ name?, year?, branch?, emailPrefs? }` | any signed-in role (year/branch students only) | 200 `{ account }` | 400, 401, 403 gates |
| POST | `/staff/students/promote-year` `{ fromYear: 1-4 }` | `tpo_head` | 200 `{ promoted, fromYear, toYear }` | 400, 401, 403 |
| POST | `/staff/students/:id/approve` | staff | (unchanged) | adds 409 `EMAIL_NOT_VERIFIED` |
| GET | `/staff/students` | staff | students add `emailVerified`, `authMethods` | — |
| GET | `/staff/advisories/:id` | staff | adds `emailStats: { sent, audience } | null` | — |
| POST | `/auth/change-password` | signed in | (unchanged) | adds 400 `PASSWORD_NOT_SET` (Google-only) |

Every authenticated route except `/auth/me`, logout, change-password, verify-email and resend-verification returns `403 EMAIL_NOT_VERIFIED` while verification is required and pending; the server checks email verification first, then the temporary password, then pending approval; the client shows the verify-email page first, then the pending page, then change-password.

## Planned route groups (not implemented)

| Group | Phase | Purpose |
| --- | --- | --- |
