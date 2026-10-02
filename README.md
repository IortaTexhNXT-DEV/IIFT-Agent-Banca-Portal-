# SalesVerse 2.0 – IIFT Agent/Banca Portal & Back-office

SalesVerse 2.0 configured for Insurans Islam Family Takaful Sendirian Berhad (IIFT):

- **Agent/Banca Portal** for agents, main agents and bank officers: participants, quotations for the seven IIFT products, submission and referral, payments and e-Receipts, renewals, endorsements, cancellations, claim notification, issues, reports and commission.
- **Back-office** for IIFT staff: maker-checker approvals, agent and agency administration, AML/KYC review, document checks, payment verification, claims, issue management with SLA, reports and schedules, end-of-day and FIN reconciliation, integration monitoring, users, roles, workflows, products and parameters.

## Repository layout

| Path | Contents |
|---|---|
| `apps/api` | REST API – Node.js 22, NestJS 12, Prisma 7, PostgreSQL 16 |
| `apps/api/prisma` | Database schema, migrations, reference data (`seed.ts`) and demonstration data (`seed-demo.ts`) |
| `apps/api/test` | End-to-end tests against a dedicated `*_test` database |
| `apps/web` | Web front end – React 19, TypeScript, Ant Design 6, Vite |
| `deploy` | Docker Compose deployment and environment template |
| `tools/security` | Repeatable application security checks (OWASP Top 10) |
| `docs/api` | OpenAPI description of the API |
| `docs/technical` | Architecture, data dictionary, quality and security reports, support handover |
| `docs/proposal` | Tender proposal and commercial workbook (with their build scripts) |
| `.github/workflows` | CI: formatting, lint, type check, tests, build, audit, SBOM, CodeQL, secret scan, image scan |

Each API module under `apps/api/src/modules` owns one functional area (for example `policies`, `billing`, `workflow`) with its controller, service, DTOs and tests. Cross-cutting pieces (Prisma client, encryption, numbering, data scoping, request context, error handling) live in `apps/api/src/common`.

## Prerequisites

- Node.js 22.12 or later and npm 11 (`npm install -g npm@11`)
- PostgreSQL 16

## Getting started

```bash
npm ci
cp apps/api/.env.example apps/api/.env      # then fill in the secrets (commands are in the file)

cd apps/api
npx prisma migrate deploy                   # create the schema
SEED_ADMIN_PASSWORD='<temporary password>' npm run db:seed
DEMO_PASSWORD='<password for demo users>' npm run db:seed:demo   # optional, never in production
npm run start:dev                            # API on http://localhost:3000, docs at /api/docs

cd ../web
npm run dev                                  # UI on http://localhost:5173 (proxies /api)
```

The first administrator signs in as `admin` with the temporary password and must change it. The demonstration data creates agents (`ag-000001`…), bank officers (`bk-000004`, `bk-000005`) and staff users (`manager`, `ops.maker`, `ops.checker`, `underwriter`, `finance`, `compliance`, `support`) with `DEMO_PASSWORD`.

## Everyday commands

| Command (from the repository root) | Purpose |
|---|---|
| `npm run lint` | oxlint for API and web |
| `npm run typecheck --workspaces` | TypeScript checks |
| `npm test --workspaces` | Unit tests (API services and rules; web components, API client and helpers) |
| `npx vitest run --coverage.enabled -w apps/api` | Unit tests with coverage over all API sources |
| `npm run test:e2e -w apps/api` | End-to-end API tests (rebuilds the `iift_test` database; set `TEST_DATABASE_URL` to change it) |
| `npm run build` | Production builds of API and web |
| `npx prettier --check "apps/*/src/**/*.{ts,tsx}"` | Formatting check |

Database changes: edit `apps/api/prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` in a development database and commit the generated migration. Releases apply migrations with `npx prisma migrate deploy`.

## Configuration

All settings are environment variables, validated at start-up by `apps/api/src/config/app-config.ts`; the API refuses to start in production with insecure values (for example a non-secure cookie or API docs enabled). `apps/api/.env.example` lists every variable. Business parameters that operations staff change (password policy, session timeouts, grace period, SLA hours, AML threshold) are maintained in Back-office > Parameters.

Integrations run in `simulated` mode until IIFT's endpoints are available; switching `INTEGRATION_MODE` to `live` requires the Core, Finance and SMTP settings.

## Deployment

```bash
cd deploy
cp .env.example .env                          # fill in secrets
docker compose --env-file .env run --rm migrate
docker compose --env-file .env up -d
```

The web container (nginx, non-root) serves the SPA and forwards `/api` to the API container; TLS is terminated at nginx or the IIFT load balancer. Health endpoints: `/health/live`, `/health/ready`; Prometheus metrics at `/metrics` (protect with `METRICS_TOKEN`). See `docs/technical` for the on-premise and cloud deployment architecture, sizing and runbooks.

## Security notes

- Server-side sessions in PostgreSQL; HttpOnly, SameSite=Strict cookies; CSRF token on every state-changing call; Argon2id password hashing; lockout and rate-limited sign-in.
- Permission-based access with agency/hierarchy data scoping; maker-checker enforced on the server.
- IC and passport numbers encrypted with AES-256-GCM and searchable through a keyed blind index; documents encrypted at rest; uploads checked by content and optionally by ClamAV.
- The audit trail is append-only, enforced by a database trigger.

Run `node tools/security/security-checks.mjs` against a test environment loaded with the demonstration data before each release (see the header of the script; pass `INBOUND_API_KEY` to also confirm a valid integration key is accepted). The results are kept in `docs/technical/evidence/security-checks.json`.
