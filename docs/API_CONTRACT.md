# API Contract

## Base path

All endpoints are served under **`/api/v1`**. Requests and responses use JSON (`Content-Type: application/json`). Request bodies are limited to **100 kb**.

## Standard error envelope

Every error response has this shape:

```json
{ "error": { "code": "UPPER_SNAKE_CASE", "message": "Human-readable, safe message" } }
```

No stack traces are returned in `production` (or `test`). In `development` only, unexpected 500 errors may include `error.stack` to help local debugging.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body is not valid JSON (`message`: "Malformed JSON body") |
| 400 | `BAD_REQUEST` | Other unreadable bodies (unsupported charset/encoding) |
| 404 | `NOT_FOUND` | No route matches (`message`: "Route not found") |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kb |
| 429 | `RATE_LIMITED` | Baseline `/api` rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Any unexpected error (`message`: "An unexpected error occurred") |
| varies | custom | Thrown `AppError(status, code, message)` |

Rate-limit information is returned in the IETF draft-8 `RateLimit` / `RateLimit-Policy` headers.

## Implemented endpoints

### `GET /api/v1/health`

Liveness information for the API. No authentication.

**200 OK**

```json
{
  "status": "ok",
  "service": "offershield-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 12,
  "timestamp": "2026-11-10T07:30:00.000Z",
  "database": "not_configured"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `status` | string | Always `"ok"` when the process can respond |
| `service` | string | Always `"offershield-api"` |
| `version` | string | `version` from `server/package.json` |
| `environment` | string | `development` \| `test` \| `production` |
| `uptimeSeconds` | integer | Whole seconds since process start |
| `timestamp` | string | ISO 8601 UTC |
| `database` | string | `"not_configured"` in Phase 1; Phase 2 will report connection state |

Other possible responses: `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.

## Planned route groups (not implemented)

| Group | Phase (indicative) | Purpose |
| --- | --- | --- |
| `/api/v1/auth` | 2 | Login, logout, current session (httpOnly cookie) |
| `/api/v1/users` | 2 | College user management by TPO head |
| `/api/v1/colleges` | 2 | Tenant onboarding (super_admin) |
| `/api/v1/cases` | 3 | Student requests, staff queue, status transitions, info requests |
| `/api/v1/cases/:id/events` | 3 | Student-visible timeline |
| `/api/v1/cases/:id/notes` | 3 | Staff-only internal notes |
| `/api/v1/cases/:id/evidence` | 4 | Validated uploads and short-lived download links |
| `/api/v1/cases/:id/decision` | 4 | Final decision by TPO head |
| `/api/v1/registry/recruiters` | 5 | Reviewed recruiter records |
| `/api/v1/registry/indicators` | 5 | Confirmed indicators and search |
| `/api/v1/advisories` | 6 | Publish, target and acknowledge advisories |
| `/api/v1/notifications` | 6 | In-app notifications |
| `/api/v1/audit-logs` | 6 | Read-only audit trail for TPO head |
