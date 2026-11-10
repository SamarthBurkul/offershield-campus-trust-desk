# Data Model

> **Status:** `colleges`, `users`, `auditlogs` (Phase 2) and `counters`, `cases`, `caseevents`, `evidences` + GridFS bucket `evidence` (Phase 3) are **implemented**. The case schema is final for Phases 4–5. Other collections are planned.

## Global rules

1. **Every college-owned document has a `collegeId`** (ObjectId, required, indexed). Every query on such a collection goes through `tenantRepository`, which AND-s the session's `collegeId` into the filter.
2. **Internal notes live in a separate collection (`notes`) from student-visible case events (`caseEvents`).** Student-facing endpoints never read `notes`.
3. All documents have `createdAt` / `updatedAt` timestamps (`auditLogs` has `createdAt` only).
4. No Aadhaar, PAN or similar government identity numbers are stored.
5. Allegations are stored as allegations; only an authorised decision creates confirmed `indicators`.
6. Secrets are stored only as bcrypt hashes and are excluded from queries by default (`select: false`).

## Implemented collections (Phase 2)

### `colleges` — model `College` (`server/src/models/College.js`)

| Field | Type | Rules |
| --- | --- | --- |
| `name` | String | required, trimmed, ≤ 200 |
| `code` | String | required, **unique**, lowercase slug `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–20 chars |
| `emailDomains` | [String] | ≥ 1, lowercase domains (e.g. `alpha.demo.edu`) |
| `branches` | [String] | uppercase; default `COMP, IT, EXTC, MECH, CIVIL, AIDS` |
| `studentJoinCodeHash` | String | required, bcrypt (cost 12) of the normalised join code, **`select: false`** |
| `status` | String | `active` \| `suspended`, default `active` |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: unique `code`.

### `users` — model `User` (`server/src/models/User.js`)

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId → College | required for `student`, `placement_officer`, `tpo_head`; must be `null` for `super_admin` (pre-validate hook) |
| `role` | String | `student` \| `placement_officer` \| `tpo_head` \| `super_admin` |
| `name` | String | required, ≤ 120 |
| `email` | String | required, **unique (platform-wide)**, lowercase, trimmed |
| `passwordHash` | String | required, bcrypt cost 12, **`select: false`** |
| `status` | String | `active` \| `disabled`, default `active` |
| `mustChangePassword` | Boolean | default `false`; `true` for staff created with a temporary password |
| `tokenVersion` | Number | default 0; incremented on password change and on disable to revoke sessions |
| `year` | Number | 1–5, **students only** (required for students, forbidden otherwise) |
| `branch` | String | uppercase, **students only**, must be one of the college's `branches` (pre-validate hook) |
| `lastLoginAt` | Date | set on login / registration |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: unique `email`; `{ collegeId: 1, role: 1 }`.

### `auditlogs` — model `AuditLog` (`server/src/models/AuditLog.js`)

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId → College | `null` for platform-level actions |
| `actorId` | ObjectId → User | who acted |
| `actorRole` | String | role at the time of the action |
| `action` | String | e.g. `college.create`, `college.update`, `college.join_code_rotate`, `staff.create`, `staff.status_change`, `auth.register`, `auth.password_change` |
| `entityType` | String | `college` \| `user` |
| `entityId` | ObjectId | affected record |
| `metadata` | Object | non-secret context (e.g. `{ from: 'active', to: 'disabled' }`); keys matching password/hash/token/secret/joinCode are stripped |
| `ip` | String | request IP |
| `createdAt` | Date | no `updatedAt` |

Indexes: `collegeId`; `{ collegeId: 1, createdAt: -1 }`.

**Append-only:** pre-hooks throw on `updateOne`, `updateMany`, `findOneAndUpdate`, `findOneAndReplace`, `findOneAndDelete`, `replaceOne`, `deleteOne`, `deleteMany`, `bulkWrite` and on re-saving an existing document. No API route reads, updates or deletes audit entries yet.

## Implemented collections (Phase 3)

Shared enums live in `server/src/constants/caseStatus.js` (`CASE_STATUSES`, `CLOSED_STATUSES`, `CHANNELS`, `MONEY_PURPOSES`, `CASE_EVENT_TYPES`, `EVIDENCE_LIMITS`).

### `counters` — model `Counter`

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId → College | required |
| `key` | String | e.g. `case` |
| `seq` | Number | incremented atomically (`findOneAndUpdate` + `$inc` + upsert) |

Indexes: unique `{ collegeId: 1, key: 1 }`.

### `cases` — model `Case`

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId | required (from session) |
| `caseNumber` | String | `OS-<COLLEGE CODE UPPERCASE>-<seq, 4+ digits>`, e.g. `OS-DEMO-ALPHA-0001`; unique per college |
| `studentId` | ObjectId → User | required (from session) |
| `claimedCompany` | String | 2–120 |
| `roleTitle` | String or null | ≤ 120 |
| `channel` | String | whatsapp, telegram, email, linkedin, instagram, job_portal, sms, phone_call, other |
| `receivedAt` | Date | not in the future (5 min clock-skew allowance) |
| `messageText` | String | 10–5000 |
| `links` | [String] | ≤ 10, http/https only, ≤ 500 chars; **stored as text, never fetched** |
| `contacts` | { emails[] ≤5, phones[] ≤5, upiIds[] ≤5 } | as entered (emails/UPI lowercased) |
| `moneyRequested` | { requested: Boolean, amount: Number ≥0 or null, purpose: enum or null } | amount/purpose forced to null when not requested |
| `paidAlready`, `documentsShared` | Boolean | documentsShared is yes/no only |
| `studentNote` | String or null | ≤ 2000 |
| `consentAt` | Date | required; set by the server when `consent: true` |
| `status` | String | submitted (default), under_review, awaiting_student, confirmed_fraud, verified_genuine, inconclusive, dismissed; the last four are `CLOSED_STATUSES` |
| `priority` | String | normal or high; high when money was requested or already paid |
| `assigneeId` | ObjectId or null | Phase 4 |
| `indicators` | [{ type: email/domain/phone/upi/url, value, source: student_entered/extracted }] | extracted at creation, extended on student replies (max 100) |
| `signals` | [Mixed] | Phase 5 |
| `linkedCaseIds` | [ObjectId] | Phase 5 |
| `decision` | { type, basis, decidedBy, decidedAt } or null | Phase 4 |
| `lastActivityAt` | Date | updated on create, reply and evidence upload |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: unique `{ collegeId, caseNumber }`; `{ collegeId, status, createdAt: -1 }`; `{ collegeId, studentId, createdAt: -1 }`; `{ collegeId, 'indicators.type', 'indicators.value' }`.

### `caseevents` — model `CaseEvent`

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId`, `caseId` | ObjectId | required |
| `type` | String | created, student_message, evidence_added, status_changed, info_requested, staff_message, assigned, decision_recorded, reopened |
| `actorId`, `actorRole` | ObjectId, String | who acted |
| `body` | String or null | ≤ 3000 |
| `visibleToStudent` | Boolean | **required, no default** — every writer decides explicitly |
| `metadata` | Object | e.g. `{ from, to }`, `{ count, names }` |
| `createdAt` | Date | no updatedAt |

