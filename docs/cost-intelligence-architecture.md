# ViaContab Cost Intelligence Architecture

_Last updated: 2026-04-04_

## Objective

Evolve ViaContab from an invoice extraction tool into a **multi-industry cost intelligence system**.

The goal is **not** just to find the cheapest vendor for a product. The goal is to detect when the cost of purchased inputs is changing over time, and help clients protect margins.

Examples:
- Food business: banana cost is rising, so menu prices may need adjustment.
- Auto business: brake pad or oil filter cost is rising, so workshop pricing may need adjustment.
- Technical services: subcontractor rates or recurring software costs are rising, so service package pricing may need adjustment.
- Vendor monitoring: the same vendor is gradually increasing prices on recurring purchases, so the client should notice and react.

## Core design principle

The system must be **domain-agnostic**.

It must support:
- physical goods
- raw materials
- consumables
- parts
- subscriptions
- subcontracted services
- labor/time-based items
- fixed fees

Produce is only one example. The model must generalize to car parts, technical services, and other domains.

## Business outcome

ViaContab should eventually answer questions like:
- Has the price of bananas gone up or down over the last 30/60/90 days?
- Has vendor X been raising the price of the same item over time?
- Which vendors sell brake-related parts?
- Has the hourly cost of external technical labor changed over time?
- Which purchased inputs are putting the most pressure on margin?
- Which products/services sold by the client are affected by those cost changes?

## Key distinction

This is **not primarily a semantic search problem**.

Embeddings/Qdrant are useful for:
- fuzzy retrieval
- chat context
- finding similar invoices
- exploratory queries

But cost intelligence should be driven mainly by **structured normalized line-item data in Postgres**.

## Current foundations already in place

ViaContab already has:
- invoice-level extraction
- stored line items (`code`, `description`, `quantity`, `unit_price`, `line_subtotal`, `line_tax_amount`, `line_total`, `tax_rate`)
- invoice-level category
- human correction loop
- invoice templates
- vendor profiles
- embeddings for invoice-level semantic retrieval

These are useful foundations, but not enough yet for robust cost intelligence.

## Required next layer: normalized purchased inputs

We need to move from raw extracted line items to **normalized purchased inputs**.

### Example raw descriptions
- BANANA
- BANANA KG
- BANANA PRATA
- PASTILHAS TRAVAO
- SAPATA TRAVAO
- MANUTENCAO TECNICA
- ASSISTENCIA MENSAL

These must map to canonical business concepts.

## Proposed conceptual model

### 1. Raw invoice line item
The raw extracted row from the supplier invoice.

### 2. Canonical concept
A normalized item/service identity.

Examples:
- `banana`
- `brake_pad`
- `synthetic_oil_5w30`
- `technical_maintenance_labor`
- `software_subscription`

### 3. Category tree
Hierarchical taxonomy, e.g.:
- food > fruit
- automotive > brake components
- automotive > lubricants
- services > technical labor
- services > software subscription
- overhead > utilities

### 4. Measurement model
The same system must support different pricing modes:
- `per_unit`
- `per_kg`
- `per_liter`
- `per_hour`
- `per_day`
- `per_month`
- `flat`

### 5. Time series cost record
For each normalized purchased input, store enough data to compare price over time.

## Proposed schema additions

### A. `catalog_items`
Canonical normalized business concepts.

Suggested fields:
- `id`
- `tenant_id` nullable (null for shared/global catalog, tenant-specific for custom concepts)
- `canonical_name`
- `display_name`
- `category_path`
- `item_type` (`product`, `service`, `subscription`, `fee`, `shipping`, `unknown`)
- `measurement_type` (`per_unit`, `per_kg`, `per_liter`, `per_hour`, `per_day`, `per_month`, `flat`)
- `base_unit`
- `active`
- timestamps

### B. `catalog_aliases`
Maps vendor/raw descriptions to canonical concepts.

Suggested fields:
- `id`
- `tenant_id`
- `vendor_profile_id` nullable
- `raw_label`
- `normalized_label`
- `catalog_item_id`
- `confidence`
- `source` (`human`, `rule`, `ai`, `learned`)
- timestamps

### C. Extend `invoice_line_items`
Keep raw extraction, but add normalized/enriched fields.

Suggested additions:
- `catalog_item_id`
- `raw_unit`
- `normalized_unit`
- `measurement_type`
- `normalized_quantity`
- `normalized_unit_price`
- `line_category`
- `line_type`
- `normalization_confidence`
- `needs_review`

### D. Optional future: `catalog_price_history`
May not be needed at first if price history can be derived from `invoice_line_items`, but may become useful for snapshotting and analytics.

### E. Optional future: `product_recipes` / `service_cost_models`
For margin impact mapping.

Examples:
- smoothie uses bananas + milk + sugar
- workshop service uses brake pad + labor hours
- service package includes subscription + subcontractor time

## Ingestion pipeline target state

