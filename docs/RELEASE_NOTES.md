# OfferShield release notes

## v1.0.0 — 2026-11-13

First complete release of OfferShield, the Campus Recruitment Trust & Verification Desk: students check suspicious offers and ask their placement cell to verify them; staff investigate on a case desk; TPO-head decisions become a college registry that protects the next student.

### What each phase delivered

| Phase | Summary |
| --- | --- |
| 1 | Monorepo (client + server workspaces), Express API with health endpoint, validated configuration, security baseline (helmet, CORS, rate limit, error envelope), React shell, tests and docs. |
| 2 | MongoDB with Mongoose, session authentication (httpOnly JWT cookie with `tokenVersion` revocation), four roles, college tenancy through `tenantRepository`, staff management, append-only audit log, seed scripts. |
| 3 | Student verification requests, evidence upload to GridFS (magic-byte validation, EXIF stripping, short-lived download links), indicator extraction and normalisation, Aadhaar/PAN privacy guard. |
| 4 | TPO investigation desk: case state machine with atomic transitions, assignment, information requests, messages, internal notes, recommendations, TPO-head-only decisions with checks and basis, reopen with history, audit log viewer. |
| 5 | Fraud indicator registry from decisions, verified recruiter registry with approval and expiry, student lookup with five result types, look-alike domain detection, related-case linking (shared indicators + SimHash), staff warning signals. |
| 6 | Targeted advisories (year/branch) with acknowledgements, template-only in-app notifications, college statistics, landing page and UI polish. |
| 7 | Pilot readiness: manual student approval, staff-assisted password resets, fair per-user rate limits, privacy notice and terms with recorded consent, single production service with strict CSP and HSTS, showcase demo college, retention script, deployment and user guides. |
| 8 | Premium UI redesign: design system, role-specific shells, every page restyled, en-IN date and money formatting, lazy-loaded staff pages, screenshots. |
| 9 | Google sign-in (server-side OIDC with PKCE), Brevo email service with budget and logs, email verification for password sign-ups, self-service password reset, email notifications with preferences, Account page, academic-year promotion, case desk without horizontal scroll at laptop widths. |
| 9.1 | Email-verification gate limited to students; visible email failures (JSON log line with Brevo error codes and HTTP status); SMTP-key check at startup; `ops:email-test`; email troubleshooting guide; README v1.0 and these release notes. |

### Verified metrics (2026-11-13)

| Metric | Value | Source |
| --- | --- | --- |
| Server tests | 494 passed in 44 suites, 0 failed | `npm test` |
| Client tests | 105 passed in 20 files, 0 failed | `npm test` |
| Lint | ESLint and oxlint: no problems | `npm run lint` |
| Production dependency audit | 0 vulnerabilities | `npm audit --omit=dev` |
| Main JS bundle | 375.15 kB (111.02 kB gzip) | `npm run build` |
| CSP violations | 0 in 30 page checks (production build, 1440 and 390 px) | headless Chrome check, Phase 9.1 |
| Architecture decision records | 63 | [DECISIONS.md](DECISIONS.md) |

### Upgrading production to v1.0.0

1. **Push** the release and let Render deploy it with **no** email or Google variables set. The app behaves as before: no Google button, no email, staff-assisted resets only.
2. **Backfill** existing accounts from your machine against the production database: `npm run ops:backfill-email-verified -w server`. It prints counts and is safe to re-run.
3. **Google variables:** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_BASE_URL` (Google Cloud setup in [DEPLOYMENT.md §4a](DEPLOYMENT.md)), then redeploy.
4. **Brevo variables:** set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` (an `xkeysib-` API key, not the SMTP key) and `EMAIL_FROM` (a verified sender on an authenticated domain, [DEPLOYMENT.md §4b](DEPLOYMENT.md)), then redeploy. Email verification becomes required for new password sign-ups.
5. **Checks:**
   - `GET /api/v1/health/ready` → `ready`.
   - `GET /api/v1/policies` shows `googleEnabled: true` and `emailEnabled: true`.
   - `npm run ops:email-test -w server -- --to <your address>` prints `ok`.
   - Register a test student, receive the code, verify; try Forgot password; sign in with Google.
   - Render logs show no `"event":"email_send","status":"failed"` lines.

### Known limitations

- The free Render tier sleeps when idle; the first request after a pause takes about a minute.
- Rate-limit counters and the email-budget reservation are in memory (single instance).
- MongoDB Atlas M0 has no automated backups; take manual exports ([OPERATIONS.md](OPERATIONS.md)).
- Look-alike and related-case detection are heuristics that assist staff and never change a case on their own.
- Existing users are not asked to re-accept the updated privacy notice (ADR-062).
- Microsoft sign-in is not implemented (ADR-061).
