# Architecture Decision Records

## ADR-001: npm workspaces monorepo

- **Context:** Client and server are developed together by a small team and change in step.
- **Decision:** One repository with npm workspaces `client` and `server`; the root orchestrates scripts and holds only `concurrently`.
- **Consequence:** One `npm install`, one lockfile, shared scripts. Each package keeps its own dependencies, so either can be deployed separately later.

## ADR-002: CommonJS on the server

- **Context:** Jest's native ESM support still requires experimental Node flags.
- **Decision:** The server uses CommonJS (`require`, `"type": "commonjs"`). The client stays ESM (Vite).
- **Consequence:** Jest and Supertest run with no flags or transforms. Pure-ESM-only packages would need dynamic `import()`; none are used.

## ADR-003: Express 5

- **Context:** Express 5 is the current stable major version.
- **Decision:** Use Express 5.x.
- **Consequence:** Rejected promises in async handlers reach the error handler automatically; path syntax follows path-to-regexp v8 (e.g. no bare `*` wildcards). The 404 handler is a terminal middleware, so no wildcard route is needed.

## ADR-004: Tailwind CSS v4 via the Vite plugin

- **Context:** Tailwind v4 ships a first-party Vite plugin and no longer needs PostCSS or a config file for basic use.
- **Decision:** Use `tailwindcss` + `@tailwindcss/vite`, with `@import 'tailwindcss';` in `src/index.css`.
- **Consequence:** No `tailwind.config.js` or `postcss.config.js`. Theme customisation, when needed, goes in CSS (`@theme`).

## ADR-005: Vite dev proxy for same-origin API calls

- **Context:** Auth will use httpOnly cookies; cross-origin cookies in development need extra `SameSite=None`/HTTPS setup.
- **Decision:** The client calls relative `/api/v1` URLs; Vite proxies `/api` to `http://localhost:5000` in development.
- **Consequence:** The browser treats the API as same-origin. Production should also serve both from one origin; CORS stays as a strict allow-list for any other origin.

## ADR-006: JWT in httpOnly cookies (implemented in Phase 2)

- **Context:** Tokens in `localStorage` are readable by any injected script.
- **Decision:** Issue a signed JWT in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie. `JWT_SECRET` is already declared as an optional, validated (≥ 32 chars) config key.
- **Consequence:** Client JS never handles tokens; axios uses `withCredentials: true`. The cookie is `os_session`; CSRF exposure is limited by same-origin deployment (ADR-015), `SameSite=Lax` and JSON-only bodies (see SECURITY_DESIGN.md).

## ADR-007: No recruiter self-registration in the MVP

- **Context:** Letting recruiters create their own records would let bad actors present themselves as trusted.
- **Decision:** Recruiter records are created only by authorised college staff from reviewed cases or TPO entry.
- **Consequence:** No recruiter accounts or portal in the MVP (listed as deferred).

## ADR-008: Automated checks assist only

- **Context:** Automated judgements of "fraud" can be wrong and defamatory, and the college is accountable for its findings.
- **Decision:** Automated checks (registry matches, duplicates, format checks) only produce findings for staff. Only a `tpo_head` records a final decision, with reasons.
- **Consequence:** No AI or automated labelling decides outcomes; UI never presents an allegation as confirmed fraud.

## ADR-009: Client linting with oxlint

- **Context:** The current Vite React template (create-vite 9) ships oxlint, not ESLint, as its linter.
- **Decision:** Keep the template's oxlint (with its React rules-of-hooks rule) for the client; use ESLint 10 flat config for the server as specified.
- **Consequence:** Two linters, each a single dev dependency. The server ESLint config also forbids `process.env` outside `config/env.js`. The client could be moved to ESLint later if shared rules are needed.

## ADR-010: Extra dev dependencies `@eslint/js` and `globals`

- **Context:** ESLint 10 flat config does not bundle the recommended rule set or Node/Jest global definitions.
- **Decision:** Add `@eslint/js` and `globals` as server dev dependencies.
- **Consequence:** Two small, official dev-only packages; no runtime impact.

## ADR-011: mongodb-memory-server for server tests