### Step 1 — Extract raw line items
Use OCR/AI/QR/text extraction to get raw rows.

### Step 2 — Normalize description
Normalize spacing, casing, punctuation, common abbreviations, vendor quirks.

### Step 3 — Classify line type
Determine whether row is:
- product
- service
- subscription
- fee
- shipping
- tax-only
- summary/noise

### Step 4 — Match or suggest canonical concept
Use a mix of:
- exact alias rules
- normalized string matching
- vendor-specific learned aliases
- AI-assisted suggestion for unmapped rows

### Step 5 — Normalize measurement
Convert to a comparable unit where possible.

Examples:
- kg
- liter
- unit
- hour
- month

### Step 6 — Compute normalized cost signal
Examples:
- EUR/kg
- EUR/unit
- EUR/hour
- EUR/month

### Step 7 — Save confidence + review state
If mapping confidence is weak, mark for review instead of pretending certainty.

## Learning loop design

The current system already learns at vendor and invoice-template level. The next learning loop should extend that to line items.

### New learning target: alias mapping
When a human corrects a line item, the system should learn:
- raw label from vendor
- canonical item/service
- category
- measurement type
- unit normalization hints

This should create or strengthen a `catalog_aliases` record.

### Why this matters
Different vendors describe the same thing differently. A reusable alias layer is the key to cross-vendor analysis.

## Analytics the system should support

### Cost trend questions
- Has the price of bananas gone up?
- Has vendor X been increasing the price of bananas across the last 6 invoices?
- Has the average hourly rate of technical maintenance increased?
- Are oil filters more expensive this quarter than last quarter?

### Coverage questions
- Which vendors carry brake-related parts?
- Which invoices contain consulting labor?
- Which suppliers sell packaging materials?

### Margin-impact questions
- Which inputs changed most in cost this month?
- Which sold products/services are affected?
- What is the estimated impact on gross margin?
- Which selling prices may need revision?

## Important implementation notes

### 1. Price comparison must use normalized units
Do not compare raw line totals across vendors without unit normalization.

### 2. Confidence matters
If the system is unsure whether `BNN 1KG` means banana, it should say so and request review.

### 3. Keep raw and normalized values
Never overwrite raw extracted text. Store both raw and normalized values.

### 4. Multi-industry support is mandatory
Do not hardcode assumptions around produce, groceries, or physical goods only.

### 5. Embeddings are supportive, not primary
Use embeddings for discovery and chat context, but use structured SQL-friendly fields for actual cost analytics.

## Suggested phased roadmap

### Phase 1 — Stabilize line-item extraction
Goal:
- improve extraction accuracy
- reduce summary/tax/payment lines being mistaken for actual items
- keep line quantities/prices intact

### Phase 2 — Introduce normalized catalog layer
Goal:
- add canonical items/services
- add aliases
- add line-item enrichment fields

### Phase 3 — Human correction workflow for line items
Goal:
- let users fix line-item mapping/category/unit
- learn from those corrections

### Phase 4 — Cost trend analytics
Goal:
- price history per canonical concept
- price history for the same canonical concept within the same vendor
- moving averages
- % change windows (30/60/90d)
- vendor-by-vendor comparison
- vendor-specific drift detection for recurring purchases

### Phase 5 — Margin impact layer
Goal:
- map purchased inputs to sold outputs
- estimate cost impact on products/services
- surface pricing adjustment signals

## Practical MVP recommendation

If building this incrementally, the first thin slice should be:

1. keep current invoice extraction flow
2. add canonical mapping for line items
3. add normalized unit + normalized unit price
4. add one analytics view: **price trend over time for a canonical item/service**

That alone unlocks questions like:
- Is banana cost trending up?
- Did brake pad cost increase over the last 90 days?
- Has technical support hourly cost changed recently?

## Implementation status (2026-04-04)

First backend slice has been implemented and deployed:
- Added catalog tables: `catalog_items`, `catalog_aliases`.
- Extended `invoice_line_items` with normalized/enriched fields (`normalized_description`, catalog reference, unit/measurement fields, normalized quantity/price, line type/category, confidence, review flag).
- Ingest/edit/correction write paths now enrich line items before persistence.
- Added trend API endpoint:
  - `GET /api/tenants/{tenant_id}/cost-trends?item_query=...&days=...&vendor=...`
  - supports both cross-vendor and vendor-specific trend checks.
- Extraction runtime set to `openai/gpt-5.4-mini` and prompts were standardized/trimmed to reduce token usage.

Current limitation:
- Canonical mapping is still heuristic/auto-generated and needs stronger human-guided mapping UX in next phase.

## Resume point for future sessions

When resuming this topic, start from:
- this file
- the idea that ViaContab is becoming a **generic cost intelligence system**, not just invoice OCR
- the newly shipped backend trend API and line-item enrichment model
- next implementation target: improve canonical mapping quality + add UI for line-item review/corrections
