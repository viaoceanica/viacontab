# ViaContab API Reference (v0.1)

This document is intended for building a separate UI/client against the ViaContab backend.

- **Backend app:** FastAPI (`backend/app/main.py`)
- **Default local base URL:** `http://127.0.0.1:8100`
- **Docker compose service URL (internal):** `http://backend:8000`
- **OpenAPI/Swagger:** `GET /docs`
- **OpenAPI JSON:** `GET /openapi.json`
- **Postman collection:** `docs/postman/viacontab.postman_collection.json`
- **Postman environment:** `docs/postman/viacontab.postman_environment.json`
- **TypeScript SDK (hand-crafted):** `sdk/typescript/`
- **TypeScript SDK (OpenAPI-generated):** `sdk/openapi-generated/`
- **External UI sample app:** `examples/external-ui/`

---

## 1) Conventions

### Transport
- JSON request/response unless endpoint is multipart upload.
- UTF-8.

### Authentication
- Currently **no enforced auth layer** in API routes.
- Tenant isolation is by `tenant_id` path parameter.

### Auth contract (for external interfaces)
To make client integration future-proof, clients should support optional headers now:
- `Authorization: Bearer <token>`
- `x-api-key: <key>`

Both SDKs include auth/header configuration so the interface can adopt auth without API-client rewrites.

### Error shape
Most errors are returned as:

```json
{ "detail": "human readable message" }
```

### IDs
- `invoice_id`, `line_item_id`, `failed_import_id` are UUIDs.

---

## 2) Health & Runtime

### `GET /api/health`
Basic liveness.

**Response**
```json
{ "ok": true, "service": "viacontab-backend" }
```

### `GET /api/ready`
Readiness (includes DB `SELECT 1`).

**Response**
```json
{ "ok": true, "service": "viacontab-backend", "ready": true }
```

### `GET /api/watchtower/uploads`
Runtime ingest monitor.

**Response**
```json
{
  "ok": true,
  "active": [{
    "task_id": "...",
    "tenant_id": "demo",
    "filename": "invoice.pdf",
    "stage": "extraction",
    "status": "running",
    "duration_seconds": 12.3,
    "stuck": false
  }],
  "recent": [ ... ]
}
```

---

## 3) Tenant Profile

### `GET /api/tenants/{tenant_id}/profile`
Get tenant company defaults used during extraction.

### `PUT /api/tenants/{tenant_id}/profile`
Update tenant profile.

**Body**
```json
{
  "company_name": "Via Oceânica",
  "company_nif": "123456789"
}
```

**Response**
```json
{
  "company_name": "Via Oceânica",
  "company_nif": "123456789"
}
```

---

## 4) Invoice Ingestion & Retrieval

### `POST /api/tenants/{tenant_id}/ingest`
Upload one or many files for extraction.

- multipart/form-data
- field name: `files`
- supports PDF/images; ZIP is expanded server-side with limits.

**Example**
```bash
curl -X POST \
  -F files=@invoice.pdf \
  http://127.0.0.1:8100/api/tenants/demo/ingest
```

**Response**
```json
{
  "ingested": [ { "id": "...", "filename": "invoice.pdf", "status": "processed", "line_items": [] } ],
  "rejected": [ { "filename": "doc.txt", "reason": "...", "detected_type": "..." } ]
}
```

### `GET /api/tenants/{tenant_id}/invoices`
List invoices for a tenant (includes `line_items`).

### `PATCH /api/invoices/{invoice_id}`
Update invoice fields and optionally full line item set.

**Body (typical UI save)**
```json
{
  "vendor": "Fornecedor X",
  "category": "serviços",
  "invoice_number": "FT 2026/123",
  "invoice_date": "2026-04-06",
  "due_date": "2026-04-20",
  "subtotal": 100.00,
  "tax": 23.00,
  "total": 123.00,
  "notes": "manual correction",
  "status": "corrigido",
  "requires_review": false,
  "line_items": [
    {
      "id": "line-uuid",
      "code": "A1",
      "description": "Serviço mensal",
      "quantity": 1,
      "unit_price": 100,
      "line_subtotal": 100,
      "line_tax_amount": 23,
      "line_total": 123,
      "tax_rate": 23
    }
  ]
}
```

### `DELETE /api/invoices/{invoice_id}`
Delete an invoice.

---

## 5) Corrections (AI Reprocess)

### `POST /api/invoices/{invoice_id}/corrections`
Apply free-text correction and reprocess from raw text.

**Body**
```json
{ "message": "O fornecedor correto é Via Oceânica" }
```

