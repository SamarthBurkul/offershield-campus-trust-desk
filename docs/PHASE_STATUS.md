# Phase Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: monorepo, Express API with health endpoint, security baseline, validated config, React client shell, tests, docs | **Implemented — awaiting architect review** |
| 2 | MongoDB, colleges, users, authentication, tenant context, RBAC | Not started |
| 3 | Cases: submission, staff queue, case events, internal notes | Not started |
| 4 | Evidence uploads and final decisions | Not started |
| 5 | College registry: recruiters and indicators, student search | Not started |
| 6 | Advisories, acknowledgements, notifications, audit log views | Not started |
| 7 | Hardening, deployment and release readiness | Not started |

## Phase 1 — details

**Status:** Implemented — awaiting architect review (not yet passed).

### Implemented

- npm workspaces monorepo (`client`, `server`) with root `dev`, `test`, `build`, `lint` scripts; `engines.node >= 20`.
- Express 5 API (CommonJS): `app.js` builds the app, `server.js` only listens.
- Pipeline: `x-powered-by` disabled → helmet → CORS allow-list with credentials → JSON body limit 100 kb → baseline `/api` rate limiter → `/api/v1` routes → `notFound` → `errorHandler`.
- `GET /api/v1/health` with `database: "not_configured"`.
- Standard error envelope: `NOT_FOUND`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `BAD_REQUEST`, `RATE_LIMITED`, `INTERNAL_ERROR`, `AppError` codes; no stack traces outside development.
- zod-validated, frozen config (`loadConfig`), fail-fast with key names only; ESLint rule blocks `process.env` outside `config/env.js`.
- React 19 + Vite 8 + Tailwind v4 client: Layout, HomePage, NotFoundPage, HealthStatus (loading / healthy / unavailable), single axios instance, Vite `/api` proxy.

### Tests executed (2026-11-10, Node v22.13.1, npm 10.9.2)

| Command | Result | Exit code |
| --- | --- | --- |
| `npm run test:server` | Test Suites: 3 passed, 3 total; Tests: 18 passed, 18 total | 0 |
| `npm run test:client` | Test Files 2 passed (2); Tests 5 passed (5) | 0 |
| `npm test` | 18 server + 5 client passed, 0 failed | 0 |
| `npm test` with a temporary failing test (removed afterwards) | Tests: 1 failed, 18 passed; client tests not run | 1 |
| `npm run build` | `client/dist` produced | 0 |
| `npm run lint` | ESLint: 0 problems; oxlint: 0 warnings, 0 errors | 0 |
| Smoke: `GET :5000/api/v1/health` and `GET :5173/api/v1/health` (proxy) | 200 with expected JSON on both | — |

### Limitations

- No database, auth, tenancy or features (by design for Phase 1).
- Rate limiter uses in-memory storage and no `trust proxy` setting; revisit at deployment.
- `npm audit` reports 23 low/moderate advisories in dev-only Jest transitive dependencies (`glob`, `minimatch`, `deepmerge`); production dependencies audit clean. The suggested fix downgrades Jest to v25, so it was not applied.

**Next authorised phase:** none until architect approval.
