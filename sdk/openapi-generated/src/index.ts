// Re-export generated SDK artifacts
export * from "./generated";
export { OpenAPI } from "./generated/core/OpenAPI";

import { OpenAPI } from "./generated/core/OpenAPI";

export interface ConfigureOpenApiClientOptions {
  baseUrl: string;
  token?: string;
  headers?: Record<string, string>;
  apiKey?: string;
  apiKeyHeader?: string;
}

/**
 * Configure runtime base URL and optional auth/header contracts for the generated client.
 */
export function configureViaContabOpenApiClient(options: ConfigureOpenApiClientOptions) {
  OpenAPI.BASE = options.baseUrl.replace(/\/$/, "");

  if (options.token) {
    OpenAPI.TOKEN = options.token;
  }

  const mergedHeaders: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (options.apiKey) {
    mergedHeaders[options.apiKeyHeader ?? "x-api-key"] = options.apiKey;
  }

  if (Object.keys(mergedHeaders).length > 0) {
    OpenAPI.HEADERS = mergedHeaders;
  }
}
