# Security checklist

One row per rule in [SECURITY_DESIGN.md](SECURITY_DESIGN.md), with the automated test that proves it. Server tests are in `server/tests/`, client tests in `client/src/__tests__/`. "manual" means no automated test covers it; how it was checked is noted.

## Baseline (Phase 1)

| Rule | Proof |
| --- | --- |
| Security headers, no `x-powered-by` | `app.security.test.js` — "sets helmet headers and hides x-powered-by" |
| Strict production CSP and HSTS | `production.test.js` — "sends the strict CSP and a 180-day HSTS header"; "does not serve the client or send HSTS outside production" |
| CORS allow-list with credentials | `app.security.test.js` — "allows the configured client origin with credentials"; "gives a disallowed origin no allow-origin header and does not error"; "does not grant a disallowed origin on preflight" |
| 100 kb body limit, safe parser errors | `app.security.test.js` — "returns 400 INVALID_JSON for a malformed JSON body without a stack trace"; "returns 413 PAYLOAD_TOO_LARGE for a body over 100kb" |
| No stack traces in production | `app.security.test.js` — "returns 500 INTERNAL_ERROR without a stack trace" |
| Env validation names keys, never values | `env.test.js` — "never includes the database URI in error messages"; "never includes secret values in the error message" |
| Only `config/env.js` reads `process.env` | manual — ESLint `no-restricted-properties` rule (`npm run lint` exit 0) |
| `.env` never committed; examples hold placeholders | manual — `.gitignore`, review of `server/.env.example`; secret-value scan of the repository at the end of each phase |

## Sessions, roles and tenancy (Phase 2)

| Rule | Proof |
| --- | --- |
| HttpOnly, SameSite=Lax session cookie, no token in bodies | `auth.test.js` — "1. registers a student with an HttpOnly SameSite=Lax os_session cookie and no password hash" |
| Secure cookie in production | `env.test.js` — "derives cookieSecure from production and parses JWT_EXPIRES_IN"; `production.test.js` — "COOKIE_SECURE_OVERRIDE only relaxes Secure cookies for a plain-http base URL" |
| Tampered / foreign-secret tokens rejected | `auth.test.js` — "6b. returns 401 for a tampered token"; "returns 401 for a token signed with another secret" |
| `tokenVersion` revokes sessions on password change | `auth.test.js` — "8. rejects the old cookie afterwards, accepts the new cookie and writes an audit entry" |
| Identical 401 for unknown email, wrong password, disabled, suspended | `auth.test.js` — "5b. returns an identical 401 body for a wrong password and an unknown email"; "5c. returns the same 401 for a disabled user with the correct password"; "5d. returns the same 401 when the college is suspended" |
| Password policy | `auth.test.js` — "weak password -> 400 VALIDATION_ERROR" |
| Temporary password allow-list | `auth.test.js` — "9. a mustChangePassword user gets 403 PASSWORD_CHANGE_REQUIRED elsewhere but can use /auth/me and change the password" |
| Join code shown once, stored hashed, rotation invalidates | `admin.test.js` — "20. create returns the join code once; GET responses never include it or its hash"; "21. rotating the join code makes the old code fail and the new code succeed" |
| `collegeId` only from the session; strict bodies | `tenantIsolation.test.js` — "17b. collegeId in the body is rejected, so a user cannot be created in another college" |
| Tenant repository scoping | `tenantRepository.test.js` — "find never returns another college even when the filter asks for it"; "refuses updates that would move a document to another college"; "create always stamps the tenant collegeId" |
| 404 for other colleges' records | `tenantIsolation.test.js` — "16. head A changing B's officer status gets 404 and B's officer is unchanged" |
| Role checks (RBAC) | `rbac.test.js` — "11." to "14." and "unauthenticated requests to protected routes get 401 before any role check" |
| Audit log append-only, no secrets | `admin.test.js` — "23. records college and staff actions with the right collegeId and no secrets"; "24. AuditLog update and delete attempts throw" |
| Seeds never print passwords; refuse production | `showcaseSeed.test.js` — "refuses to run in production unless ALLOW_DEMO_SEED=true"; printing: manual (script output reviewed, only emails/roles/demo join codes) |

## Evidence and privacy (Phase 3)

