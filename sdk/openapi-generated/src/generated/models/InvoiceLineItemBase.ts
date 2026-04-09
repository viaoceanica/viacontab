/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type InvoiceLineItemBase = {
    id: string;
    code?: (string | null);
    description?: (string | null);
    normalized_description?: (string | null);
    quantity?: (string | null);
    unit_price?: (string | null);
    line_subtotal?: (string | null);
    line_tax_amount?: (string | null);
    line_total?: (string | null);
    tax_rate?: (string | null);
    tax_rate_source?: (string | null);
    catalog_item_id?: (string | null);
    raw_unit?: (string | null);
    normalized_unit?: (string | null);
    measurement_type?: (string | null);
    normalized_quantity?: (string | null);
    normalized_unit_price?: (string | null);
    line_category?: (string | null);
    line_type?: (string | null);
    normalization_confidence?: (string | null);
    needs_review?: boolean;
    review_reason?: (string | null);
};