- **Context:** Phase 2 tests need a real MongoDB (unique indexes, hooks, aggregation) but must never touch the Atlas cluster configured in `server/.env`.
- **Decision:** Each Jest test file starts a private in-memory `mongod` through `tests/helpers/db.js` (`useTestDatabase()`), clears collections after every test and stops it afterwards. `config/env.js` skips loading `server/.env` when `NODE_ENV=test`.
- **Consequence:** Tests are isolated and offline after the first run, which downloads a ~520 MB MongoDB binary into the user cache. mongodb driver 7.8 loads `os` with a dynamic `import()`, which fails inside Jest's CommonJS sandbox and produces an empty handshake; the helper therefore passes the driver's `runtimeAdapters: { os }` option. Production code is unaffected.

## ADR-012: Join code + email domain instead of OTP for student registration

- **Context:** Email OTP needs an email provider, templates and delivery handling, which does not fit the MVP schedule.
- **Decision:** A student registers only if the college code is active, the email's domain is one of the college's `emailDomains`, and the college's join code (stored hashed, rotatable by the super admin) matches.
- **Consequence:** A holder of the join code can register an address on the domain they do not own. Accepted for the pilot; documented in SECURITY_DESIGN.md as a known limitation. Email verification can be added later without changing the data model.

## ADR-013: Temporary staff passwords shown once

- **Context:** There is no email sending in the MVP, so new staff cannot receive invitation links.
- **Decision:** Creating a TPO head or placement officer returns a random 16-character temporary password exactly once; the account is flagged `mustChangePassword`, and `enforcePasswordChange` blocks everything except `me`, `change-password` and `logout` until it is changed.
- **Consequence:** The creator must pass the password on through a secure channel. Lost temporary passwords need a new account (or a future reset feature); they are never stored in plain text or logged.

## ADR-014: 404 (not 403) for cross-tenant record access

- **Context:** A 403 for "exists but belongs to another college" would let any college user probe for other colleges' record ids.
- **Decision:** Tenant-scoped lookups return null for other colleges' records, and services answer `404 NOT_FOUND` exactly as for a non-existent or malformed id. `403` is used only for role/route permission failures inside the caller's own tenant (e.g. a TPO head targeting another TPO head).
- **Consequence:** Clients cannot distinguish "forbidden elsewhere" from "missing"; isolation tests assert 404.

## ADR-015: Planned production deployment as one Render web service (Phase 7)

- **Context:** The session uses an httpOnly `SameSite=Lax` cookie. A separately hosted client would make API calls cross-site, requiring `SameSite=None`, CSRF tokens and stricter CORS.
- **Decision:** In Phase 7, deploy one Render web service: Express serves the built client (`client/dist`) and the API under `/api/v1` from the same origin. `trust proxy` and a shared rate-limit store are configured then.
- **Consequence:** Cookies stay same-origin in production as they are in development (Vite proxy). The API remains CORS-restricted for any other origin.

## ADR-016: Planned evidence storage in MongoDB GridFS (Phase 3)

- **Context:** Evidence files must be private, access-checked and tenant-scoped; adding an object store adds credentials and another service to secure.
- **Decision:** Store evidence bytes in MongoDB GridFS in the same database, with an `evidence` metadata document carrying `collegeId`, and stream downloads only through authorised API routes.
- **Consequence:** One datastore and one backup story; file size limits must stay modest (Atlas storage quotas). Can move to object storage later behind the same service interface.

## ADR-017: Native `bcrypt` package

- **Context:** The brief allowed falling back to `bcryptjs` if the native build failed on Windows.
- **Decision:** `bcrypt@6` installed with its prebuilt binary on Windows / Node 22 and is used at cost 12.
- **Consequence:** No fallback needed. If a future platform lacks a prebuild, `bcryptjs` is API-compatible for `hash`/`compare`.

## ADR-018: Two-step student submission (create, then upload)

- **Context:** A case is structured JSON validated by strict schemas; evidence is multipart. Combining them in one multipart request would weaken JSON validation and make a failed upload discard the whole request.
- **Decision:** `POST /cases` creates the case (JSON); the client then calls `POST /cases/:id/evidence`. If the upload fails, the case is kept and the detail page offers "Add more evidence" as a retry.
- **Consequence:** A case can briefly exist without evidence, which is valid (evidence is optional). Each step has its own error codes and limits; no transactions are needed.

