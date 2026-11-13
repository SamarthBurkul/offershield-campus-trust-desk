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

## Password resets (staff-assisted)

| Who forgot | Who resets | Where |
| --- | --- | --- |
| Student | any placement officer or the TPO head | Students → Active → Reset password |
| Placement officer | the TPO head | Staff → Reset password |
| TPO head | the super admin | Colleges → college → Staff → Reset password |

1. Confirm who is asking (in person, or a call to a known number). Never reset based on a message alone.
2. Click Reset password; a 16-character temporary password appears **once**. Copy it, give it to the person directly, then click "I have saved it".
3. Their old sessions end immediately; at the next sign-in they must choose a new password.

Every reset is in the audit log (`user.password_reset`, without the password).

With email configured (Brevo), students and staff can also use **Forgot password?** on the sign-in page: a one-time link valid for 30 minutes (`auth.password_reset_self` in the audit log). Accounts that sign in only with Google get a reminder to use Continue with Google instead; a staff-assisted reset gives them a password as well.

## Email (Phase 9)

- **What is sent:** verification codes, reset links, "password changed" notices (critical, always sent); case updates to students, warning/critical advisories, and staff alerts for new requests and pending students (normal, can be switched off on the Account page).
- **Daily budget:** normal mail stops at `EMAIL_DAILY_BUDGET` (default 250) emails per UTC day, critical mail at 290 (Brevo free plan: 300/day). The advisory page shows "Emailed X of Y"; a smaller X means opt-outs, unverified students or the budget.
- **Checking delivery:** the `emaillogs` collection has one row per attempt (`type`, `priority`, `status` = sent / skipped_budget / skipped_pref / failed, `errorCode`), kept 90 days, with no content. Many `failed` rows with `BREVO_401` mean the API key is wrong; `BREVO_400` usually means the sender address is not verified in Brevo.
- **Email verification:** with Brevo, password sign-ups must enter a 6-digit code before anything else; staff cannot approve an unverified student. A student who never got the code can press Resend (after 60 s, 5 per hour); otherwise check the spam folder and the address on the Students page.

## Troubleshooting email

Start with `npm run ops:email-test -w server -- --to you@example.com` (with the production variables in `server/.env`, or in the Render shell). It prints only `ok messageId=…` or `errorCode=… providerStatus=…`. On Render, every failed or budget-skipped send also writes one JSON line: `{"event":"email_send","type":…,"status":"failed","errorCode":…,"providerStatus":…}`.

| Symptom / errorCode | Cause | Fix |
| --- | --- | --- |
| No "Forgot password?" form; `GET /api/v1/policies` shows `"emailEnabled": false` | The email variables were not loaded (unset on Render, or the service was not redeployed) | Set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` and redeploy |
| Startup fails: "BREVO_API_KEY is an SMTP key" | The SMTP key (`xsmtpsib-…`) was copied instead of an API key | Brevo → SMTP & API → **API keys** → generate a key starting `xkeysib-` |
| `BREVO_UNAUTHORIZED` (401) | Wrong, revoked or mistyped API key | Generate a new API key and update `BREVO_API_KEY` |
| `BREVO_PERMISSION_DENIED` (403) — works locally, fails on Render | Brevo **Security → Authorised IPs** is on; Render's outgoing IPs change | Turn the Authorised IPs restriction **off** for this key |
| `BREVO_PERMISSION_DENIED` / `BREVO_ACCOUNT_UNDER_VALIDATION` on a new account | The Brevo account is not activated for transactional email yet | Finish Brevo's account activation (profile, phone, activation request) and wait for approval |
| `BREVO_INVALID_PARAMETER` / `BREVO_400` | `EMAIL_FROM` is not a verified sender (or its domain is not authenticated) | Brevo → Senders, domains → verify the sender or authenticate the domain |
| Status `sent` but nothing arrives | Spam folder; a `@gmail.com` sender is rewritten to `…@brevosend.com` and often lands in spam | Check spam; use a sender on your own authenticated domain (SPF/DKIM/DMARC, DEPLOYMENT §4b) |
| `skipped_budget` lines | The daily budget (`EMAIL_DAILY_BUDGET`, critical cap 290) is used up | Wait until 00:00 UTC, or raise the budget within your Brevo plan |
| Existing students suddenly asked to verify, or staff cannot approve old accounts | Accounts created before Phase 9 have no `emailVerifiedAt` | Run `npm run ops:backfill-email-verified -w server` against that database |

Staff and super-admin accounts are never asked to verify their email; only students are.

## Testing tips

Gmail ignores everything after `+` in the local part: `name+student1@gmail.com` and `name+student2@gmail.com` both deliver to `name@gmail.com`. One mailbox can therefore receive the codes and reset links for many test accounts, while OfferShield treats each alias as a separate account (use a `manual_approval` college, since Gmail addresses do not match a college domain).

## Google sign-in (Phase 9)

- Shown on the sign-in and registration pages when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- An existing account with the same email is linked automatically on first Google sign-in (`auth.google_linked` in the audit log). New students finish registration with the college code and join code; in email-domain colleges the Google address (or the Google Workspace domain) must match the college domains.
- Disabled or rejected accounts see "This account cannot sign in".

## Academic-year upkeep (each June)

After results, the TPO head opens **Students → Promote year**, starts with **year 4** (→ 5), then 3, 2 and 1, so nobody moves twice. The dialog shows how many active students will move; the action is audited (`student.promote_year` with the count). Students can also correct their own year and branch on the Account page (`user.profile_update`, field names only).

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
