# Data Model

> **Status:** Phases 2–5 collections are **implemented**: `colleges`, `users`, `auditlogs`; `counters`, `cases`, `caseevents`, `evidences` + GridFS `evidence`; `notes`; `fraudindicators`, `recruiters`, `lookupevents`. Other collections (advisories, notifications) are planned.

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
| `assigneeId` | ObjectId or null | active placement_officer or tpo_head of the same college |
| `indicators` | [{ type: email/domain/phone/upi/url, value, source: student_entered/extracted }] | extracted at creation, extended on student replies (max 100) |
| `signals` | [{ code, severity, message, detail }] | staff-only warning signals (Phase 5) |
| `signalsComputedAt` | Date or null | |
| `linkedCaseIds` | [ObjectId] | mirror of `related[].caseId` |
| `related` | [object] | staff-only related-case links (Phase 5) |
| `textHash` | String or null | 16-hex SimHash of the normalised messageText |
| `recommendation` | { type, basis, by, at } or null | staff-only; see Phase 4 below |
| `decision` | object or null | final TPO-head decision; see Phase 4 below |
| `decisionHistory` | [object] | earlier decisions moved here on reopen |
| `lastActivityAt` | Date | updated on every student and staff action (create, reply, evidence, assign, status, info request, message, note, recommendation, decision, reopen) |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: unique `{ collegeId, caseNumber }`; `{ collegeId, status, createdAt: -1 }`; `{ collegeId, studentId, createdAt: -1 }`; `{ collegeId, 'indicators.type', 'indicators.value' }`.

### `caseevents` — model `CaseEvent`

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId`, `caseId` | ObjectId | required |
| `type` | String | created, student_message, evidence_added, status_changed, info_requested, staff_message, assigned, decision_recorded, reopened, recommendation_made and linked (both always `visibleToStudent=false`) |
| `actorId`, `actorRole` | ObjectId, String | who acted |
| `body` | String or null | ≤ 3000 |
| `visibleToStudent` | Boolean | **required, no default** — every writer decides explicitly |
| `metadata` | Object | e.g. `{ from, to }`, `{ count, names }` |
| `createdAt` | Date | no updatedAt |

Indexes: `{ collegeId, caseId, createdAt }`. Internal staff notes are **not** stored here (see `notes`). Student responses never include event `metadata` (it can hold staff-only data such as a reopen reason).

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

## Implemented in Phase 4

### `notes` — model `Note` (staff-only, append-only)

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId`, `caseId` | ObjectId | required |
| `authorId` | ObjectId → User | required |
| `authorRole` | String | placement_officer or tpo_head |
| `body` | String | 1–5000 |
| `createdAt` | Date | no updatedAt |

Indexes: `{ collegeId, caseId, createdAt }`. Same append-only plugin as `auditlogs` (`models/plugins/appendOnly.js`): updates, replaces, deletes, bulkWrite and re-saves throw. A separate collection so that no student-facing query can read it.

### Case: recommendation, decision and history

`recommendation` (officer or head; replaced on each new recommendation):

| Field | Type |
| --- | --- |
| `type` | confirmed_fraud, verified_genuine, inconclusive or dismissed |
| `basis` | String, 10–2000 |
| `by`, `at` | ObjectId → User, Date |

`decision` (TPO head only; its `type` is the final status it sets):

| Field | Type | Rules |
| --- | --- | --- |
| `type` | String | one of the four final statuses |
| `basis` | String | staff-only; 30–3000 for confirmed_fraud and verified_genuine, else 10–3000 |
| `checks` | [String] | called_official_number, matched_official_domain, checked_official_careers_page, mca_or_gst_lookup, contacted_company_hr, prior_campus_drive, reviewed_student_evidence, other; at least 1 for confirmed_fraud and verified_genuine |
| `studentMessage` | String | 10–1000; the only decision text students see |
| `confirmedIndicators` | [{ type, value }] | confirmed_fraud only, at least 1; each must equal (type + normalised value) an indicator on the case. **Phase 5 builds the registry from this.** |
| `verifiedDomains` | [String] | verified_genuine only, optional; each must be a domain indicator on the case. **Read by Phase 5.** |
| `dismissReason` | String or null | dismissed only: duplicate, not_an_opportunity, insufficient_information, other |
| `duplicateOfCaseId` | ObjectId or null | required for duplicate; another case of the same college |
| `decidedBy`, `decidedAt` | ObjectId → User, Date | |