## ADR-019: Own magic-byte check instead of `file-type`

- **Context:** Only three types are accepted (PNG, JPEG, PDF). `file-type` is ESM-only (the server is CommonJS, ADR-002) and recognises hundreds of formats we do not need.
- **Decision:** `utils/fileSignature.js` compares leading bytes against three fixed signatures and ignores the client's name and MIME type.
- **Consequence:** Zero dependencies and a tiny, fully tested surface. Adding a type means adding a signature and a test.

## ADR-020: Pure-JS image metadata stripping

- **Context:** Screenshots and photos can carry GPS location, device serials and names in EXIF/XMP/IPTC/text chunks. Image libraries such as `sharp` add native binaries and decode untrusted pixels.
- **Decision:** `utils/stripImageMetadata.js` walks the JPEG segment list / PNG chunk list and drops APP1, APP13, eXIf, tEXt, iTXt and zTXt without decoding pixels.
- **Consequence:** No native dependency, deterministic output, pixel data untouched. Malformed containers are rejected. Other metadata carriers (e.g. APP2–APP12 vendor segments, ICC profiles) are kept; acceptable for the MVP.

## ADR-021: PDFs are not sanitised; download as attachment only

- **Context:** Safe PDF sanitisation needs a full parser/rewriter, which is out of scope and itself a risk.
- **Decision:** PDFs are stored unchanged (`metadataStripped=false`) and always served with `Content-Disposition: attachment`, `nosniff` and `CSP: sandbox`, so the browser does not render them in the app's origin.
- **Consequence:** PDF metadata and any active content remain in the file; viewers open PDFs in their local reader. Documented as a known limitation.

## ADR-022: Evidence downloads need a short-lived link and the session

- **Context:** Evidence must open in a new tab (images inline, PDFs downloaded), which cannot carry custom headers, yet must stay private.
- **Decision:** An authorised API call issues a short-lived link token (default 5 minutes) bound to the evidence, case and user, signed with a key derived from `JWT_SECRET` for this purpose only. `GET /files/:token` requires that token **and** the same user's session cookie, and re-checks access.
- **Consequence:** Leaked links (history, logs, shared screenshots) are useless without the session and expire quickly; disabling a user or changing their password also stops downloads. Each download is audited.

## ADR-023: Free-mail domains are not domain indicators

- **Context:** `gmail.com` and similar providers appear in genuine and fraudulent messages alike; recording them as domains would create meaningless registry matches in Phase 5.
- **Decision:** `services/indicators/freeMailDomains.js` lists 15 public providers; their domains are not added as `domain` indicators. The full email address is still recorded as an `email` indicator.
- **Consequence:** Domain indicators point at recruiter-controlled domains only. The list is easy to extend.

## ADR-024: Final decisions are TPO-head only in the MVP; officers recommend

- **Context:** A recorded decision tells a student an offer is fraudulent or genuine and (Phase 5) feeds the college registry; mistakes have real consequences.
- **Decision:** Only `tpo_head` can record decisions (all four types) and reopen cases. Placement officers (and heads) can add a recommendation `{ type, basis }`, shown to all staff but never to students.
- **Consequence:** A clear single point of accountability; officers' work is visible to the head. A college with one TPO head has a bottleneck; delegation or two-person approval can be added later.

## ADR-025: Decisions store confirmed indicators and verified domains for Phase 5

- **Context:** The registry (Phase 5) must contain only findings an authorised person confirmed, traceable to a decision.
- **Decision:** `decision.confirmedIndicators` (confirmed_fraud) and `decision.verifiedDomains` (verified_genuine) must exactly match indicators already on the case. The decision endpoint does **not** write registry entries; Phase 5 reads these fields.
- **Consequence:** No free-text indicators can enter the registry, and Phase 4 stays registry-free. Phase 5 must handle backfilling from existing decisions and revocation on reopen.

## ADR-026: Decisions allowed from any open status

