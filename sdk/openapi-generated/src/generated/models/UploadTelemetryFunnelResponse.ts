/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UploadTelemetryStepSummary } from './UploadTelemetryStepSummary';
export type UploadTelemetryFunnelResponse = {
    tenant_id: string;
    total_events: number;
    steps: Array<UploadTelemetryStepSummary>;
    generated_at: string;
};

