# ViaContab OpenAPI-Generated TypeScript Client

This SDK is generated from `openapi.json` (exported from the live backend `/openapi.json`).

## Build

```bash
cd sdk/openapi-generated
npm install
npm run build
```

`npm run build` will:
1. regenerate sources from `openapi.json`
2. compile TS declarations into `dist/`

## Refresh OpenAPI spec from live backend

```bash
curl -sS http://127.0.0.1:8100/openapi.json > openapi.json
npm run build
```

## Usage

```ts
import {
  configureViaContabOpenApiClient,
  DefaultService,
} from "@viacontab/openapi-client";

configureViaContabOpenApiClient({
  baseUrl: "http://127.0.0.1:8100",
  token: "<jwt>",
  apiKey: "<api-key>",
  apiKeyHeader: "x-api-key",
  headers: {
    "x-client": "external-ui",
  },
});

const health = await DefaultService.healthApiHealthGet();
```

> Method names come from FastAPI operation names and may be verbose.