- **Context:** Some cases are obvious (e.g. an exact repeat of a confirmed scam) and do not need assignment or review first.
- **Decision:** The decision trigger accepts `submitted`, `under_review` and `awaiting_student`.
- **Consequence:** Faster handling of clear cases; the audit log and timeline still record who decided and when. Policy can tighten this later in the state machine table alone.

## ADR-027: Atomic conditional updates for concurrency

- **Context:** Two staff members can act on the same case at the same time (e.g. two decisions, or a decision while the student replies).
- **Decision:** Every status change is a single `findOneAndUpdate` whose filter includes `status: { $in: allowedFrom }` (and, for reopen, the current `decision.decidedAt`). No match → 409 (or 404 if the case is not in the tenant). Events and audit entries are written only after the update succeeds.
- **Consequence:** No lost updates or double decisions without needing transactions; the UI shows "This case was updated by someone else — refresh". Events/audit are not in the same atomic unit as the update, so a crash in between could leave a status change without its event (acceptable for the MVP).

## ADR-028: Reopen keeps decision history

- **Context:** New evidence can arrive after a decision; the original decision and its basis must remain reviewable.
- **Decision:** Reopen (TPO head, with a staff-only reason) pushes the current decision into `decisionHistory` with `reopenedBy/At/Reason`, sets `decision=null` and returns the case to `under_review`. The student sees only a generic "reopened" message.
- **Consequence:** Full history is kept on the case and in the audit log. Phase 5 must revoke registry entries derived from a reopened decision.

## ADR-029: tldts for registrable domains

- **Context:** `careers.infosys.com` and `infosys.com` must be treated as one organisation, `abc.co.in` must not collapse to `co.in`, and `someone.github.io` must not collapse to `github.io`.
- **Decision:** Use `tldts` (Public Suffix List, offline) with private suffixes enabled for registrable-domain and brand-label extraction. It is the only new dependency in Phase 5.
- **Consequence:** Correct handling of multi-part and private suffixes with no network calls. The bundled list ages with the package version and is refreshed by upgrading.

## ADR-030: Homoglyph skeleton and look-alike thresholds

- **Context:** Scammers imitate verified domains with digit/Cyrillic/Greek homoglyphs, typos and brand-plus-word domains.
- **Decision:** `isLookalike(candidate, verified)` (in `services/registry/similarity.js`, thresholds in `SIMILARITY_THRESHOLDS`) is true when the registrable domains differ and: the brand-label skeletons are equal (homoglyphs → Latin, 0→o, 1→l, 3→e, 5→s, rn→m, vv→w, hyphens removed); or Levenshtein ≤ 2 for brands of ≥ 5 characters; or the brand appears as a hyphen/word-separated token (brand ≥ 3) or an unseparated substring (brand ≥ 5). The same domain or a subdomain is a match, not a look-alike.
- **Consequence:** `tcss.in` is not flagged for `tcs.com` (too short for edit distance) but `tc5.com` (skeleton) and `tcs-careers.in` (token) are. Legitimate sister domains (`infosys.co.in`) are flagged until added to the recruiter's domains — an intentional, safe default.

## ADR-031: SimHash parameters for related-text linking

- **Context:** Template scams reuse the same text with different names, amounts and contacts.
- **Decision:** 64-bit SimHash over word 3-shingles hashed with FNV-1a 64 (BigInt). Before hashing: lowercase; URLs, emails, UPI IDs and phones become placeholders; any digit run becomes one `#`; the word after a salutation ("Dear Rahul") becomes a placeholder. Link when Hamming distance ≤ `SIMHASH_MAX_DISTANCE` (default 6), messages ≥ 8 words, cases created in the last 180 days, newest 1000 candidates.
- **Consequence:** Measured: identical 0; same template with name, amount and contacts changed 0; one word reworded 5; unrelated messages 25–30. Short or heavily rewritten messages are not linked by text (they can still link by shared indicators or manually).

## ADR-032: No RDAP, DNS or WHOIS lookups in the MVP

- **Context:** Domain age or DNS data would help, but fetching anything derived from user input risks SSRF, leaks investigations to third parties and adds flaky dependencies.
- **Decision:** No network calls on user-supplied values anywhere in Phase 5; all checks are offline string analysis.
- **Consequence:** Newly registered look-alikes are only caught by the similarity heuristics and staff judgement. Revisit with an isolated, allow-listed worker if needed.

