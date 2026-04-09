/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AutomationBlockerListResponse } from '../models/AutomationBlockerListResponse';
import type { Body_ingest_invoices_api_tenants__tenant_id__ingest_post } from '../models/Body_ingest_invoices_api_tenants__tenant_id__ingest_post';
import type { ChatRequest } from '../models/ChatRequest';
import type { ChatResponse } from '../models/ChatResponse';
import type { CostTrendResponse } from '../models/CostTrendResponse';
import type { FailedImportListResponse } from '../models/FailedImportListResponse';
import type { IngestResponse } from '../models/IngestResponse';
import type { InvoiceBase } from '../models/InvoiceBase';
import type { InvoiceCorrectionListResponse } from '../models/InvoiceCorrectionListResponse';
import type { InvoiceCorrectionRequest } from '../models/InvoiceCorrectionRequest';
import type { InvoiceLineItemBase } from '../models/InvoiceLineItemBase';
import type { InvoiceListResponse } from '../models/InvoiceListResponse';
import type { InvoiceUpdateRequest } from '../models/InvoiceUpdateRequest';
import type { LineItemBulkLabelResponse } from '../models/LineItemBulkLabelResponse';
import type { LineItemLabelRequest } from '../models/LineItemLabelRequest';
import type { LineItemQualitySummary } from '../models/LineItemQualitySummary';
import type { LineItemReviewListResponse } from '../models/LineItemReviewListResponse';
import type { LineItemSuggestionListResponse } from '../models/LineItemSuggestionListResponse';
import type { TenantProfileRequest } from '../models/TenantProfileRequest';
import type { TenantProfileResponse } from '../models/TenantProfileResponse';
import type { UploadTelemetryEventRequest } from '../models/UploadTelemetryEventRequest';
import type { UploadTelemetryFunnelResponse } from '../models/UploadTelemetryFunnelResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health
     * @returns any Successful Response
     * @throws ApiError
     */
    public static healthApiHealthGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health',
        });
    }
    /**
     * Watchtower Uploads
     * @returns any Successful Response
     * @throws ApiError
     */
    public static watchtowerUploadsApiWatchtowerUploadsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/watchtower/uploads',
        });
    }
    /**
     * Ready
     * @returns any Successful Response
     * @throws ApiError
     */
    public static readyApiReadyGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ready',
        });
    }
    /**
     * Record Upload Telemetry Event
     * @param tenantId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static recordUploadTelemetryEventApiTenantsTenantIdTelemetryUploadEventPost(
        tenantId: string,
        requestBody: UploadTelemetryEventRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tenants/{tenant_id}/telemetry/upload-event',
            path: {
                'tenant_id': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Upload Telemetry Funnel
     * @param tenantId
     * @param hours
     * @returns UploadTelemetryFunnelResponse Successful Response
     * @throws ApiError
     */
    public static uploadTelemetryFunnelApiTenantsTenantIdTelemetryUploadFunnelGet(
        tenantId: string,
        hours: number = 24,
    ): CancelablePromise<UploadTelemetryFunnelResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/telemetry/upload-funnel',
            path: {
                'tenant_id': tenantId,
            },
            query: {
                'hours': hours,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Tenant Profile
     * @param tenantId
     * @returns TenantProfileResponse Successful Response
     * @throws ApiError
     */
    public static getTenantProfileApiTenantsTenantIdProfileGet(
        tenantId: string,
    ): CancelablePromise<TenantProfileResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/profile',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Tenant Profile
     * @param tenantId
     * @param requestBody
     * @returns TenantProfileResponse Successful Response
     * @throws ApiError
     */
    public static updateTenantProfileApiTenantsTenantIdProfilePut(
        tenantId: string,
        requestBody: TenantProfileRequest,
    ): CancelablePromise<TenantProfileResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tenants/{tenant_id}/profile',
            path: {
                'tenant_id': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Invoices
     * @param tenantId
     * @returns InvoiceListResponse Successful Response
     * @throws ApiError
     */
    public static listInvoicesApiTenantsTenantIdInvoicesGet(
        tenantId: string,
    ): CancelablePromise<InvoiceListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/invoices',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Failed Imports
     * @param tenantId
     * @returns FailedImportListResponse Successful Response
     * @throws ApiError
     */
    public static listFailedImportsApiTenantsTenantIdFailedImportsGet(
        tenantId: string,
    ): CancelablePromise<FailedImportListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/failed-imports',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Automation Blockers
     * @param tenantId
     * @param limit
     * @returns AutomationBlockerListResponse Successful Response
     * @throws ApiError
     */
    public static listAutomationBlockersApiTenantsTenantIdAutomationBlockersGet(
        tenantId: string,
        limit: number = 200,
    ): CancelablePromise<AutomationBlockerListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/automation-blockers',
            path: {
                'tenant_id': tenantId,
            },
            query: {
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Line Items For Review
     * @param tenantId
     * @param limit
     * @returns LineItemReviewListResponse Successful Response
     * @throws ApiError
     */
    public static listLineItemsForReviewApiTenantsTenantIdLineItemsReviewGet(
        tenantId: string,
        limit: number = 200,
    ): CancelablePromise<LineItemReviewListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/line-items/review',
            path: {
                'tenant_id': tenantId,
            },
            query: {
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Suggest Line Item Labels
     * @param tenantId
     * @param query
     * @param limit
     * @returns LineItemSuggestionListResponse Successful Response
     * @throws ApiError
     */
    public static suggestLineItemLabelsApiTenantsTenantIdLineItemsSuggestionsGet(
        tenantId: string,
        query: string,
        limit: number = 8,
    ): CancelablePromise<LineItemSuggestionListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/line-items/suggestions',
            path: {
                'tenant_id': tenantId,
            },
            query: {
                'query': query,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Line Items Quality Summary
     * @param tenantId
     * @returns LineItemQualitySummary Successful Response
     * @throws ApiError
     */
    public static lineItemsQualitySummaryApiTenantsTenantIdLineItemsQualityGet(
        tenantId: string,
    ): CancelablePromise<LineItemQualitySummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/line-items/quality',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Label Line Item
     * @param tenantId
     * @param lineItemId
     * @param requestBody
     * @returns InvoiceLineItemBase Successful Response
     * @throws ApiError
     */
    public static labelLineItemApiTenantsTenantIdLineItemsLineItemIdLabelPost(
        tenantId: string,
        lineItemId: string,
        requestBody: LineItemLabelRequest,
    ): CancelablePromise<InvoiceLineItemBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tenants/{tenant_id}/line-items/{line_item_id}/label',
            path: {
                'tenant_id': tenantId,
                'line_item_id': lineItemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Label Line Item Bulk
     * @param tenantId
     * @param lineItemId
     * @param requestBody
     * @param scope
     * @returns LineItemBulkLabelResponse Successful Response
     * @throws ApiError
     */
    public static labelLineItemBulkApiTenantsTenantIdLineItemsLineItemIdLabelBulkPost(
        tenantId: string,
        lineItemId: string,
        requestBody: LineItemLabelRequest,
        scope: string = 'vendor',
    ): CancelablePromise<LineItemBulkLabelResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tenants/{tenant_id}/line-items/{line_item_id}/label-bulk',
            path: {
                'tenant_id': tenantId,
                'line_item_id': lineItemId,
            },
            query: {
                'scope': scope,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Cost Trends
     * @param tenantId
     * @param itemQuery
     * @param days
     * @param vendor
     * @param limit
     * @returns CostTrendResponse Successful Response
     * @throws ApiError
     */
    public static costTrendsApiTenantsTenantIdCostTrendsGet(
        tenantId: string,
        itemQuery: string,
        days: number = 90,
        vendor?: (string | null),
        limit: number = 400,
    ): CancelablePromise<CostTrendResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tenants/{tenant_id}/cost-trends',
            path: {
                'tenant_id': tenantId,
            },
            query: {
                'item_query': itemQuery,
                'days': days,
                'vendor': vendor,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Invoice
     * @param invoiceId
     * @param requestBody
     * @returns InvoiceBase Successful Response
     * @throws ApiError
     */
    public static updateInvoiceApiInvoicesInvoiceIdPatch(
        invoiceId: string,
        requestBody: InvoiceUpdateRequest,
    ): CancelablePromise<InvoiceBase> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/invoices/{invoice_id}',
            path: {
                'invoice_id': invoiceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Invoice
     * @param invoiceId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteInvoiceApiInvoicesInvoiceIdDelete(
        invoiceId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/invoices/{invoice_id}',
            path: {
                'invoice_id': invoiceId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Ingest Invoices
     * @param tenantId
     * @param formData
     * @returns IngestResponse Successful Response
     * @throws ApiError
     */
    public static ingestInvoicesApiTenantsTenantIdIngestPost(
        tenantId: string,
        formData: Body_ingest_invoices_api_tenants__tenant_id__ingest_post,
    ): CancelablePromise<IngestResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tenants/{tenant_id}/ingest',
            path: {
                'tenant_id': tenantId,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Chat With Invoices
     * @param tenantId
     * @param requestBody
     * @returns ChatResponse Successful Response
     * @throws ApiError
     */
    public static chatWithInvoicesApiTenantsTenantIdChatPost(
        tenantId: string,
        requestBody: ChatRequest,
    ): CancelablePromise<ChatResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tenants/{tenant_id}/chat',
            path: {
                'tenant_id': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Failed Import
     * @param failedImportId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteFailedImportApiFailedImportsFailedImportIdDelete(
        failedImportId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/failed-imports/{failed_import_id}',
            path: {
                'failed_import_id': failedImportId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Retry Failed Import
     * @param failedImportId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static retryFailedImportApiFailedImportsFailedImportIdRetryPost(
        failedImportId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/failed-imports/{failed_import_id}/retry',
            path: {
                'failed_import_id': failedImportId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Apply Invoice Correction
     * @param invoiceId
     * @param requestBody
     * @returns InvoiceBase Successful Response
     * @throws ApiError
     */
    public static applyInvoiceCorrectionApiInvoicesInvoiceIdCorrectionsPost(
        invoiceId: string,
        requestBody: InvoiceCorrectionRequest,
    ): CancelablePromise<InvoiceBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/invoices/{invoice_id}/corrections',
            path: {
                'invoice_id': invoiceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Invoice Corrections
     * @param invoiceId
     * @returns InvoiceCorrectionListResponse Successful Response
     * @throws ApiError
     */
    public static listInvoiceCorrectionsApiInvoicesInvoiceIdCorrectionsGet(
        invoiceId: string,
    ): CancelablePromise<InvoiceCorrectionListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/invoices/{invoice_id}/corrections',
            path: {
                'invoice_id': invoiceId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