| Rule | Proof |
| --- | --- |
| File type by content only | `evidence.test.js` — "28a. rejects a text file named .png with 400 UNSUPPORTED_FILE_TYPE and stores nothing"; `fileUtils.test.js` — "rejects a text file renamed .png and other types" |
| Size and count limits | `evidence.test.js` — "28b. rejects a file over 3 MB with 413 FILE_TOO_LARGE"; "28c. rejects more than 5 files per request and more than 10 per case with 400 TOO_MANY_FILES" |
| Image metadata stripped | `fileUtils.test.js` — "25. removes APP1 (EXIF) and APP13 from a JPEG and keeps SOI/EOI"; "26. removes PNG tEXt and eXIf chunks and leaves valid chunks" |
| GridFS files carry tenant metadata | `evidence.test.js` — "27. stores PNG, JPEG and PDF with hashes, tenant GridFS metadata and an evidence_added event" |
| Short link + session for downloads | `evidence.test.js` — "31a. an expired link returns 401 LINK_INVALID"; "31b. tampered token, missing session and a different user all get 401; evidence of another case gets 404" |
| Download headers (`nosniff`, `no-store`, `sandbox`) | `evidence.test.js` — "30. the owner downloads identical bytes with safe headers; the JPEG has no APP1" |
| Evidence access by role and college | `evidence.test.js` — "29. non-owner (same college) and other-college students get 404; a closed case gets 409"; "32. same-college staff can open evidence; other-college staff get 404; super admin gets 403" |
| Uploads and accesses audited without contents | `evidence.test.js` — "33. audits uploads and accesses without file contents or tokens" |
| Aadhaar / PAN privacy guard, value never logged | `privacy.test.js` — "16. rejects a PAN in studentNote, in contacts and in a reply"; "does not log the matched value" |
| No URL fetching (SSRF) | `cases.test.js` — "6. never fetches or resolves submitted links during creation and reply" |
| Student serializer allow-list | `cases.test.js` — "10. the student view excludes staff-only fields and hidden events" |
| Per-user case creation limit | `cases.test.js` — "13. returns 429 after the per-user creation limit" |

## Staff desk (Phase 4)

| Rule | Proof |
| --- | --- |
| Notes are staff-only and append-only | `staffCases.test.js` — "11. notes are staff-only, unaudited in content and append-only" |
| Recommendation basis never reaches students | `staffCases.test.js` — "12. officers can recommend; the student never sees the recommendation basis" |
| Students see only `{ type, decidedAt, message }` of a decision | `decisions.test.js` — "17. the student sees only { type, decidedAt, message }" |
| Only the TPO head decides and reopens | `decisions.test.js` — "13. officers get 403 on decision and reopen" |
| Atomic transitions (no double decision) | `decisions.test.js` — "18. two concurrent decisions: exactly one succeeds"; `caseStateMachine.test.js` — "2b. the status endpoint can never produce a final status, and unknown triggers throw" |
| Desk isolation (404 across colleges) | `staffIsolation.test.js` — "21. college A head: … on a college B case -> 404"; "22. students and the super admin get 403 on every /staff route" |
| Audit actions without free text | `decisions.test.js` — "14c. records the decision, a visible decision event and an audit entry without the basis"; `auditQuery.test.js` — "24. records every case action with the right college, actor and entity" |
| Audit viewer is head-only and scoped | `auditQuery.test.js` — "25. GET /staff/audit: head only, college-scoped, filterable, newest first" |

## Registry, lookup and signals (Phase 5)

| Rule | Proof |
| --- | --- |
| Indicators only from decisions; no create route | `indicatorLifecycle.test.js` — "9. a confirmed_fraud decision publishes indicators; a second case adds a source without duplicating"; "14. there is no route that creates a fraud indicator" |
| Reopen revokes the finding | `indicatorLifecycle.test.js` — "10. reopening removes the source; the last source reopened revokes the indicator" |
| Conflict rules (verified recruiter vs fraud indicator) | `indicatorLifecycle.test.js` — "12. confirming a verified recruiter domain is blocked before any change"; `registry.test.js` — "16. rejects free-mail contacts, contacts on unlisted domains and confirmed fraud domains" |
| Officer recruiters need head approval | `registry.test.js` — "15. officer-created recruiters are pending until the head approves" |
| Lookup minimisation (no query text stored, per-user limit) | `lookup.test.js` — "27. stores a LookupEvent without the query text and rate-limits per user"; "19. a confirmed UPI returns confirmed_fraud without source cases or case data (students)" |
| Guidance never says "safe" | `lookup.test.js` — "25. unknown queries are not_reviewed; guidance never says "safe" …" |
| No network calls for look-alikes and signals | `cases.test.js` — "6. never fetches or resolves submitted links during creation and reply" (covers extraction, linking and signals) |
| Staff-only derived data | `signals.test.js` — "are stored on the case but never appear in the student view" |
| Linking never crosses colleges or joins on free-mail | `linking.test.js` — "31. a shared free-mail domain or a verified recruiter domain does not link cases"; `registryIsolation.test.js` — "35. cross-college ids on every registry and link route return 404" |

