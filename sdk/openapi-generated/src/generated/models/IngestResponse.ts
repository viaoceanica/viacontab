/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvoiceBase } from './InvoiceBase';
import type { RejectedDocument } from './RejectedDocument';
export type IngestResponse = {
    ingested: Array<InvoiceBase>;
    rejected?: Array<RejectedDocument>;
};

