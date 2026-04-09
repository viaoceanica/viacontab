/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvoiceLineItemUpdateRequest } from './InvoiceLineItemUpdateRequest';
export type InvoiceUpdateRequest = {
    vendor?: (string | null);
    vendor_address?: (string | null);
    vendor_contact?: (string | null);
    category?: (string | null);
    subtotal?: (number | string | null);
    tax?: (number | string | null);
    total?: (number | string | null);
    supplier_nif?: (string | null);
    customer_name?: (string | null);
    customer_nif?: (string | null);
    invoice_number?: (string | null);
    invoice_date?: (string | null);
    due_date?: (string | null);
    currency?: (string | null);
    notes?: (string | null);
    status?: (string | null);
    requires_review?: (boolean | null);
    line_items?: (Array<InvoiceLineItemUpdateRequest> | null);
};