Indexes: `{ collegeId, caseId, createdAt }`. Internal staff notes are **not** stored here (separate collection in Phase 4).

### `evidences` — model `Evidence` (bytes in GridFS)

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId`, `caseId`, `uploadedBy` | ObjectId | required |
| `originalName` | String | sanitised: basename only, `[A-Za-z0-9 _-]`, extension of the detected type, ≤ 100 |
| `mime` | String | image/png, image/jpeg or application/pdf — detected from magic bytes |
| `size` | Number | bytes as stored (after metadata stripping) |
| `sha256` | String | hash of the stored bytes |
| `gridFsId` | ObjectId | file in bucket `evidence` |
| `metadataStripped` | Boolean | true for PNG/JPEG, false for PDF |
| `createdAt` | Date | |

Indexes: `{ collegeId, caseId, createdAt }`.

### GridFS layout

Bucket `evidence` → collections `evidence.files` and `evidence.chunks` (default 255 KB chunks). Each `evidence.files` document has `filename` (sanitised name) and `metadata: { collegeId, caseId, uploadedBy, contentType }`. Files are only ever reached through an `Evidence` record found via the tenant repository; there is no route that addresses GridFS ids directly.

### Write order (no transactions)

Create case → create `created` event (on failure the case is deleted). Evidence: validate all files → store each in GridFS → create its `Evidence` doc → `evidence_added` event (on any failure, this request's Evidence docs and GridFS files are deleted).

## Planned collections

| Collection | Phase | Purpose | Key fields |
| --- | --- | --- | --- |
| `notes` | 4 | Staff-only internal notes | `collegeId`, `caseId`, `authorId`, `body`, `editedAt` |
| `decisions` | 4 | Final TPO decision with reasons | `collegeId`, `caseId`, `outcome` (verified_genuine/confirmed_suspicious/inconclusive), `reason`, `decidedBy`, `decidedAt` |
| `recruiters` | 5 | Reviewed recruiter records | `collegeId`, `name`, `officialDomains[]`, `status`, `sourceCaseIds[]`, `reviewedBy` |
| `indicators` | 5 | Confirmed suspicious indicators | `collegeId`, `type`, `value`, `normalizedValue` (indexed), `recruiterId`, `sourceCaseId`, `decisionId`, `active` |
| `advisories` | 6 | TPO-published advisories | `collegeId`, `title`, `body`, `severity`, `audience`, `publishedBy`, `status` |
| `acknowledgements` | 6 | Student acknowledgement of advisories | `collegeId`, `advisoryId`, `userId` (unique with `advisoryId`) |
| `notifications` | 6 | In-app notifications | `collegeId`, `userId`, `type`, `title`, `link`, `readAt` |

## Key indexes (planned)

- `{ collegeId: 1, ... }` as the leading key on every college-owned collection.
- `indicators`: `{ collegeId: 1, type: 1, normalizedValue: 1 }`.
- `acknowledgements`: `{ advisoryId: 1, userId: 1 }` unique.
