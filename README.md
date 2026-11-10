# OfferShield — Campus Trust Desk

OfferShield is a Campus Recruitment Trust & Verification Desk for colleges. Students can search their college's reviewed recruiter records and confirmed suspicious indicators, and submit structured verification requests, with evidence, for suspicious external job or internship offers. Placement staff investigate each request as a case, the TPO head records the final decision with reasons, confirmed findings go into the college's registry, and the TPO publishes targeted advisories to students. It is multi-tenant (one tenant = one college) and is **not** a scam-detecting AI, placement ERP, job portal, recruiter marketplace or ATS — automated checks only assist staff and never decide whether an offer is genuine.

> **Status:** Phase 1 passed review; Phase 2 (MongoDB, authentication, tenancy, RBAC) implemented — awaiting architect review. See [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md).

## Prerequisites

- Node.js **20 or newer** (current LTS recommended) — check with `node -v`
- npm 10 or newer — check with `npm -v`
- Windows PowerShell 5.1+ (commands below), or any shell with equivalent commands

A MongoDB connection string (e.g. MongoDB Atlas) is required for `npm run dev` and the seed scripts. Tests use an in-memory MongoDB (`mongodb-memory-server`); the first test run downloads a MongoDB binary (~520 MB).

## Setup (PowerShell)

```powershell
Set-Location G:\offershield-campus-trust-desk

# 1. Install all workspace dependencies (root, client, server)
npm install

# 2. Create local env files from the examples (only if they do not exist yet)
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env }
if (-not (Test-Path client\.env)) { Copy-Item client\.env.example client\.env }   # optional; defaults work

# 3. Edit server\.env: set MONGODB_URI, JWT_SECRET (32+ chars) and the SEED_* values, then seed
npm run seed:superadmin -w server
npm run seed:demo -w server     # demo colleges demo-alpha / demo-beta (not in production)

# 4. Run API (http://localhost:5000) and client (http://localhost:5173) together
npm run dev
# Stop with Ctrl+C

# 5. Run tests (server then client; exits non-zero on any failure)
npm test
npm run test:server
npm run test:client

# 6. Lint and build
npm run lint
npm run build          # outputs client\dist
```

Check the API while `npm run dev` is running:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health    # direct
Invoke-RestMethod http://localhost:5173/api/v1/health    # through the Vite dev proxy
```

## Scripts (root)

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts server (nodemon) and client (Vite) together via `concurrently` |
| `npm run dev:server` / `npm run dev:client` | Starts one side only |
| `npm test` | Server tests (Jest) then client tests (Vitest) |
| `npm run test:server` / `npm run test:client` | One side only |
| `npm run build` | Production build of the client into `client/dist` |
| `npm run lint` | ESLint on the server, oxlint on the client |
| `npm run seed:superadmin -w server` | Create the super admin from `SEED_SUPERADMIN_*` (idempotent) |
| `npm run seed:demo -w server` | Create demo colleges, staff and students using `SEED_DEMO_PASSWORD` (idempotent) |

## Project structure

```
offershield-campus-trust-desk/
  package.json          npm workspaces root (client, server)
  docs/                 product, architecture, data model, API, security, decisions, phase status
  server/               Express 5 API (CommonJS)
    src/
      server.js         starts the HTTP listener only
      app.js            builds the Express app (used directly by tests)
      config/env.js     zod-validated configuration (the only place reading process.env)
      routes/           /api/v1 routers
      controllers/      request/response mapping only
      middleware/       authenticate, requireRole, requireTenant, enforcePasswordChange, rate limiters, validate, errors
      utils/AppError.js operational error type
      config/db.js      mongoose connect/disconnect
      models/           College, User, AuditLog
      repositories/     tenantRepository (college-scoped data access)
      services/         auth, admin, staff, audit
      validators/       zod .strict() body schemas
    scripts/            seed-superadmin.js, seed-demo.js
    tests/              Jest + Supertest
  client/               React + Vite + Tailwind CSS v4
    src/
      api/client.js     the single axios instance
      api/              auth, admin, staff, health
      auth/             AuthProvider, useAuth, roles
      components/       Layout, ProtectedRoute, HealthStatus, ui
      pages/            login, register, change password, student/staff/admin pages
      routes/           AppRoutes
      __tests__/        Vitest + Testing Library
```

## Documentation

- [Product scope](docs/PRODUCT_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [API contract](docs/API_CONTRACT.md)
- [Security design](docs/SECURITY_DESIGN.md)
- [Decisions (ADRs)](docs/DECISIONS.md)
- [Phase status](docs/PHASE_STATUS.md)
