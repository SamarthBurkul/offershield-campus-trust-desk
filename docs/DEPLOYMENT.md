# Deployment (Render + MongoDB Atlas)

OfferShield runs as **one Render web service**: the Express API serves both `/api/v1` and the built React client from the same origin (ADR-015, ADR-045). The database is MongoDB Atlas (the free M0 cluster is enough for a pilot).

## 1. Prepare MongoDB Atlas

1. Create a cluster (M0 free for a demo; see "Plans" below for a pilot).
2. **Database Access** → add a database user with a long random password (24+ characters, letters and digits; avoid `@ : / ?` or URL-encode them). Give it read/write on the OfferShield database only.
3. **Network Access** → add `0.0.0.0/0` (allow from anywhere).
   - Why: Render's outbound IP addresses are shared and can change on every deploy or restart, and the free and Starter plans have no static outbound IP. An IP allow-list would break the service without warning.
   - What protects the database instead: the strong database-user password, TLS (always on for Atlas), and a user limited to one database. Never reuse that password anywhere else.
4. Copy the connection string (`mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority`). Keep it out of chat, tickets and screenshots.

## 2. Create the Render web service

| Setting | Value |
| --- | --- |
| Repository / branch | this repository, `main` |
| Runtime | Node |
| Node version | 22 (read from `.node-version`) |
| Root directory | repository root (leave empty) |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/v1/health/ready` (503 until MongoDB is connected) |
| Instance type | Free for a demo, Starter for a pilot |

`npm start` runs `node src/server.js --production` in the `server` workspace: production mode is set by that flag, so **do not set `NODE_ENV` on Render**. If `NODE_ENV=production` is present during the build, `npm ci` skips devDependencies (Vite is one) and `npm run build` fails. If you must set it, change the build command to `npm ci --include=dev && npm run build`.

## 3. Environment variables

Set these under **Environment** on Render. Values are never printed by the server; startup fails with the key name (never the value) if something required is missing or invalid.

### Required

| Variable | Meaning |
| --- | --- |
| `MONGODB_URI` | Atlas connection string (above). |
| `JWT_SECRET` | Session signing secret, at least 32 random characters, not the `.env.example` placeholder. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `CLIENT_ORIGINS` | The public origin(s), comma-separated, no trailing slash, e.g. `https://offershield.onrender.com`. Required in production. |

### Recommended

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_BASE_URL` | — | The public URL, e.g. `https://offershield.onrender.com`. |
| `SUPPORT_EMAIL` | — | Shown on the privacy notice for deletion and correction requests. |
| `RETENTION_MONTHS` | `12` | Evidence of closed cases older than this is deleted by `ops:retention`; shown on the privacy notice. |
| `TRUST_PROXY` | `1` in production | Proxy hops to trust for the client IP. Render has one; keep `1`. |

