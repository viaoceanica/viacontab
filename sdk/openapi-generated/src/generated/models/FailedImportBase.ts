/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FailedImportBase = {
    id: string;
    tenant_id: string;
    filename: string;
    mime_type?: (string | null);
    file_size?: (number | null);
    reason: string;
    detected_type?: (string | null);
    source: string;
    retry_count?: number;
    last_retry_at?: (string | null);
    created_at: string;
};

