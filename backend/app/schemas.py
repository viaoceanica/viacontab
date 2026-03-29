import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field




class InvoiceCorrectionBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message: str
    created_at: datetime


class InvoiceLineItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    line_subtotal: Optional[Decimal] = None
    line_tax_amount: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None


class InvoiceLineItemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[uuid.UUID] = None
    code: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    line_subtotal: Optional[Decimal] = None
    line_tax_amount: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None


class LearningDebugInfo(BaseModel):
    vendor_profile_applied: bool = False
    vendor_profile_score: Optional[int] = None
    vendor_profile_match_key: Optional[str] = None
    vendor_profile_vendor_name: Optional[str] = None
    invoice_template_applied: bool = False
    invoice_template_score: Optional[int] = None
    invoice_template_invoice_number: Optional[str] = None
    invoice_template_supplier_nif: Optional[str] = None


class InvoiceBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: str
    filename: str
    vendor: Optional[str] = None
    vendor_address: Optional[str] = None
    vendor_contact: Optional[str] = None
    category: Optional[str] = None
    subtotal: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    total: Optional[Decimal] = None
    supplier_nif: Optional[str] = None
    customer_name: Optional[str] = None
    customer_nif: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    raw_text: Optional[str] = None
    ai_payload: Optional[str] = None
    extraction_model: Optional[str] = None
    notes: Optional[str] = None
    line_items: list[InvoiceLineItemBase] = []
    learning_debug: Optional[LearningDebugInfo] = None
    status: str
    created_at: datetime


class InvoiceListResponse(BaseModel):
    items: list[InvoiceBase]


class TenantProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: Optional[str] = None
    company_nif: Optional[str] = None


class TenantProfileResponse(BaseModel):
    company_name: Optional[str] = None
    company_nif: Optional[str] = None


class InvoiceUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor: Optional[str] = None
    vendor_address: Optional[str] = None
    vendor_contact: Optional[str] = None
    category: Optional[str] = None
    subtotal: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    total: Optional[Decimal] = None
    supplier_nif: Optional[str] = None
    customer_name: Optional[str] = None
    customer_nif: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    line_items: Optional[list[InvoiceLineItemUpdateRequest]] = None


class IngestResponse(BaseModel):
    ingested: list[InvoiceBase]


class InvoiceCorrectionRequest(BaseModel):
    message: str = Field(..., min_length=3, max_length=1000)


class InvoiceCorrectionListResponse(BaseModel):
    items: list[InvoiceCorrectionBase]


class ChatReference(BaseModel):
    invoice_id: uuid.UUID
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    score: Optional[float] = None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    top_k: int = Field(5, ge=1, le=10)


class ChatResponse(BaseModel):
    answer: str
    references: list[ChatReference]