## Advisories, notifications, stats (Phase 6)

| Rule | Proof |
| --- | --- |
| Only active indicators; revoked ones hidden | `advisories.test.js` — "9. a revoked indicator is hidden from students, flags needsReview and blocks publishing" |
| No student identity, privacy guard | `advisories.test.js` — "4. validates branches, indicators, source case, student identity and sensitive IDs"; "11. student JSON never contains sourceCaseId, authors or their ids" |
| Head-only publishing; published is immutable | `advisories.test.js` — "3. officers draft; only the head publishes; only the author or head edits"; "6. published advisories are immutable" |
| Targeting | `advisories.test.js` — "7. students see only targeted, published, non-expired advisories" |
| Notification template allow-list | `notifications.test.js` — "the student's notifications contain only template text and the truncated student message" |
| Inbox scoped to user and college | `notifications.test.js` — "14. unread count, read, read-all, and other users or colleges get 404" |
| Notification failures never break the action | `notifications.test.js` — "16. a failing notification never fails the main action" |
| Aggregation tenant guard | `tenantAggregate.test.js` — "1. prepends the collegeId match so other colleges are never counted"; "2. refuses a pipeline containing %s" |
| Stats scoped and staff-only | `stats.test.js` — "17. computes every college A statistic exactly and ignores college B"; "18. students and the super admin get 403; officers 200" |
| Polling instead of sockets | manual — no WebSocket/socket.io dependency (`npm ls`), grep of `src` |

## Pilot readiness (Phase 7)

| Rule | Proof |
| --- | --- |
| Signed-in traffic limited per user, not per IP | `rateLimitFairness.test.js` — "an authenticated user has an own /api budget, independent of other users on the same IP" |
| Whole campus behind one IP can sign in | `rateLimitFairness.test.js` — "30 different students behind one IP can all sign in" |
| Login limited per IP + email | `rateLimitFairness.test.js` — "the same email gets 429 on its 11th attempt while other students still sign in"; `auth.test.js` — "10. returns 429 RATE_LIMITED after the configured maximum" |
| Forged cookie cannot borrow a user budget | `rateLimitFairness.test.js` — "a forged or expired session cookie is limited by IP, not by the claimed user" |
| `TRUST_PROXY` controls the client IP | `rateLimitFairness.test.js` — "with TRUST_PROXY=1 the X-Forwarded-For address is the client IP"; "with TRUST_PROXY=0 a client cannot dodge the limit by sending X-Forwarded-For"; `production.test.js` — "defaults TRUST_PROXY to 1 in production and 0 elsewhere" |
| Registration limited per IP | `rateLimitFairness.test.js` — "registration has its own per-IP limit" |
| Manual approval: pending students reach nothing but the three auth routes | `studentApproval.test.js` — "can sign in and read /auth/me but get 403 ACCOUNT_PENDING_APPROVAL everywhere else" |
| Approve/reject/bulk are scoped and audited; rejected cannot sign in | `studentApproval.test.js` — "approve gives full access; reject ends the session and login returns 401"; "bulk approve approves pending students of the own college only"; "college B officer gets 404 for college A students; students cannot use the staff API" |
| `email_domain` mode unchanged | `studentApproval.test.js` — "email_domain mode still rejects a wrong domain" |
| `student_pending` notification carries no identity | `studentApproval.test.js` — "notifies all active staff with a template that contains no email or name" |
| `isDemo` cannot be set by any API | `studentApproval.test.js` — "the super admin sets studentVerification, but isDemo is rejected by the strict schemas" |
| Password reset: who may reset whom | `passwordReset.test.js` — "a TPO head resets an officer and a student; the temporary password is returned once"; "an officer resets a student but gets 403 for another officer or the head"; "a head cannot reset another TPO head or themselves"; "the super admin resets a TPO head, and only TPO heads" |
| Reset revokes sessions and forces a change | `passwordReset.test.js` — "revokes the old session; the temporary password works once and forces a change" |
| Temporary password never audited | `passwordReset.test.js` — "audits the reset without the password" |
| Reset is college-scoped | `passwordReset.test.js` — "a college B target is 404" |
| Disable revokes sessions | `passwordReset.test.js` — "disabling revokes the session and blocks login; enabling restores access" |
| Consent required and recorded | `studentApproval.test.js` — "rejects registration without acceptPolicies and stores the accepted version on success"; client `legal.test.jsx` — "17. requires the policies checkbox and links to /privacy and /terms" |
| Privacy notice accurate to the system | client `legal.test.jsx` — "18a. the privacy page renders the real retention period, support contact and version"; content: manual review against this document |
| Client served from Express with safe caching | `production.test.js` — "serves index.html for client routes that accept HTML (SPA fallback), never cached"; "caches hashed assets for a year and compresses them for gzip clients"; "a missing asset is a plain 404, not index.html" |
| Unknown API routes stay JSON 404 | `production.test.js` — "unknown /api routes still return the JSON 404, even for browsers" |
| Startup refuses unsafe production config | `production.test.js` — "refuses a missing MONGODB_URI, naming only the key"; "refuses the .env.example placeholder JWT_SECRET without echoing it"; "refuses a short JWT_SECRET and a missing CLIENT_ORIGINS" |
| Request log without query strings, bodies or cookies | `production.test.js` — "logs one JSON line per request without the query string, and returns X-Request-Id"; "adds the user id for signed-in requests and never logs bodies or cookies" |
| Request id is safe to log | `production.test.js` — "keeps a safe incoming X-Request-Id and replaces an unsafe one" |
| Readiness reflects the database | `production.test.js` — "is 200 while the database is connected and 503 when it is not" |
| Graceful shutdown | manual — `server.js` SIGTERM/SIGINT handler (code review). Not exercised in Phase 7: signals cannot be delivered to a background Node process on this Windows machine. Verify on Render: a redeploy logs `[server] SIGTERM received, closing HTTP server` |
| Demo reset touches only `isDemo` colleges | `showcaseSeed.test.js` — "--reset removes and recreates only isDemo colleges; a real college and its data are untouched" |
| Demo data is fictional and consistent | `showcaseSeed.test.js` — "creates a realistic, internally consistent demo college, and is idempotent" |
| Retention deletes only old closed evidence; staff-only event | `retention.test.js` — "--apply deletes evidence of old closed cases only, keeps the cases, and records events and audit entries"; "the purge event is staff-only: the student timeline does not show it"; "dry run lists old closed cases and deletes nothing" |
| Demo banner only for demo colleges | client `legal.test.jsx` — "21. the demo banner shows only when college.isDemo is true" |
| No `console.*` of bodies, queries, tokens or passwords | manual — grep of `server/src` and `server/scripts` in Phase 7 (one finding fixed: the error handler logged `req.originalUrl` with query strings) |
| Production dependencies free of high/critical advisories | manual — `npm audit --omit=dev` (0 vulnerabilities, Phase 7) |