### Optional tuning

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `5000` | Render sets this automatically; do not override. |
| `JWT_EXPIRES_IN` | `8h` | Session length (`30m`, `8h`, `7d`). |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` | Window for the `/api` limits (15 min). |
| `API_RATE_LIMIT_MAX` | `300` | Anonymous requests per IP per window. |
| `API_USER_RATE_LIMIT_MAX` | `600` | Signed-in requests per user per window. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Login window. |
| `AUTH_RATE_LIMIT_MAX` | `10` | Login attempts per IP + email per window. |
| `AUTH_IP_RATE_LIMIT_MAX` | `200` | Login attempts per IP per window (a whole campus shares one IP). |
| `REGISTER_RATE_LIMIT_WINDOW_MS` | `3600000` | Registration window (1 hour). |
| `REGISTER_RATE_LIMIT_MAX` | `60` | Registrations per IP per window. |
| `CASE_CREATE_LIMIT_PER_HOUR` | `10` | New requests per student per hour. |
| `LOOKUP_LIMIT_PER_10MIN` | `60` | Lookups per user per 10 minutes. |
| `RECRUITER_VERIFICATION_DAYS` | `365` | Default validity of a recruiter verification. |
| `SIMHASH_MAX_DISTANCE` | `6` | Similar-text threshold for related cases. |
| `CASE_STALE_DAYS` | `3` | Open cases idle this long are "stale". |
| `EVIDENCE_LINK_TTL_SECONDS` | `300` | Lifetime of an evidence download link. |
| `ALLOW_DEMO_SEED` | `false` | Lets the demo seeds run against a production configuration. Leave `false`. |

### Email and Google sign-in (Phase 9, optional)

Leave all of these unset and OfferShield behaves exactly as in Phase 8 (no email, no Google button, staff-assisted resets only).

| Variable | Default | Meaning |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `log` | `brevo` to send real email. `log` sends nothing in production. |
| `BREVO_API_KEY` | — | Brevo → SMTP & API → API keys. Required with `brevo`. Secret. |
| `EMAIL_FROM` | — | Verified sender address, e.g. `desk@yourdomain.in`. Required with `brevo`. |
| `EMAIL_FROM_NAME` | `OfferShield` | Sender name. |
| `EMAIL_DAILY_BUDGET` | `250` | Normal emails per UTC day (critical mail may go up to 290). |
| `REQUIRE_EMAIL_VERIFICATION` | `true` with `brevo`, else `false` | Password sign-ups must enter an emailed code. Startup fails if `true` with `log` in production. |
| `GOOGLE_CLIENT_ID` | — | Google Cloud OAuth client id. Set both or neither. |
| `GOOGLE_CLIENT_SECRET` | — | Google Cloud OAuth client secret. Secret. |
| `GOOGLE_REDIRECT_URI` | `${APP_BASE_URL}/api/v1/auth/google/callback` | Must match the redirect URI registered in Google Cloud exactly. |

### Never set on Render

| Variable | Why |
| --- | --- |
| `NODE_ENV` | See section 2. |
| `COOKIE_SECURE_OVERRIDE` | Development-only escape hatch for a local production smoke on `http://localhost`; ignored for an https `APP_BASE_URL`. |
| `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | Only the seed scripts read them; run seeds from your own machine (below). |
| `VITE_API_BASE_URL` | Client build-time override; leave unset so the client calls the same origin. |

`RENDER_GIT_COMMIT` is set by Render automatically and appears as `commit` in `GET /api/v1/health`.

## 4. First deploy checklist

1. Deploy; wait until the health check passes (`/api/v1/health/ready` → `{"status":"ready"}`).
2. Open `https://<service>.onrender.com/api/v1/health` and check `environment: "production"` and the commit.
3. Create the super admin from your machine: in `server/.env` set `MONGODB_URI` to the **production** string and `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`, then run `npm run seed:superadmin -w server`. Restore your local `MONGODB_URI` afterwards.
4. Optional demo data in the production database: `npm run seed:showcase -w server` from your machine (it creates only the `demo-campus` college, marked `isDemo`, behind the demo banner). Do not seed demo data into a database used by a real college unless you want it there.
5. Sign in as the super admin and onboard the pilot college (see [OPERATIONS.md](OPERATIONS.md)).
6. Check response headers on the home page: `content-security-policy`, `strict-transport-security`, `content-encoding: gzip|br`.

## 4a. Google Cloud setup (Google sign-in)

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. "OfferShield").
2. **APIs & Services → OAuth consent screen**: user type **External**; app name, support email, logo optional; authorised domain = your domain (e.g. `onrender.com` or your custom domain); scopes: `openid`, `email`, `profile` only (no sensitive scopes, so no Google review is needed). While the app is in **Testing**, only listed test users can sign in; click **Publish app** for the pilot.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised JavaScript origins: none needed (the flow is server-side).
   - Authorised redirect URI: `https://<your-domain>/api/v1/auth/google/callback` (and `http://localhost:5173/api/v1/auth/google/callback` for local development through the Vite proxy).
