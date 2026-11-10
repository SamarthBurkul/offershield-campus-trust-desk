# Data Model

> **Status: planned — not implemented until Phase 2+.** No database connection or models exist in Phase 1. Field lists are indicative and will be finalised in the phase that implements each collection.

## Global rules

1. **Every college-owned document has a `collegeId`** (ObjectId, required, indexed). Every query on such a collection filters by the `collegeId` from the authenticated session.
2. **Internal notes live in a separate collection (`notes`) from student-visible case events (`caseEvents`).** Student-facing endpoints never read `notes`.
3. All documents have `createdAt` / `updatedAt` timestamps.
4. No Aadhaar, PAN or similar government identity numbers are stored.
5. Allegations are stored as allegations; only an authorised decision creates confirmed `indicators`.

## Collections

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `colleges` | Tenants | `name`, `code` (unique), `emailDomains[]`, `status` (active/suspended), `settings` |
| `users` | All accounts | `collegeId` (null only for `super_admin`), `name`, `email` (unique per college), `passwordHash`, `role` (student/placement_officer/tpo_head/super_admin), `studentProfile` (`rollNumber`, `department`, `graduationYear`), `status`, `lastLoginAt` |
| `cases` | Student verification requests | `collegeId`, `caseNumber` (unique per college), `studentId`, `assignedOfficerId`, `status` (submitted/triage/investigating/awaiting_student/pending_decision/closed), `offer` (`recruiterName`, `claimedCompany`, `roleTitle`, `channel`, `contactEmails[]`, `contactPhones[]`, `websiteUrls[]` (stored as text, never fetched), `paymentRequested`, `amountRequested`), `description`, `assistiveFindings[]`, `decision` (`outcome`: verified_genuine/confirmed_suspicious/inconclusive, `reason`, `decidedBy`, `decidedAt`) |
| `caseEvents` | Student-visible case timeline | `collegeId`, `caseId`, `type` (submitted/status_changed/info_requested/student_response/decision_recorded), `actorId`, `actorRole`, `message`, `visibleToStudent` (always true) |
| `notes` | Staff-only internal notes | `collegeId`, `caseId`, `authorId`, `body`, `editedAt` |
| `evidence` | Uploaded evidence metadata (file stored privately) | `collegeId`, `caseId`, `uploadedBy`, `storageKey`, `originalName`, `mimeType`, `sizeBytes`, `sha256`, `scanStatus` |
| `recruiters` | Reviewed recruiter records in the college registry | `collegeId`, `name`, `legalName`, `officialDomains[]`, `status` (reviewed_genuine/confirmed_suspicious/under_review), `sourceCaseIds[]`, `decisionReason`, `reviewedBy`, `reviewedAt` |
| `indicators` | Confirmed suspicious indicators | `collegeId`, `type` (domain/email/phone/upi_id/payment_pattern/other), `value`, `normalizedValue` (indexed), `recruiterId`, `sourceCaseId`, `decisionId`, `confirmedBy`, `confirmedAt`, `active` |
| `advisories` | TPO-published advisories | `collegeId`, `title`, `body`, `severity`, `audience` (all / departments[] / graduationYears[] / userIds[]), `relatedRecruiterId`, `relatedIndicatorIds[]`, `publishedBy`, `publishedAt`, `status` (draft/published/archived) |
| `acknowledgements` | Student acknowledgement of advisories | `collegeId`, `advisoryId`, `userId` (unique with `advisoryId`), `acknowledgedAt` |
| `notifications` | In-app notifications | `collegeId`, `userId`, `type`, `title`, `link`, `readAt` |
| `auditLogs` | Append-only log of important admin actions | `collegeId`, `actorId`, `actorRole`, `action` (e.g. `decision.recorded`, `indicator.created`, `advisory.published`, `user.role_changed`), `targetType`, `targetId`, `metadata`, `ip`, `at` |

## Key indexes (planned)

- `{ collegeId: 1, ... }` as the leading key on every college-owned collection.
- `users`: `{ collegeId: 1, email: 1 }` unique.
- `cases`: `{ collegeId: 1, caseNumber: 1 }` unique; `{ collegeId: 1, studentId: 1 }`; `{ collegeId: 1, status: 1 }`.
- `indicators`: `{ collegeId: 1, type: 1, normalizedValue: 1 }`.
- `acknowledgements`: `{ advisoryId: 1, userId: 1 }` unique.
