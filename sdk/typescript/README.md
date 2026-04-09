# ViaContab TypeScript SDK

Lightweight TS client for ViaContab backend.

## Install (local package)

```bash
cd sdk/typescript
npm install
npm run build
```

Then consume `dist/` or publish as internal package.

## Quick start

```ts
import { ViaContabClient } from "@viacontab/api-client";

const api = new ViaContabClient({
  baseUrl: "http://127.0.0.1:8100",
});

const health = await api.health();
const invoices = await api.listInvoices("demo");
```

## Auth + interceptor hooks

```ts
const api = new ViaContabClient({
  baseUrl: "https://api.example.com",
  // static bearer token
  accessToken: "<jwt>",
  // OR dynamic retrieval
  // getAccessToken: async () => authStore.getToken(),

  // optional API key contract
  apiKey: "<api-key>",
  apiKeyHeader: "x-api-key",

  beforeRequest: async ({ url, init }) => {
    console.debug("request", url, init.method);
  },
  afterResponse: async ({ url, response }) => {
    console.debug("response", url, response.status);
  },
});

// rotate token at runtime
api.setAccessToken("<new-jwt>");
```

## Common flow

```ts
const tenantId = "demo";

await api.ready();
await api.updateTenantProfile(tenantId, {
  company_name: "Via Oceânica",
  company_nif: "123456789",
});

// List queue data
const [invoices, failed, review, blockers] = await Promise.all([
  api.listInvoices(tenantId),
  api.listFailedImports(tenantId),
  api.listLineItemsForReview(tenantId),
  api.listAutomationBlockers(tenantId),
]);

// Save invoice edits
await api.updateInvoice("<invoice-id>", {
  status: "corrigido",
  requires_review: false,
  notes: "manual correction",
  line_items: [
    {
      id: "<line-item-id>",
      description: "Hosting mensal",
      quantity: 1,
      unit_price: 100,
      line_subtotal: 100,
      line_tax_amount: 23,
      line_total: 123,
      tax_rate: 23,
    },
  ],
});
```

## Error handling

SDK throws `ViaContabApiError` with:
- `status`
- `detail` (from backend `detail` message when available)

```ts
try {
  await api.listInvoices("demo");
} catch (error) {
  if (error instanceof ViaContabApiError) {
    console.error(error.status, error.detail);
  }
}
```