## Mandatory rules for later phases

| Rule | Proof |
| --- | --- |
| 1. `collegeId` from the session only | `tenantIsolation.test.js` — "17b. collegeId in the body is rejected, so a user cannot be created in another college"; `cases.test.js` — "1. creates a case with a college-scoped number, session-derived ids, status submitted and a created event" |
| 2. College-owned queries through `tenantRepository` | `tenantRepository.test.js`; `tenantAggregate.test.js`; review: manual |
| 3. Students see only their own cases | `cases.test.js` — "9. another student of the same college and a student of another college get 404" |
| 4. Staff see only their college; super admin no case content | `staffIsolation.test.js` — "22. students and the super admin get 403 on every /staff route"; `evidence.test.js` — "32. …super admin gets 403" |
| 5. Notes never on student endpoints | `staffCases.test.js` — "11. notes are staff-only, unaudited in content and append-only" |
| 6. Only `tpo_head` decides, with a reason | `decisions.test.js` — "13. officers get 403 on decision and reopen" |
| 7. Indicators only from authorised decisions | `indicatorLifecycle.test.js` — "14. there is no route that creates a fraud indicator" |
| 8. Important admin actions audited | `admin.test.js` — "23."; `auditQuery.test.js` — "24."; `studentApproval.test.js`, `passwordReset.test.js` (Phase 7 actions) |
| 9. Private, validated evidence | `evidence.test.js` — "27." to "33." |
| 10. Never fetch submitted URLs | `cases.test.js` — "6." |
| 11. No Aadhaar/PAN collection | `privacy.test.js` |
| 12. Allegations never shown as confirmed | `lookup.test.js` — "28. revoked indicators are not returned"; `indicatorLifecycle.test.js` — "13. open cases gain and lose MATCHES_CONFIRMED_INDICATOR as indicators are published and revoked" |
| 13. Automated checks assist only | `signals.test.js` (signals never change status — see "the neutral case has no signals" and severity ordering tests); manual review |
| 14. Cross-college isolation tests per feature | `tenantIsolation`, `staffIsolation`, `registryIsolation`, `notifications` "14.", `stats` "17.", `studentApproval` "college B officer gets 404 …", `passwordReset` "a college B target is 404" |
