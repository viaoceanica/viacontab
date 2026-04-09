export type UUID = string;

export interface ApiHealth {
  ok: boolean;
  service: string;
}

export interface ApiReady extends ApiHealth {
  ready: boolean;
}

export interface TenantProfile {
  company_name?: string | null;
  company_nif?: string | null;
}

export interface InvoiceLineItem {
  id: UUID;
  code?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  line_subtotal?: number | null;
  line_tax_amount?: number | null;
  line_total?: number | null;
  tax_rate?: number | null;
  tax_rate_source?: string | null;
  review_reason?: string | null;
}

export interface Invoice {
  id: UUID;
  tenant_id: string;
  filename: string;
  vendor?: string | null;
  vendor_address?: string | null;
  vendor_contact?: string | null;
  category?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  supplier_nif?: string | null;
  customer_name?: string | null;
  customer_nif?: string | null;
  token_input?: number | null;
  token_output?: number | null;
  token_total?: number | null;
  confidence_score?: number | null;
  requires_review?: boolean;
  notes?: string | null;
  line_items?: InvoiceLineItem[];
  status: string;
  created_at: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
}

export interface RejectedDocument {
  filename: string;
  reason: string;
  detected_type?: string | null;
}

export interface IngestResponse {
  ingested: Invoice[];
  rejected: RejectedDocument[];
}

export interface FailedImportRow {
  id: UUID;
  tenant_id: string;
  filename: string;
  mime_type?: string | null;
  file_size?: number | null;
  reason: string;
  detected_type?: string | null;
  source: string;
  retry_count: number;
  last_retry_at?: string | null;
  created_at: string;
}

export interface FailedImportListResponse {
  items: FailedImportRow[];
}

export interface ReviewLineItem {
  invoice_id: UUID;
  invoice_number?: string | null;
  vendor?: string | null;
  filename: string;
  created_at: string;
  line_item_id: UUID;
  position?: number | null;
  description?: string | null;
  line_total?: number | null;
  tax_rate?: number | null;
  tax_rate_source?: string | null;
  normalization_confidence?: number | null;
  review_reason?: string | null;
}

export interface LineItemReviewListResponse {
  items: ReviewLineItem[];
}

export interface LineItemSuggestion {
  canonical_name: string;
  display_name?: string | null;
  line_type?: string | null;
  line_category?: string | null;
  normalized_unit?: string | null;
  confidence?: number | null;
  source?: string;
}

export interface LineItemSuggestionListResponse {
  items: LineItemSuggestion[];
}

export interface LineItemQualitySummary {
  total_lines: number;
  mapped_lines: number;
  review_lines: number;
  mapped_rate_pct: number;
}

export interface AutomationBlocker {
  invoice_id: UUID;
  invoice_number?: string | null;
  filename: string;
  vendor?: string | null;
  code: string;
  severity: string;
  message: string;
  created_at: string;
}

export interface AutomationBlockerListResponse {
  items: AutomationBlocker[];
}

export interface LineItemLabelRequest {
  canonical_name: string;
  line_type?: string;
  line_category?: string;
  normalized_unit?: string;
}

export interface LineItemBulkLabelResponse {
  line_item_id: UUID;
  updated_count: number;
}

export interface ChatReference {
  invoice_id: UUID;
  vendor?: string | null;
  invoice_number?: string | null;
  score?: number | null;
}

export interface ChatResponse {
  answer: string;
  references: ChatReference[];
}

export interface CostTrendPoint {
  invoice_id: UUID;
  invoice_number?: string | null;
  vendor?: string | null;
  created_at: string;
  description?: string | null;
  canonical_item?: string | null;
  normalized_unit?: string | null;
  normalized_quantity?: number | null;
  normalized_unit_price?: number | null;
}

export interface CostTrendSummary {
  current_avg_unit_price?: number | null;
  previous_avg_unit_price?: number | null;
  pct_change?: number | null;
  sample_size_current: number;
  sample_size_previous: number;
  days: number;
  vendor?: string | null;
  item_query: string;
}

export interface CostTrendResponse {
  summary: CostTrendSummary;
  points: CostTrendPoint[];
}

export interface InvoiceCorrection {
  id: UUID;
  message: string;
  created_at: string;
}

export interface InvoiceCorrectionListResponse {
  items: InvoiceCorrection[];
}

export type UploadStep = "validate" | "extract" | "review" | "save";
export type UploadStepStatus = "enter" | "success" | "failure";

export interface UploadTelemetryEvent {
  step: UploadStep;
  status: UploadStepStatus;
  session_id?: string;
  context?: string;
  timestamp?: string;
}

export interface UploadTelemetryStepSummary {
  step: UploadStep;
  enter: number;
  success: number;
  failure: number;
}

export interface UploadTelemetryFunnel {
  tenant_id: string;
  total_events: number;
  steps: UploadTelemetryStepSummary[];
  generated_at: string;
}

export interface WatchtowerTask {
  task_id: string;
  tenant_id: string;
  filename: string;
  stage: string;
  started_at: string;
  updated_at: string;
  status: string;
  reason?: string | null;
  duration_seconds: number;
  stuck?: boolean;
}

export interface WatchtowerUploadsResponse {
  ok: boolean;
  active: WatchtowerTask[];
  recent: WatchtowerTask[];
}

export interface RetryFailedImportResponse {
  ok: boolean;
  ingested: Invoice | null;
  rejected: RejectedDocument | null;
}

export interface InvoiceUpdatePayload {
  vendor?: string | null;
  vendor_address?: string | null;
  vendor_contact?: string | null;
  category?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  supplier_nif?: string | null;
  customer_name?: string | null;
  customer_nif?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  notes?: string | null;
  status?: string | null;
  requires_review?: boolean | null;
  line_items?: Array<{
    id?: UUID;
    code?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    line_subtotal?: number | null;
    line_tax_amount?: number | null;
    line_total?: number | null;
    tax_rate?: number | null;
  }>;
}
