# ViaContab

Accounting intake module for the larger AI toolkit. Uploads invoices/receipts (PDF, images, CSV), extracts structured data via OpenAI, stores it per tenant, and exposes a clean API + UI for accountants to review.

## High-level architecture
- **Frontend:** Next.js (React) UI in Portuguese with invoice ingest + processed table.
- **Backend:** FastAPI service with a REST API, Postgres for structured data, Qdrant for semantic search/QA, OpenAI for extraction.
- **Infra:** Docker Compose stack (postgres, qdrant, backend, frontend).
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
