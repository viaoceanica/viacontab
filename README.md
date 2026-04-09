# ViaContab

Accounting intake module for the larger AI toolkit. Uploads invoices/receipts (PDF, images, CSV), extracts structured data via OpenAI, stores it per tenant, and exposes a clean API + UI for accountants to review.

## High-level architecture
- **Frontend:** Next.js (React) UI in Portuguese with invoice ingest + processed table.
- **Backend:** FastAPI service with a REST API, Postgres for structured data, Qdrant for semantic search/QA, OpenAI for extraction.
- **Infra:** Docker Compose stack (postgres, qdrant, backend, frontend).

## API Docs & Client Artifacts
- API reference: `docs/api-reference.md`
- Postman collection: `docs/postman/viacontab.postman_collection.json`
- Postman environment: `docs/postman/viacontab.postman_environment.json`
- TypeScript SDK (hand-crafted): `sdk/typescript/`
- TypeScript SDK (OpenAPI-generated): `sdk/openapi-generated/`
- External UI example app: `examples/external-ui/`

## Local runtime note
- Frontend now uses a server-side proxy path (`/api-proxy/api/*`) and rewrites to backend.
- Recommended defaults:
  - `SERVER_API_BASE_URL=http://backend:8000` (inside Docker network)
  - `PUBLIC_API_BASE_URL=` (empty unless you intentionally want direct browser calls)
- This avoids browser CORS/mixed-content issues when a separate interface consumes the API through frontend.
- **Multi-tenancy:** Each API call includes a `tenant_id`. Today we store tenant data in shared tables with a `tenant_id` column; the layout is designed so we can later fan out into per-tenant schemas/collections without rewriting business logic.

## Immediate milestone (MVP)
- Button to ingest invoices (upload files, placeholder extraction pipeline for now).
- Table listing processed invoices (vendor, category, subtotal, IVA, total, status, created_at).
- Backend endpoints:
  - `POST /api/tenants/{tenant_id}/ingest` – upload one or more files, returns stored invoice records.
  - `GET /api/tenants/{tenant_id}/invoices` – list processed invoices for that tenant.

## Roadmap
1. Hook real OpenAI extraction per file type (PDF/image/CSV) and push embeddings to Qdrant.
2. Build QA endpoints ("How much did we spend at X?", "Has price of bananas gone up?").
3. Add tenant-aware schemas/collections and auth gating.
4. Add review/correction UI and budgets/reports.

## Operational workflow

### Source of truth
- Treat `/data/.openclaw/workspace/projects/viacontab` as the source of truth.
- The live host copy is `/root/viacontab`.
- The running app containers do **not** bind-mount source code; deploys must sync + rebuild.

### Test before deploy
- Full test pass: `make test`
- Backend only: `make test-backend`
- Frontend only: `make test-frontend`

### Deploy to host
- Sync workspace → host: `make sync-host`
- Full deploy (tests + sync + rebuild + smoke): `make deploy`
- Host smoke checks only: `make smoke`

### Scripts added
- `scripts/test_backend.sh` — bootstraps backend venv and runs pytest
- `scripts/test_frontend.sh` — installs frontend deps, type-checks, and builds
- `scripts/test_all.sh` — runs backend + frontend checks
- `scripts/sync_host.sh` — syncs the workspace repo to `/root/viacontab` without overwriting host `.env` files
- `scripts/ensure_host_env.sh` — migrates required runtime env keys into host `infra/.env` when missing
- `scripts/deploy_host.sh` — test, sync, backup, rebuild, and smoke-test the live stack
- `scripts/smoke_host.sh` — checks backend/frontend health on the host after deployment

### Environment
- Keep secrets in `infra/.env` on the host, not hardcoded in `docker-compose.yml`.
- `infra/.env.example` is only a template.
