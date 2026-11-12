# Operations

Day-to-day running of an OfferShield pilot. Commands run from the repository root in PowerShell, against the database in `server/.env` (`MONGODB_URI`). Deployment itself is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Onboarding a real college

1. **Super admin creates the college** (Colleges → "Onboard a college"):
   - name and college code (lowercase slug, e.g. `vjti-mumbai`; students type it at registration),
   - email domains (the college's staff domain, e.g. `college.edu`; staff accounts must use it),
   - branches (defaults to COMP, IT, EXTC, MECH, CIVIL, AIDS),
   - **student verification mode**:
     - *College email domain* — students self-register with an address on one of the domains. Choose this when every student has a college email.
     - *Manual approval* — students register with any email and a placement officer approves each account. Choose this when students have no college email.
2. **Copy the student join code** from the one-time panel. It is shown only once; if it is lost, use "Rotate join code" on the college page (the old code stops working immediately).
3. **Send the join code** to the placement cell over a trusted channel (in person, official email). They share it with students together with the college code, e.g. on a notice board or in the placement WhatsApp group. Never post it publicly.
4. **Create the TPO head** (college page → "Create TPO head") with their college email. Hand over the temporary password in person or by phone; they must change it at first sign-in.
5. **The TPO head adds placement officers** (Staff → "Add a placement officer"), again handing over each temporary password personally.
6. The TPO head adds the college's known recruiters to the registry (Registry → Recruiters), so lookups can show verified companies from day one.

The mode can be changed later on the college page; existing accounts are not affected (switching to manual approval does not make active students pending).

## Student accounts

- **Manual approval:** Students → Pending. Check each name and email against the enrolment list; approve (or select several and "Approve selected"), or reject unknown registrations (an optional reason is kept for staff only). The staff home page shows the pending count, and staff get a "New student awaiting approval" notification.
- **Disable / enable:** Students → Active → Disable ends the student's sessions immediately and blocks sign-in; Disabled → Enable restores it.

## Password resets (no email is sent)

| Who forgot | Who resets | Where |
| --- | --- | --- |
| Student | any placement officer or the TPO head | Students → Active → Reset password |
| Placement officer | the TPO head | Staff → Reset password |
| TPO head | the super admin | Colleges → college → Staff → Reset password |

1. Confirm who is asking (in person, or a call to a known number). Never reset based on a message alone.
2. Click Reset password; a 16-character temporary password appears **once**. Copy it, give it to the person directly, then click "I have saved it".
3. Their old sessions end immediately; at the next sign-in they must choose a new password.

Every reset is in the audit log (`user.password_reset`, without the password).

## Demo environment

| Command | Effect |
| --- | --- |
| `npm run seed:demo -w server` | Small demo colleges `demo-alpha` and `demo-beta` (4 accounts each). Marks them `isDemo`. |
| `npm run seed:showcase -w server` | The "Demo Institute of Technology" (`demo-campus`): 3 staff, 24 students, 14 cases over six weeks, registry, advisories and lookups. Does nothing if it already exists. |
| `npm run seed:showcase -w server -- --reset` | Deletes **all** data of every `isDemo` college (cases, evidence files, notes, audit entries, notifications, users …) and rebuilds the showcase and the alpha/beta colleges. Real colleges are never touched. |

All demo accounts use `SEED_DEMO_PASSWORD` from `server/.env`; the scripts print emails, roles and the demo join codes, never passwords. The seeds refuse to run with `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`. Users of demo colleges see a "Demo environment — sample data" banner.

Reset the showcase before each external demo so the queue, stats and "days ago" timestamps look fresh.

## Evidence retention

Evidence files (screenshots, PDFs) of cases closed more than `RETENTION_MONTHS` months ago (default 12) should be deleted; the case record, decision and timeline are kept.

```powershell
npm run ops:retention -w server               # dry run: lists case numbers and file counts, deletes nothing
npm run ops:retention -w server -- --apply    # deletes those files
```

Run the dry run monthly, review the list, then apply. Each purged case gets a staff-only "Evidence deleted under the retention policy" timeline entry and an `evidence.purged` audit entry. There is no scheduler on the free plan; put a monthly reminder in the TPO office calendar.

## Backups (Atlas M0 has none)

The free Atlas tier has no automated backups. During a pilot, take a **weekly** backup and one before every deploy that changes data handling:

- **MongoDB Compass:** connect with the production string → for each collection, *Export Collection* → JSON. Include `evidence.files` and `evidence.chunks` if evidence must be restorable.
- **mongodump** (MongoDB Database Tools):

  ```powershell
  mongodump --uri "<production connection string>" --out "D:\offershield-backups\$(Get-Date -Format yyyy-MM-dd)"
  # restore into an empty database:
  mongorestore --uri "<connection string>" "D:\offershield-backups\2026-11-12"
  ```

Backups contain personal data and evidence: keep them on an encrypted drive owned by the college, keep at most the last 4–6, and delete them at the end of the pilot. Never commit them or share them by link.

## Incident: an advisory was published in error

1. **Withdraw it immediately** (TPO head: Advisories → the advisory → Withdraw advisory, with a reason). Students stop seeing it at once; those who were notified see "This advisory was withdrawn".
2. If the advisory was wrong because the **case decision was wrong**, reopen the source case (case page → Reopen case, with a reason). Fraud indicators published by that decision are revoked automatically when no other confirmed case supports them, so lookups stop showing them as fraud.
3. If a **recruiter was wrongly flagged**, check Registry → Indicators that the indicator is revoked (revoke it manually if another case still supports it and that case is also wrong).
4. Publish a corrected advisory if students need to know (published advisories are never edited; ADR-038).
5. Tell the affected company or students directly if harm is possible, and record what happened in the case's internal notes.

## Incident: suspected account or data exposure

- Compromised staff account: TPO head disables the officer (Staff → Disable) or the super admin resets the head's password; sessions end immediately.
- Leaked `JWT_SECRET` or a suspected session theft: rotate `JWT_SECRET` (DEPLOYMENT.md §7) — everyone is signed out.
- Leaked database password: change it in Atlas → Database Access, update `MONGODB_URI` on Render.
- Use the audit log (TPO head: Audit log) and the request id in the server logs to reconstruct what happened.
