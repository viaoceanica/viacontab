import type {
  ApiHealth,
  ApiReady,
  AutomationBlockerListResponse,
  ChatResponse,
  CostTrendResponse,
  FailedImportListResponse,
  IngestResponse,
  Invoice,
  InvoiceCorrectionListResponse,
  InvoiceListResponse,
  InvoiceUpdatePayload,
  LineItemBulkLabelResponse,
  LineItemLabelRequest,
  LineItemQualitySummary,
  LineItemReviewListResponse,
  LineItemSuggestionListResponse,
  RetryFailedImportResponse,
  TenantProfile,
  UploadTelemetryEvent,
  UploadTelemetryFunnel,
  WatchtowerUploadsResponse,
} from "./types";

export class ViaContabApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ViaContabApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface ViaContabRequestContext {
  path: string;
  url: string;
  init: RequestInit;
}

export interface ViaContabResponseContext extends ViaContabRequestContext {
  response: Response;
}

export interface ViaContabClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  accessToken?: string;
  getAccessToken?: () => string | Promise<string>;
  apiKey?: string;
  apiKeyHeader?: string;
  beforeRequest?: (context: ViaContabRequestContext) => void | Promise<void>;
  afterResponse?: (context: ViaContabResponseContext) => void | Promise<void>;
}