`decisionHistory`: array of earlier decisions (all fields above) plus `reopenedBy`, `reopenedAt`, `reopenReason` (10–1000, staff-only). Reopen moves the current decision here and sets `decision` to null.

## Implemented in Phase 5

### `fraudindicators` — model `FraudIndicator` (confirmed fraud registry)

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId | required |
| `type` | String | email, domain, phone, upi or url |
| `value` | String | normalised (same normalisers as case indicators) |
| `status` | String | active or revoked |
| `sourceCaseIds` | [ObjectId] | confirmed_fraud cases that confirmed it (`$addToSet`) |
| `firstConfirmedAt`, `lastConfirmedAt` | Date | |
| `createdBy` | ObjectId → User | TPO head of the first decision |
| `revokedAt`, `revokedBy`, `revokeReason` | | `source_case_reopened` or the head's manual reason |
| timestamps | | |

Indexes: unique `{ collegeId, type, value }`; `{ collegeId, status }`. **No API creates one**: only a confirmed_fraud decision publishes, only a reopen or the head's manual revoke revokes.

### `recruiters` — model `Recruiter`

| Field | Type | Rules |
| --- | --- | --- |
| `collegeId` | ObjectId | required |
| `companyName` | String | 2–120 |
| `domains` | [String] | 1–20, normalised (lowercase, punycode, no www.), never free-mail |
| `contactEmails` | [String] | ≤ 10; each on one of `domains` (or a subdomain); never free-mail |
| `contactPhones` | [String] | ≤ 10, `+91…` |
| `status` | String | pending_approval, verified or suspended |
| `verification` | { methods[] ≥1 (decision-check vocabulary), evidenceNote 20–2000, verifiedBy, verifiedAt, expiresAt, validForDays 30–730 } | verifiedBy/At/expiresAt are null while pending |
| `verificationHistory` | [verification + replacedAt, replacedBy] | pushed on renew and on domain changes |
| `sourceCaseId` | ObjectId or null | a case of the same college |
| `createdBy` | ObjectId → User | |
| `suspendedReason` | String or null | |
| `isExpired` (virtual) | Boolean | `status === 'verified' && expiresAt < now` |

Indexes: `{ collegeId, status }`, `{ collegeId, domains }`, `{ collegeId, contactEmails }`, `{ collegeId, contactPhones }`.

### `lookupevents` — model `LookupEvent` (metrics only)

`collegeId`, `userId`, `role`, `queryType` (email, upi, phone, url, domain, company), `resultStatus`, `createdAt`. **The query text is never stored.** Index `{ collegeId, createdAt: -1 }`.

### Case: related cases, signals, text hash

`related[]`: `{ caseId, reasons[] (shared_indicator, similar_text, manual), sharedIndicators[{ type, value }], similarity (0–1, from SimHash distance) or null, linkedBy or null, detectedAt }` — mirrored on both cases, kept in sync with `linkedCaseIds`, same college only.

`signals[]`: `{ code, severity (info, warning, high), message, detail }`, recomputed on create, student reply, registry changes and on demand. Never changes status or priority.

`textHash`: 64-bit SimHash (16 hex) of the normalised `messageText`. Index `{ collegeId, createdAt: -1, textHash: 1 }`.

## Planned collections

| Collection | Phase | Purpose | Key fields |
| --- | --- | --- | --- |
| `advisories` | 6 | TPO-published advisories | `collegeId`, `title`, `body`, `severity`, `audience`, `publishedBy`, `status` |
| `acknowledgements` | 6 | Student acknowledgement of advisories | `collegeId`, `advisoryId`, `userId` (unique with `advisoryId`) |
| `notifications` | 6 | In-app notifications | `collegeId`, `userId`, `type`, `title`, `link`, `readAt` |

## Key indexes (planned)

- `{ collegeId: 1, ... }` as the leading key on every college-owned collection.
- `acknowledgements`: `{ advisoryId: 1, userId: 1 }` unique.
