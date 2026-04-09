# ViaContab External UI Example

Minimal React (Vite) app showing how a separate interface can consume ViaContab API via the TypeScript SDK.

## What it demonstrates
- health/readiness checks
- queue loading (`listInvoices`)
- opening an invoice
- editing notes + line items
- saving invoice (`updateInvoice`) with `status="corrigido"` and `requires_review=false`
- optional auth contract fields:
  - `Authorization: Bearer <token>`
  - `x-api-key: <key>`

## Run

```bash
cd sdk/typescript
npm install
npm run build

cd ../../examples/external-ui
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://127.0.0.1:5173`).

## Notes
- By default this example points to `http://127.0.0.1:8100`.
- If backend runs elsewhere, change **Base URL** in the UI.