export class ViaContabClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly getAccessToken?: () => string | Promise<string>;
  private accessToken?: string;
  private readonly apiKey?: string;
  private readonly apiKeyHeader: string;
  private readonly beforeRequest?: (context: ViaContabRequestContext) => void | Promise<void>;
  private readonly afterResponse?: (context: ViaContabResponseContext) => void | Promise<void>;

  constructor(options: ViaContabClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.accessToken = options.accessToken;
    this.getAccessToken = options.getAccessToken;
    this.apiKey = options.apiKey;
    this.apiKeyHeader = options.apiKeyHeader ?? "x-api-key";
    this.beforeRequest = options.beforeRequest;
    this.afterResponse = options.afterResponse;
  }

  setAccessToken(token?: string) {
    this.accessToken = token;
  }

  private async resolveAccessToken(): Promise<string | undefined> {
    if (this.getAccessToken) {
      return this.getAccessToken();
    }
    return this.accessToken;
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined) return;
        url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const accessToken = await this.resolveAccessToken();

    const headers = new Headers(this.defaultHeaders);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    if (this.apiKey && !headers.has(this.apiKeyHeader)) {
      headers.set(this.apiKeyHeader, this.apiKey);
    }

    const requestInit: RequestInit = {
      ...init,
      headers,
    };

    if (this.beforeRequest) {
      await this.beforeRequest({ path, url, init: requestInit });
    }

    const response = await this.fetchImpl(url, requestInit);

    if (this.afterResponse) {
      await this.afterResponse({ path, url, init: requestInit, response });
    }

    const raw = await response.text();
    const payload = raw ? (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    })() : null;

    if (!response.ok) {
      const detail = payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail: unknown }).detail
        : payload;
      throw new ViaContabApiError(
        `ViaContab API error (${response.status})`,
        response.status,
        detail
      );
    }

    return payload as T;
  }

  health(): Promise<ApiHealth> {
    return this.request<ApiHealth>("/api/health", { method: "GET" });
  }

  ready(): Promise<ApiReady> {
    return this.request<ApiReady>("/api/ready", { method: "GET" });
  }

  watchtowerUploads(): Promise<WatchtowerUploadsResponse> {
    return this.request<WatchtowerUploadsResponse>("/api/watchtower/uploads", { method: "GET" });
  }

  getTenantProfile(tenantId: string): Promise<TenantProfile> {
    return this.request<TenantProfile>(`/api/tenants/${tenantId}/profile`, { method: "GET" });
  }

  updateTenantProfile(tenantId: string, payload: TenantProfile): Promise<TenantProfile> {
    return this.request<TenantProfile>(`/api/tenants/${tenantId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  ingest(tenantId: string, files: File[] | Blob[]): Promise<IngestResponse> {
    const form = new FormData();
    files.forEach((file, index) => {
      if (file instanceof File) {
        form.append("files", file, file.name);
      } else {
        form.append("files", file, `upload-${index}`);
      }
    });
    return this.request<IngestResponse>(`/api/tenants/${tenantId}/ingest`, {
      method: "POST",
      body: form,
    });
  }

  listInvoices(tenantId: string): Promise<InvoiceListResponse> {
    return this.request<InvoiceListResponse>(`/api/tenants/${tenantId}/invoices`, { method: "GET" });
  }

  updateInvoice(invoiceId: string, payload: InvoiceUpdatePayload): Promise<Invoice> {
    return this.request<Invoice>(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  deleteInvoice(invoiceId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/api/invoices/${invoiceId}`, { method: "DELETE" });
  }

  listFailedImports(tenantId: string): Promise<FailedImportListResponse> {
    return this.request<FailedImportListResponse>(`/api/tenants/${tenantId}/failed-imports`, { method: "GET" });
  }

  retryFailedImport(failedImportId: string): Promise<RetryFailedImportResponse> {
    return this.request<RetryFailedImportResponse>(`/api/failed-imports/${failedImportId}/retry`, {
      method: "POST",
    });
  }

  deleteFailedImport(failedImportId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/api/failed-imports/${failedImportId}`, {
      method: "DELETE",
    });
  }

  listLineItemsForReview(tenantId: string, limit?: number): Promise<LineItemReviewListResponse> {
    return this.request<LineItemReviewListResponse>(
      `/api/tenants/${tenantId}/line-items/review`,
      { method: "GET" },
      { limit }
    );
  }

  listAutomationBlockers(tenantId: string, limit?: number): Promise<AutomationBlockerListResponse> {
    return this.request<AutomationBlockerListResponse>(
      `/api/tenants/${tenantId}/automation-blockers`,
      { method: "GET" },
      { limit }
    );
  }

  listLineItemSuggestions(tenantId: string, query: string, limit = 8): Promise<LineItemSuggestionListResponse> {
    return this.request<LineItemSuggestionListResponse>(
      `/api/tenants/${tenantId}/line-items/suggestions`,
      { method: "GET" },
      { query, limit }
    );
  }

  lineItemsQuality(tenantId: string): Promise<LineItemQualitySummary> {
    return this.request<LineItemQualitySummary>(`/api/tenants/${tenantId}/line-items/quality`, { method: "GET" });
  }

  labelLineItem(tenantId: string, lineItemId: string, payload: LineItemLabelRequest) {
    return this.request(`/api/tenants/${tenantId}/line-items/${lineItemId}/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  labelLineItemBulk(
    tenantId: string,
    lineItemId: string,
    payload: LineItemLabelRequest,
    scope: "vendor" | "tenant" = "vendor"
  ): Promise<LineItemBulkLabelResponse> {
    return this.request<LineItemBulkLabelResponse>(
      `/api/tenants/${tenantId}/line-items/${lineItemId}/label-bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { scope }
    );
  }

  applyCorrection(invoiceId: string, message: string): Promise<Invoice> {
    return this.request<Invoice>(`/api/invoices/${invoiceId}/corrections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  listCorrections(invoiceId: string): Promise<InvoiceCorrectionListResponse> {
    return this.request<InvoiceCorrectionListResponse>(`/api/invoices/${invoiceId}/corrections`, {
      method: "GET",
    });
  }

  chat(tenantId: string, question: string, topK = 5): Promise<ChatResponse> {
    return this.request<ChatResponse>(`/api/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, top_k: topK }),
    });
  }

  costTrends(
    tenantId: string,
    itemQuery: string,
    options?: { days?: number; vendor?: string; limit?: number }
  ): Promise<CostTrendResponse> {
    return this.request<CostTrendResponse>(
      `/api/tenants/${tenantId}/cost-trends`,
      { method: "GET" },
      {
        item_query: itemQuery,
        days: options?.days,
        vendor: options?.vendor,
        limit: options?.limit,
      }
    );
  }

  uploadTelemetryEvent(tenantId: string, payload: UploadTelemetryEvent): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/api/tenants/${tenantId}/telemetry/upload-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  uploadTelemetryFunnel(tenantId: string, hours = 72): Promise<UploadTelemetryFunnel> {
    return this.request<UploadTelemetryFunnel>(
      `/api/tenants/${tenantId}/telemetry/upload-funnel`,
      { method: "GET" },
      { hours }
    );
  }
}
