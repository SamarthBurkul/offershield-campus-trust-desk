# Product Scope

## Definition

OfferShield is a **Campus Recruitment Trust & Verification Desk**. Each college (tenant) runs its own desk where:

- students look up the college's **reviewed recruiter records** and **confirmed suspicious indicators** (for example, a domain, email address, phone number or payment demand pattern confirmed in an earlier decision);
- students submit **structured verification requests** with evidence when an external job or internship offer looks suspicious;
- placement staff investigate each request as a **case**;
- the TPO head records the **final decision with reasons**;
- confirmed findings are added to the **college registry**;
- the TPO publishes **targeted advisories** to the students who need them.

The system is multi-tenant: one tenant is one college, and data never crosses colleges.

## What OfferShield is NOT

- Not a scam-detector AI. It does not label offers as genuine or fraudulent on its own.
- Not a placement ERP (no drive scheduling, eligibility, results or student records management).
- Not a job portal or job board.
- Not a recruiter marketplace; recruiters cannot self-register in the MVP.
- Not an applicant tracking system (ATS).

**Core rule:** automated checks (format checks, registry matches, duplicate detection) only **assist** staff. They never decide whether an offer is genuine or fraudulent. Only an authorised TPO role records a final decision, and allegations are never displayed as confirmed fraud.

## Core workflow (10 steps)

1. A student receives an external job or internship offer that seems suspicious.
2. The student searches the college registry for the recruiter and any confirmed indicators.
3. If the concern remains, the student submits a structured verification request (recruiter details, contact channels, what was asked of them) with evidence files.
4. The system creates a case scoped to the student's college and runs assistive checks (registry matches, duplicates) for staff.
5. A placement officer is assigned and triages the case.
6. The officer investigates, records internal notes (never visible to the student) and may request more information from the student.
7. The student responds through the case timeline (student-visible case events only).
8. The TPO head reviews the investigation and records the final decision with reasons.
9. Confirmed findings from that decision are added to the college registry as recruiter records and indicators.
10. The TPO publishes an advisory to the targeted students and tracks acknowledgements; the student who raised the case is notified of the outcome.

## Roles

| Role | Scope | Main abilities |
| --- | --- | --- |
| `student` | Own cases in own college | Search registry, submit requests, view own case timeline, respond to info requests, read and acknowledge advisories |
| `placement_officer` | Own college | Triage and investigate cases, internal notes, request information, propose outcomes |
| `tpo_head` | Own college | Everything a placement officer can do, plus record final decisions, manage registry entries, publish advisories |
| `super_admin` | Platform | Onboard colleges and their first TPO head; no routine access to college case content |

## Priorities

### P0 (MVP)

- College tenancy, authentication and role-based access control
- Student verification requests with validated evidence upload (private storage)
- Case lifecycle with student-visible events and separate internal notes
- Final decisions by the TPO head with mandatory reasons
- College registry of reviewed recruiters and confirmed indicators, searchable by students
- Targeted advisories with acknowledgements
- Audit log of important admin actions
- Cross-college isolation tests

### P1

- In-app notifications for case updates and advisories
- Assistive checks: registry matching and duplicate-case detection
- Staff case queue filters and assignment
- Basic dashboard counts (open cases, decisions this month)

### P2

- Email notifications
- Advisory templates
- Bulk registry import by the TPO
- Data export for a single case (non-PDF)

## Deferred (out of scope for the MVP)

- Advanced AI (classification, LLM analysis of offers)
- Cross-college shared network of indicators
- Recruiter portal
- Browser extension
- WhatsApp integration
- Domain-monitoring background jobs
- PDF evidence pack generation
- Complex analytics