**Response**
Updated invoice object.

### `GET /api/invoices/{invoice_id}/corrections`
List correction history.

---

## 6) Failed Imports

### `GET /api/tenants/{tenant_id}/failed-imports`
List failed imports available for retry.

### `POST /api/failed-imports/{failed_import_id}/retry`
Retry one failed import (if blob stored).

**Response**
```json
{ "ok": true, "ingested": { ... }, "rejected": null }
```
or
```json
{ "ok": false, "ingested": null, "rejected": { ... } }
```

### `DELETE /api/failed-imports/{failed_import_id}`
Remove failed import row.

---

## 7) Review Queue & Blockers

### `GET /api/tenants/{tenant_id}/line-items/review`
Line items requiring review.

### `GET /api/tenants/{tenant_id}/line-items/quality`
Quality summary:
- `total_lines`
- `mapped_lines`
- `review_lines`
- `mapped_rate_pct`

### `GET /api/tenants/{tenant_id}/automation-blockers`
Computed blockers/warnings per invoice.

---

## 8) Line Item Labeling / Canonicalization

### `GET /api/tenants/{tenant_id}/line-items/suggestions?query=...&limit=8`
Canonical label suggestions.

### `POST /api/tenants/{tenant_id}/line-items/{line_item_id}/label`
Apply canonical label to a line item.

**Body**
```json
{
  "canonical_name": "hosting mensal",
  "line_type": "service",
  "line_category": "services/subscription",
  "normalized_unit": "unit"
}
```

### `POST /api/tenants/{tenant_id}/line-items/{line_item_id}/label-bulk?scope=vendor|tenant`
Apply label to matching items in bulk.

---

## 9) Search / AI Chat / Trends

### `POST /api/tenants/{tenant_id}/chat`
Ask natural-language questions over invoice embeddings/Qdrant.

**Body**
```json
{ "question": "Quanto gastei em hosting este mês?", "top_k": 5 }
```

**Response**
```json
{
  "answer": "...",
  "references": [
    { "invoice_id": "...", "vendor": "...", "invoice_number": "...", "score": 0.89 }
  ]
}
```

### `GET /api/tenants/{tenant_id}/cost-trends?item_query=...&days=90&vendor=...&limit=400`
Trend analysis for normalized line-item prices.

---

## 10) Upload Telemetry (UX analytics)

### `POST /api/tenants/{tenant_id}/telemetry/upload-event`
Write upload funnel event.

**Body**
```json
{
  "step": "validate",
  "status": "enter",
  "session_id": "session-123",
  "context": "upload_started",
  "timestamp": "2026-04-06T22:30:00Z"
}
```

- `step`: `validate | extract | review | save`
- `status`: `enter | success | failure`

### `GET /api/tenants/{tenant_id}/telemetry/upload-funnel?hours=72`
Aggregated step counters.

**Response**
```json
{
  "tenant_id": "demo",
  "total_events": 42,
  "steps": [
    { "step": "validate", "enter": 10, "success": 8, "failure": 2 },
    { "step": "extract", "enter": 8, "success": 7, "failure": 1 },
    { "step": "review", "enter": 7, "success": 7, "failure": 0 },
    { "step": "save", "enter": 7, "success": 7, "failure": 0 }
  ],
  "generated_at": "2026-04-06T22:31:14.789321Z"
}
```

---

## 11) Suggested Integration Flow for External UI

1. **Boot checks**
   - `GET /api/health`
   - `GET /api/ready`

2. **Tenant load**
   - `GET /api/tenants/{tenant_id}/profile`
   - `GET /api/tenants/{tenant_id}/invoices`
   - `GET /api/tenants/{tenant_id}/line-items/review`
   - `GET /api/tenants/{tenant_id}/failed-imports`

3. **Upload documents**
   - `POST /api/tenants/{tenant_id}/ingest`
   - poll/refresh invoices + watchtower

4. **Review/edit**
   - open invoice from list
   - edit invoice + line items
   - `PATCH /api/invoices/{invoice_id}` with `status="corrigido"`, `requires_review=false`

5. **Continuous quality loop**
   - use suggestions + label endpoints to improve normalization
   - monitor `line-items/quality` and `automation-blockers`

---

## 12) Notes for Client Developers

- Prefer refreshing independent sections (invoices, failed imports, review) and tolerate partial failures.
- For queue UX, avoid blocking all data if one endpoint fails.
- If reverse proxying through frontend, map `/api/*` consistently to backend to avoid browser CORS/network issues.
- Keep `tenant_id` explicit in all tenant-scoped calls.
