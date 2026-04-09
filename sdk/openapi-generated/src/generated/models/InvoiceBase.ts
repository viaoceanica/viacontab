/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvoiceLineItemBase } from './InvoiceLineItemBase';
import type { LearningDebugInfo } from './LearningDebugInfo';
export type InvoiceBase = {
    id: string;
    tenant_id: string;
    filename: string;
    vendor?: (string | null);
    vendor_address?: (string | null);
    vendor_contact?: (string | null);
    category?: (string | null);
    subtotal?: (string | null);
    tax?: (string | null);
    total?: (string | null);
    supplier_nif?: (string | null);
    customer_name?: (string | null);
    customer_nif?: (string | null);
    invoice_number?: (string | null);
    invoice_date?: (string | null);
    due_date?: (string | null);
    currency?: (string | null);
    raw_text?: (string | null);
    ai_payload?: (string | null);
    extraction_model?: (string | null);
    token_input?: (number | null);
    token_output?: (number | null);
    token_total?: (number | null);
    confidence_score?: (string | null);
    requires_review?: boolean;
    notes?: (string | null);
    line_items?: Array<InvoiceLineItemBase>;
    learning_debug?: (LearningDebugInfo | null);
    status: string;
    created_at: string;
};

