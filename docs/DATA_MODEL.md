# Data Model

> **Status:** `colleges`, `users` and `auditLogs` are **implemented (Phase 2)**. All other collections are planned; their field lists are indicative and will be finalised in the phase that implements them.

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

## Planned collections

| Collection | Phase | Purpose | Key fields |
| --- | --- | --- | --- |
| `cases` | 3 | Student verification requests | `collegeId`, `caseNumber` (unique per college), `studentId`, `assignedOfficerId`, `status`, `offer` (`recruiterName`, `claimedCompany`, `roleTitle`, `channel`, `contactEmails[]`, `contactPhones[]`, `websiteUrls[]` (text only, never fetched), `paymentRequested`, `amountRequested`), `description`, `extractedIndicators[]` |
| `evidence` | 3 | Evidence metadata; file bytes in GridFS (ADR-016) | `collegeId`, `caseId`, `uploadedBy`, `gridFsId`, `originalName`, `mimeType`, `sizeBytes`, `sha256` |
| `caseEvents` | 4 | Student-visible case timeline | `collegeId`, `caseId`, `type`, `actorId`, `actorRole`, `message` |
| `notes` | 4 | Staff-only internal notes | `collegeId`, `caseId`, `authorId`, `body`, `editedAt` |
| `decisions` | 4 | Final TPO decision with reasons | `collegeId`, `caseId`, `outcome` (verified_genuine/confirmed_suspicious/inconclusive), `reason`, `decidedBy`, `decidedAt` |
| `recruiters` | 5 | Reviewed recruiter records | `collegeId`, `name`, `officialDomains[]`, `status`, `sourceCaseIds[]`, `reviewedBy` |
| `indicators` | 5 | Confirmed suspicious indicators | `collegeId`, `type`, `value`, `normalizedValue` (indexed), `recruiterId`, `sourceCaseId`, `decisionId`, `active` |
| `advisories` | 6 | TPO-published advisories | `collegeId`, `title`, `body`, `severity`, `audience`, `publishedBy`, `status` |
| `acknowledgements` | 6 | Student acknowledgement of advisories | `collegeId`, `advisoryId`, `userId` (unique with `advisoryId`) |
| `notifications` | 6 | In-app notifications | `collegeId`, `userId`, `type`, `title`, `link`, `readAt` |

## Key indexes (planned)

- `{ collegeId: 1, ... }` as the leading key on every college-owned collection.
- `cases`: `{ collegeId: 1, caseNumber: 1 }` unique; `{ collegeId: 1, studentId: 1 }`; `{ collegeId: 1, status: 1 }`.
- `indicators`: `{ collegeId: 1, type: 1, normalizedValue: 1 }`.
- `acknowledgements`: `{ advisoryId: 1, userId: 1 }` unique.
