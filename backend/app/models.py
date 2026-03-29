import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    vendor = Column(String(255), nullable=True)
    vendor_address = Column(Text, nullable=True)
    vendor_contact = Column(String(255), nullable=True)
    category = Column(String(64), nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=True)
    tax = Column(Numeric(12, 2), nullable=True)
    total = Column(Numeric(12, 2), nullable=True)
    supplier_nif = Column(String(32), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_nif = Column(String(32), nullable=True)
    invoice_number = Column(String(128), nullable=True)
    invoice_date = Column(String(32), nullable=True)
    due_date = Column(String(32), nullable=True)
    currency = Column(String(16), nullable=True)
    raw_text = Column(Text, nullable=True)
    ai_payload = Column(Text, nullable=True)
    extraction_model = Column(String(128), nullable=True)
    learning_debug = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="processed")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    line_items = relationship(
        "InvoiceLineItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLineItem.position",
    )
    corrections = relationship(
        "InvoiceCorrection",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Numeric(6, 0), nullable=False, default=0)
    code = Column(String(128), nullable=True)
    description = Column(String(512), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=True)
    line_subtotal = Column(Numeric(12, 2), nullable=True)
    line_tax_amount = Column(Numeric(12, 2), nullable=True)
    line_total = Column(Numeric(12, 2), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)

    invoice = relationship("Invoice", back_populates="line_items")


class InvoiceCorrection(Base):
    __tablename__ = "invoice_corrections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    ai_payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="corrections")


class InvoiceTemplate(Base):
    __tablename__ = "invoice_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", "supplier_nif", name="uq_invoice_template"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    invoice_number = Column(String(128), nullable=False)
    supplier_nif = Column(String(32), nullable=False)
    payload = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "supplier_nif", name="uq_vendor_profile_nif"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    supplier_nif = Column(String(32), nullable=False)
    vendor_name = Column(String(255), nullable=True)
    payload = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TenantProfile(Base):
    __tablename__ = "tenant_profiles"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_tenant_profile_tenant"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    company_nif = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