## ADR-033: Recruiter free-mail contacts rejected

- **Context:** A recruiter that "verifies" a gmail address would let any gmail user look verified.
- **Decision:** Recruiter domains and contact emails can never be free-mail providers (400 `FREE_MAIL_NOT_ALLOWED`); contact emails must be on the recruiter's own domains (400 `CONTACT_DOMAIN_MISMATCH`); lookups of free-mail addresses never match a recruiter by domain.
- **Consequence:** Recruiters who genuinely use gmail cannot be registered; students are told to treat such contacts as not reviewed.

## ADR-034: Officer-created recruiters need head approval

- **Context:** A verified recruiter is shown to every student as trustworthy; mistakes are costly.
- **Decision:** Officers can propose recruiters (`pending_approval`, invisible to lookup) and edit their own pending ones; only the TPO head creates verified records, approves, renews, suspends, or edits verified ones.
- **Consequence:** Same accountability model as decisions (ADR-024).

## ADR-035: Lookup result precedence

- **Context:** A value can match several things (e.g. a fraud domain that is also a look-alike).
- **Decision:** `confirmed_fraud` > `lookalike_warning` > `verified` > `verified_expired` > `not_reviewed`; look-alikes are only computed when no verified recruiter matches.
- **Consequence:** The most protective message always wins. A verified recruiter never shows as verified when the value is also a confirmed fraud indicator (and the conflict rules make that state unlikely).

## ADR-036: Optional `details` in the error envelope

- **Context:** The decision form must link to the verified recruiter that blocks a fraud confirmation.
- **Decision:** `AppError` may carry a safe `details` object, returned as `error.details`; currently only for `CONFLICTS_WITH_VERIFIED_RECRUITER`.
- **Consequence:** Backwards-compatible (`code` and `message` unchanged); details must never contain secrets or another college's data.

## ADR-037: Polling instead of WebSockets for notifications

- **Context:** Notifications are low-volume and not time-critical; the deployment is one small Render service (ADR-015).
- **Decision:** In-app notifications only; the client polls `GET /notifications/unread-count` every 30 s, pauses while the tab is hidden and refetches on focus. No WebSockets, Socket.io, push or email in the MVP.
- **Consequence:** Up to 30 s delay; trivial server load at campus scale; no long-lived connections or extra auth surface. Email or push can be added later behind the same `notify` service.

## ADR-038: Published advisories are immutable

- **Context:** Students may act on an advisory; silently editing it would make it impossible to know what they were told.
- **Decision:** Only drafts can be edited. A published advisory can only be withdrawn (with a staff-only reason); corrections are published as a new advisory. Notified students opening a withdrawn advisory see "This advisory was withdrawn".
- **Consequence:** A clear, auditable history; corrections create a second notification.

## ADR-039: Only the TPO head publishes advisories

- **Context:** An advisory reaches many students at once and names confirmed indicators.
- **Decision:** Officers and heads draft; only the head publishes and withdraws (same accountability model as decisions, ADR-024). Publishing re-checks that every linked indicator is still active.
- **Consequence:** A single reviewer per college; drafts may wait for the head.

## ADR-040: Tenant aggregation stage restrictions

- **Context:** Aggregation pipelines can read other collections (`$lookup`, `$graphLookup`, `$unionWith`), write them (`$out`, `$merge`) or hide sub-pipelines (`$facet`), any of which could cross tenants.
- **Decision:** `tenantRepository.aggregate` prepends `{ $match: { collegeId } }` and throws on those stages (and on stages with several operators). Cross-collection data is loaded by a second scoped query.
- **Consequence:** Statistics need a few extra queries, but every aggregate is provably single-tenant.

## ADR-041: 180-day notification TTL

- **Context:** Notifications are transient pointers to cases and advisories, which keep the durable record (events, audit log).
- **Decision:** A MongoDB TTL index deletes notifications 180 days after creation.
- **Consequence:** The inbox stays small; nothing of record is lost. Older items simply disappear from the bell.
