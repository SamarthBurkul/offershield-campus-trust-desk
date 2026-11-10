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

## Planned route groups (not implemented)

| Group | Phase | Purpose |
| --- | --- | --- |
| `/api/v1/cases` | 3 | Student verification requests with evidence and indicator extraction |
| `/api/v1/cases/:id/evidence` | 3 | Validated uploads (GridFS) and authorised downloads |
| `/api/v1/cases/:id/events`, `/notes`, `/decision` | 4 | Case desk timeline, internal notes, final decisions |
| `/api/v1/registry/*`, `/api/v1/lookup` | 5 | Registry, student lookup, linking, warning signals |
| `/api/v1/advisories`, `/api/v1/notifications`, `/api/v1/stats` | 6 | Advisories, notifications, statistics |
| `/api/v1/audit-logs` | 4 | Read-only audit trail for the TPO head |