4. Copy the client id and secret into Render (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`); set `APP_BASE_URL` (or `GOOGLE_REDIRECT_URI`) to the same origin as the redirect URI.

## 4b. Brevo setup (email)

1. Create a Brevo account (free plan: 300 emails/day).
2. **Senders, domains & dedicated IPs → Domains → Add a domain** you control, then add the DNS records Brevo shows at your DNS host:
   - **SPF:** a TXT record on the root, e.g. `v=spf1 include:spf.brevo.com ~all` (merge with an existing SPF record; only one SPF record is allowed).
   - **DKIM:** the TXT/CNAME record(s) Brevo gives (e.g. `brevo1._domainkey`).
   - **DMARC:** a TXT record `_dmarc` such as `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.in` (tighten to `quarantine` once delivery looks healthy).
   - Brevo's domain verification TXT record.
3. Wait until Brevo shows the domain as authenticated, then add a sender (`EMAIL_FROM`) on that domain.
4. **SMTP & API → API keys → Generate** and put it in `BREVO_API_KEY` on Render. Never commit it.
5. Send yourself a test: register a student on the deployed site; the code should arrive within a minute (check spam the first time).

Without your own domain you can verify a single sender address, but delivery to college inboxes is much worse without SPF/DKIM; use a domain for the pilot.

## 4c. Rollout order for Phase 9

1. Deploy Phase 9 with **all email and Google variables unset** (behaves as Phase 8).
2. Run the backfill from your machine against production: set `MONGODB_URI` in `server/.env` to the production string, run `npm run ops:backfill-email-verified -w server` (prints counts; safe to re-run), then restore your local `MONGODB_URI`.
3. Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (and `APP_BASE_URL`); redeploy; test Continue with Google with a test account.
4. Add `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`; redeploy. Verification is now required for new password sign-ups; test register → code → verify, and Forgot password.

## 4d. Custom domain

Render → service → **Settings → Custom Domains → Add**, then create the CNAME (or A/ALIAS for the root) Render shows; Render issues the TLS certificate. Afterwards update `CLIENT_ORIGINS`, `APP_BASE_URL`, the Google redirect URI (Google Cloud and `GOOGLE_REDIRECT_URI` if set) and the Google consent screen's authorised domain to the new domain, and redeploy.

## 5. Free-plan sleep and warming before a demo

- Render's free web services spin down after about 15 minutes without traffic. The next request starts the instance again, which takes roughly 30–60 seconds; the client shows "Starting the server — this can take up to a minute on the free plan." after 5 seconds and keeps waiting (requests time out after 70 s).
- **Before a demo**, open `https://<service>.onrender.com/api/v1/health/ready` 2–3 minutes in advance and wait for `ready`, then open the app. Keep a tab open during the demo.
- A free Atlas M0 cluster can also pause after long inactivity (it resumes on the first connection, with a short delay).

## 6. Plans for a pilot

- **Render Starter ($7/month)** for a real pilot: no spin-down, so students and staff never wait for a cold start, and more memory/CPU for evidence uploads.
- Atlas M0 is fine for a single-college pilot (512 MB storage) but has **no automated backups**; follow the manual backup routine in [OPERATIONS.md](OPERATIONS.md), or move to a paid tier with backups.

## 7. Rotating `JWT_SECRET`

1. Generate a new secret (command above) and replace `JWT_SECRET` on Render.
2. Save; Render redeploys.
3. Effect: **every user is signed out** (all session cookies become invalid) and any evidence download link already issued stops working. Nothing else changes.

Rotate immediately if the secret may have leaked, and otherwise at most once per term. Tell staff beforehand.

## 8. Logs

Each request writes one JSON line to stdout (Render's **Logs** tab): `{ t, requestId, method, path, status, ms, uid? }`. The path never contains the query string, and bodies, cookies and tokens are never logged. Every response has an `X-Request-Id` header; error lines contain only `{ t, requestId, code }`, so a user's reported request id leads straight to the matching lines.

## 9. Local production smoke (optional)

```powershell
npm run build
$env:NODE_ENV = 'production'; $env:CLIENT_ORIGINS = 'http://localhost:5000'; $env:APP_BASE_URL = 'http://localhost:5000'; $env:TRUST_PROXY = '0'
npm start
# open http://localhost:5000 ; stop with Ctrl+C, then:
Remove-Item Env:NODE_ENV, Env:CLIENT_ORIGINS, Env:APP_BASE_URL, Env:TRUST_PROXY
```

Cookies are `Secure` in production; browsers accept Secure cookies on `http://localhost`. If yours does not, add `$env:COOKIE_SECURE_OVERRIDE = 'false'` for this local smoke only.
