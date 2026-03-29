from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any, List
from uuid import UUID

import io
import json
import os
import zipfile

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .database import engine, get_session
from .embeddings import search_invoice_embeddings, upsert_invoice_embedding
from .models import Base, Invoice, InvoiceCorrection, InvoiceLineItem, InvoiceTemplate, VendorProfile, TenantProfile
from .processing import build_extraction_from_text, extract_invoice_data
from .schemas import (
    InvoiceBase,
    InvoiceCorrectionListResponse,
    InvoiceCorrectionRequest,
    ChatRequest,
    ChatResponse,
    IngestResponse,
    InvoiceListResponse,
    InvoiceUpdateRequest,
    TenantProfileRequest,
    TenantProfileResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()
Base.metadata.create_all(bind=engine)

MISSING_INVOICE_COLUMNS = {
    "supplier_nif": "ALTER TABLE invoices ADD COLUMN supplier_nif VARCHAR(32)",
    "customer_name": "ALTER TABLE invoices ADD COLUMN customer_name VARCHAR(255)",
    "customer_nif": "ALTER TABLE invoices ADD COLUMN customer_nif VARCHAR(32)",
    "invoice_number": "ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(128)",
    "invoice_date": "ALTER TABLE invoices ADD COLUMN invoice_date VARCHAR(32)",
    "due_date": "ALTER TABLE invoices ADD COLUMN due_date VARCHAR(32)",
    "currency": "ALTER TABLE invoices ADD COLUMN currency VARCHAR(16)",
    "raw_text": "ALTER TABLE invoices ADD COLUMN raw_text TEXT",
    "ai_payload": "ALTER TABLE invoices ADD COLUMN ai_payload TEXT",
    "extraction_model": "ALTER TABLE invoices ADD COLUMN extraction_model VARCHAR(128)",
    "learning_debug": "ALTER TABLE invoices ADD COLUMN learning_debug TEXT",
}

MISSING_TENANT_PROFILE_COLUMNS = {
    "company_name": "ALTER TABLE tenant_profiles ADD COLUMN company_name VARCHAR(255)",
    "company_nif": "ALTER TABLE tenant_profiles ADD COLUMN company_nif VARCHAR(32)",
}


MISSING_LINE_ITEM_COLUMNS = {
    "code": "ALTER TABLE invoice_line_items ADD COLUMN code VARCHAR(128)",
    "line_subtotal": "ALTER TABLE invoice_line_items ADD COLUMN line_subtotal NUMERIC(12, 2)",
    "line_tax_amount": "ALTER TABLE invoice_line_items ADD COLUMN line_tax_amount NUMERIC(12, 2)",
}


def ensure_invoice_columns() -> None:
    with engine.begin() as connection:
        invoice_columns = {
            row[0]
            for row in connection.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'invoices'
                    """
                )
            )
        }
        for column_name, ddl in MISSING_INVOICE_COLUMNS.items():
            if column_name not in invoice_columns:
                connection.execute(text(ddl))

        line_columns = {
            row[0]
            for row in connection.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'invoice_line_items'
                    """
                )
            )
        }
        for column_name, ddl in MISSING_LINE_ITEM_COLUMNS.items():
            if column_name not in line_columns:
                connection.execute(text(ddl))

        tenant_profile_columns = {
            row[0]
            for row in connection.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'tenant_profiles'
                    """
                )
            )
        }
        for column_name, ddl in MISSING_TENANT_PROFILE_COLUMNS.items():
            if column_name not in tenant_profile_columns:
                connection.execute(text(ddl))


ensure_invoice_columns()


def get_or_create_tenant_profile(tenant_id: str, session: Session) -> TenantProfile:
    profile = session.query(TenantProfile).filter(TenantProfile.tenant_id == tenant_id).one_or_none()
    if profile:
        return profile
    profile = TenantProfile(tenant_id=tenant_id)
    session.add(profile)
    session.flush()
    return profile


def apply_tenant_defaults_to_extraction(extraction: dict[str, Any], tenant_id: str, session: Session) -> dict[str, Any]:
    profile = get_or_create_tenant_profile(tenant_id, session)
    if profile.company_name:
        extraction["customer_name"] = profile.company_name
    else:
        extraction["customer_name"] = None
    if profile.company_nif:
        extraction["customer_nif"] = profile.company_nif
    else:
        extraction["customer_nif"] = None
    return extraction


def apply_extraction_to_invoice(invoice: Invoice, extraction: dict[str, Any], session: Session) -> None:
    invoice.vendor = extraction.get("vendor")
    invoice.vendor_address = extraction.get("vendor_address")
    invoice.vendor_contact = extraction.get("vendor_contact")
    invoice.category = extraction.get("category")
    invoice.subtotal = extraction.get("subtotal")
    invoice.tax = extraction.get("tax")
    invoice.total = extraction.get("total")
    invoice.supplier_nif = extraction.get("supplier_nif")
    invoice.customer_name = extraction.get("customer_name")
    invoice.customer_nif = extraction.get("customer_nif")
    invoice.invoice_number = extraction.get("invoice_number")
    invoice.invoice_date = extraction.get("invoice_date")
    invoice.due_date = extraction.get("due_date")
    invoice.currency = extraction.get("currency")
    invoice.raw_text = extraction.get("raw_text")
    invoice.ai_payload = extraction.get("ai_payload")
    invoice.extraction_model = extraction.get("extraction_model")
    invoice.notes = extraction.get("notes")

    session.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice.id).delete()
    for item in extraction.get("line_items", []):
        session.add(
            InvoiceLineItem(
                invoice_id=invoice.id,
                position=item.get("position"),
                code=item.get("code"),
                description=item.get("description"),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                line_subtotal=item.get("line_subtotal"),
                line_tax_amount=item.get("line_tax_amount"),
                line_total=item.get("line_total"),
                tax_rate=item.get("tax_rate"),
            )
        )


def normalize_identifier(value: str | None) -> str | None:
    if not value:
        return None
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = normalized.lower().strip()
    normalized = re.sub(r"[^a-z0-9]+", "", normalized)
    return normalized or None


def normalize_digits(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D+", "", value)
    return digits or None


def looks_like_instruction_text(value: str | None) -> bool:
    if not value:
        return False
    lowered = value.lower().strip()
    instruction_markers = [
        "ao contrario",
        "ao contrário",
        "troca",
        "swap",
        "invert",
        "corrige",
        "correc",
        "correct",
        "cliente",
        "fornecedor",
        "vendor",
        "customer",
        "client",
        "nif",
        "data de vencimento",
    ]
    return any(marker in lowered for marker in instruction_markers) and len(lowered.split()) > 3


def sanitize_learned_value(value: str | None) -> str | None:
    if not value:
        return value
    cleaned = value.strip()
    if looks_like_instruction_text(cleaned):
        return None
    return cleaned


def build_vendor_profile_payload(invoice: Invoice) -> dict[str, Any]:
    raw_text = invoice.raw_text or ""
    upper_text = raw_text.upper()
    cues: dict[str, Any] = {
        "ignore_customer_values": [],
        "invoice_number_prefix": None,
    }

    if invoice.invoice_number:
        prefix_match = re.match(r"([A-Z]+)", invoice.invoice_number.upper())
        if prefix_match:
            cues["invoice_number_prefix"] = prefix_match.group(1)

    for bad_customer in ["EXMO(S)", "EXMO (S)", "EXMO(S) SR (S)", "EXMO(S) SENHOR(ES)", "CLIENTE"]:
        if bad_customer in upper_text:
            cues["ignore_customer_values"].append(bad_customer)

    return {
        "vendor": sanitize_learned_value(invoice.vendor),
        "vendor_address": sanitize_learned_value(invoice.vendor_address),
        "vendor_contact": sanitize_learned_value(invoice.vendor_contact),
        "supplier_nif": sanitize_learned_value(invoice.supplier_nif),
        "category": sanitize_learned_value(invoice.category),
        "currency": sanitize_learned_value(invoice.currency),
        "customer_name": None,
        "customer_nif": None,
        "notes": sanitize_learned_value(invoice.notes),
        "cues": cues,
    }


def init_learning_debug() -> dict[str, Any]:
    return {
        "vendor_profile_applied": False,
        "vendor_profile_score": None,
        "vendor_profile_match_key": None,
        "vendor_profile_vendor_name": None,
        "invoice_template_applied": False,
        "invoice_template_score": None,
        "invoice_template_invoice_number": None,
        "invoice_template_supplier_nif": None,
    }


def apply_vendor_profile_to_extraction(
    extraction: dict[str, Any],
    tenant_id: str,
    session: Session,
    debug: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized_supplier_nif = normalize_digits(extraction.get("supplier_nif"))
    normalized_vendor = normalize_identifier(extraction.get("vendor"))

    profiles = session.query(VendorProfile).filter(VendorProfile.tenant_id == tenant_id).all()
    if not profiles:
        return extraction

    best_profile: VendorProfile | None = None
    best_score = 0
    best_match_key: str | None = None
    for profile in profiles:
        score = 0
        match_key = None
        profile_nif = normalize_digits(profile.supplier_nif)
        profile_vendor = normalize_identifier(profile.vendor_name)

        if normalized_supplier_nif and profile_nif == normalized_supplier_nif:
            score += 100
            match_key = "supplier_nif"
        if normalized_vendor and profile_vendor == normalized_vendor:
            score += 60
            match_key = match_key or "vendor_name_exact"
        elif normalized_vendor and profile_vendor and (
            normalized_vendor in profile_vendor or profile_vendor in normalized_vendor
        ):
            score += 30
            match_key = match_key or "vendor_name_partial"

        if score > best_score:
            best_score = score
            best_profile = profile
            best_match_key = match_key

    if debug is not None:
        debug["vendor_profile_score"] = best_score or None
        debug["vendor_profile_match_key"] = best_match_key
        debug["vendor_profile_vendor_name"] = best_profile.vendor_name if best_profile else None

    if not best_profile or best_score < 60:
        return extraction

    try:
        payload = json.loads(best_profile.payload)
    except json.JSONDecodeError:
        return extraction

    for field in [
        "vendor",
        "vendor_address",
        "vendor_contact",
        "supplier_nif",
        "category",
        "currency",
        "customer_name",
        "customer_nif",
    ]:
        value = sanitize_learned_value(payload.get(field))
        if value:
            extraction[field] = value

    cues = payload.get("cues") or {}
    ignore_customer_values = {str(value).strip().upper() for value in cues.get("ignore_customer_values") or [] if value}
    customer_name = str(extraction.get("customer_name") or "").strip().upper()
    if customer_name and customer_name in ignore_customer_values:
        extraction["customer_name"] = payload.get("customer_name") or None

    if payload.get("notes") and not extraction.get("notes"):
        extraction["notes"] = payload["notes"]

    if debug is not None:
        debug["vendor_profile_applied"] = True

    return extraction


def upsert_vendor_profile(invoice: Invoice, session: Session) -> None:
    normalized_supplier_nif = normalize_digits(invoice.supplier_nif)
    normalized_vendor = normalize_identifier(invoice.vendor)
    if not normalized_supplier_nif and not normalized_vendor:
        return

    profile = None
    if normalized_supplier_nif:
        profile = (
            session.query(VendorProfile)
            .filter(
                VendorProfile.tenant_id == invoice.tenant_id,
                VendorProfile.supplier_nif == normalized_supplier_nif,
            )
            .one_or_none()
        )

    if not profile and normalized_vendor:
        profiles = session.query(VendorProfile).filter(VendorProfile.tenant_id == invoice.tenant_id).all()
        for candidate in profiles:
            candidate_vendor = normalize_identifier(candidate.vendor_name)
            if candidate_vendor and candidate_vendor == normalized_vendor:
                profile = candidate
                break

    payload = json.dumps(build_vendor_profile_payload(invoice))
    if profile:
        profile.vendor_name = invoice.vendor
        profile.supplier_nif = normalized_supplier_nif or profile.supplier_nif
        profile.payload = payload
    else:
        session.add(
            VendorProfile(
                tenant_id=invoice.tenant_id,
                supplier_nif=normalized_supplier_nif or normalized_vendor or "unknown",
                vendor_name=invoice.vendor,
                payload=payload,
            )
        )


def score_template_match(
    template: InvoiceTemplate,
    extraction: dict[str, Any],
    normalized_invoice_number: str | None,
    normalized_supplier_nif: str | None,
    normalized_vendor: str | None,
) -> int:
    score = 0
    template_invoice = normalize_identifier(template.invoice_number)
    template_nif = normalize_digits(template.supplier_nif)

    if normalized_invoice_number and template_invoice == normalized_invoice_number:
        score += 100
    elif normalized_invoice_number and template_invoice and (
        normalized_invoice_number in template_invoice or template_invoice in normalized_invoice_number
    ):
        score += 70

    if normalized_supplier_nif and template_nif == normalized_supplier_nif:
        score += 100

    try:
        payload = json.loads(template.payload)
    except json.JSONDecodeError:
        payload = {}

    payload_vendor = normalize_identifier(payload.get("vendor"))
    if normalized_vendor and payload_vendor == normalized_vendor:
        score += 40
    elif normalized_vendor and payload_vendor and (
        normalized_vendor in payload_vendor or payload_vendor in normalized_vendor
    ):
        score += 20

    payload_total = payload.get("total")
    extraction_total = extraction.get("total")
    if payload_total is not None and extraction_total is not None:
        try:
            if abs(float(payload_total) - float(extraction_total)) < 0.01:
                score += 15
        except (TypeError, ValueError):
            pass

    return score


def apply_template_to_extraction(
    extraction: dict[str, Any],
    tenant_id: str,
    session: Session,
    debug: dict[str, Any] | None = None,
) -> dict[str, Any]:
    extraction = apply_vendor_profile_to_extraction(extraction, tenant_id, session, debug=debug)

    invoice_number = extraction.get("invoice_number")
    supplier_nif = extraction.get("supplier_nif")
    vendor = extraction.get("vendor")

    normalized_invoice_number = normalize_identifier(invoice_number)
    normalized_supplier_nif = normalize_digits(supplier_nif)
    normalized_vendor = normalize_identifier(vendor)

    if not any([normalized_invoice_number, normalized_supplier_nif, normalized_vendor]):
        return extraction

    candidates = (
        session.query(InvoiceTemplate)
        .filter(InvoiceTemplate.tenant_id == tenant_id)
        .order_by(InvoiceTemplate.updated_at.desc())
        .all()
    )

    best_template: InvoiceTemplate | None = None
    best_score = 0
    for template in candidates:
        score = score_template_match(
            template,
            extraction,
            normalized_invoice_number=normalized_invoice_number,
            normalized_supplier_nif=normalized_supplier_nif,
            normalized_vendor=normalized_vendor,
        )
        if score > best_score:
            best_score = score
            best_template = template

    if debug is not None:
        debug["invoice_template_score"] = best_score or None
        debug["invoice_template_invoice_number"] = best_template.invoice_number if best_template else None
        debug["invoice_template_supplier_nif"] = best_template.supplier_nif if best_template else None

    if not best_template or best_score < 100:
        return extraction

    try:
        payload = json.loads(best_template.payload)
    except json.JSONDecodeError:
        return extraction
    extraction.update(payload)
    if debug is not None:
        debug["invoice_template_applied"] = True
    return extraction


def upsert_invoice_template(invoice: Invoice, session: Session) -> None:
    if not invoice.invoice_number or not invoice.supplier_nif:
        return
    payload = json.dumps(
        {
            "vendor": sanitize_learned_value(invoice.vendor),
            "vendor_address": sanitize_learned_value(invoice.vendor_address),
            "vendor_contact": sanitize_learned_value(invoice.vendor_contact),
            "supplier_nif": sanitize_learned_value(invoice.supplier_nif),
            "category": sanitize_learned_value(invoice.category),
            "subtotal": float(invoice.subtotal) if invoice.subtotal is not None else None,
            "tax": float(invoice.tax) if invoice.tax is not None else None,
            "total": float(invoice.total) if invoice.total is not None else None,
            "customer_name": sanitize_learned_value(invoice.customer_name),
            "customer_nif": sanitize_learned_value(invoice.customer_nif),
            "invoice_number": sanitize_learned_value(invoice.invoice_number),
            "invoice_date": sanitize_learned_value(invoice.invoice_date),
            "due_date": sanitize_learned_value(invoice.due_date),
            "currency": sanitize_learned_value(invoice.currency),
            "notes": sanitize_learned_value(invoice.notes),
            "line_items": [
                {
                    "position": index + 1,
                    "code": item.code,
                    "description": item.description,
                    "quantity": float(item.quantity) if item.quantity is not None else None,
                    "unit_price": float(item.unit_price) if item.unit_price is not None else None,
                    "line_subtotal": float(item.line_subtotal) if item.line_subtotal is not None else None,
                    "line_tax_amount": float(item.line_tax_amount) if item.line_tax_amount is not None else None,
                    "line_total": float(item.line_total) if item.line_total is not None else None,
                    "tax_rate": float(item.tax_rate) if item.tax_rate is not None else None,
                }
                for index, item in enumerate(invoice.line_items or [])
            ],
        }
    )
    template = (
        session.query(InvoiceTemplate)
        .filter(
            InvoiceTemplate.tenant_id == invoice.tenant_id,
            InvoiceTemplate.invoice_number == invoice.invoice_number,
            InvoiceTemplate.supplier_nif == invoice.supplier_nif,
        )
        .one_or_none()
    )
    if template:
        template.payload = payload
    else:
        session.add(
            InvoiceTemplate(
                tenant_id=invoice.tenant_id,
                invoice_number=invoice.invoice_number,
                supplier_nif=invoice.supplier_nif,
                payload=payload,
            )
        )


def expand_zip_upload(upload: UploadFile) -> list[UploadFile]:
    buffer = upload.file.read()
    upload.file.seek(0)
    expanded: list[UploadFile] = []
    try:
        with zipfile.ZipFile(io.BytesIO(buffer)) as archive:
            for member in archive.namelist():
                if member.endswith('/'):
                    continue
                data = archive.read(member)
                file_obj = io.BytesIO(data)
                filename = os.path.basename(member) or 'documento.zip'
                expanded.append(UploadFile(filename=filename, file=file_obj))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail='Arquivo ZIP inválido') from exc
    return expanded


def format_invoice_context(invoice: Invoice) -> str:
    currency = invoice.currency or "EUR"
    header = f"Fatura {invoice.invoice_number or invoice.id} do fornecedor {invoice.vendor or 'desconhecido'}"
    dates = f"Emitida em {invoice.invoice_date or 'data desconhecida'} (vencimento {invoice.due_date or 'n/d'})"
    totals = f"Subtotal {invoice.subtotal or 0} {currency} · IVA {invoice.tax or 0} {currency} · Total {invoice.total or 0} {currency}"
    lines = []
    for item in (invoice.line_items or [])[:5]:
        lines.append(
            f"- {item.description or 'Item'} (cód. {item.code or '—'}): {item.line_total or item.line_subtotal or 0} {currency} (Qtd {item.quantity or 0})"
        )
    if not lines:
        lines.append("- Sem linhas registadas")
    return "\n".join([header, dates, totals, "Linhas:", *lines])


def build_chat_answer(question: str, contexts: list[str]) -> str:
    if not settings.openai_api_key:
        return "Serviço de IA indisponível (OPENAI_API_KEY em falta)."
    context_text = "\n\n".join(contexts)
    prompt = (
        "Responde em português (Portugal) com base apenas nas faturas abaixo. "
        "Se a pergunta não estiver coberta, diz que não tens dados suficientes.\n\n"
        f"Dados das faturas:\n{context_text}\n\n"
        f"Pergunta: {question}\nResposta:"
    )
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.responses.create(
            model=settings.extraction_model,
            input=prompt,
            max_output_tokens=500,
        )
        answer = getattr(response, "output_text", "") or ""
        return answer.strip() or "Não encontrei uma resposta com os dados disponíveis."
    except Exception as exc:
        logger.warning("Falha ao gerar resposta: %s", exc)
        return "Não consegui gerar uma resposta com os dados disponíveis."


app = FastAPI(title="ViaContab API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_tenant(tenant_id: str) -> str:
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório")
    return tenant_id


@app.get("/api/health")
def health():
    return {"ok": True, "service": "viacontab-backend"}


@app.get("/api/tenants/{tenant_id}/profile", response_model=TenantProfileResponse)
def get_tenant_profile(tenant_id: str, session: Session = Depends(get_session)):
    tenant_id = require_tenant(tenant_id)
    profile = get_or_create_tenant_profile(tenant_id, session)
    return {"company_name": profile.company_name, "company_nif": profile.company_nif}


@app.put("/api/tenants/{tenant_id}/profile", response_model=TenantProfileResponse)
def update_tenant_profile(tenant_id: str, payload: TenantProfileRequest, session: Session = Depends(get_session)):
    tenant_id = require_tenant(tenant_id)
    profile = get_or_create_tenant_profile(tenant_id, session)
    updates = payload.model_dump(exclude_unset=True)
    if "company_name" in updates:
        profile.company_name = updates.get("company_name")
    if "company_nif" in updates:
        profile.company_nif = updates.get("company_nif")
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return {"company_name": profile.company_name, "company_nif": profile.company_nif}


@app.get("/api/tenants/{tenant_id}/invoices", response_model=InvoiceListResponse)
def list_invoices(tenant_id: str, session: Session = Depends(get_session)):
    tenant_id = require_tenant(tenant_id)
    invoices = (
        session.query(Invoice)
        .options(selectinload(Invoice.line_items))
        .filter_by(tenant_id=tenant_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return {"items": [serialize_invoice(invoice) for invoice in invoices]}


def serialize_invoice(invoice: Invoice) -> dict[str, Any]:
    learning_debug = getattr(invoice, "learning_debug", None)
    if isinstance(learning_debug, str):
        try:
            learning_debug = json.loads(learning_debug)
        except json.JSONDecodeError:
            learning_debug = None

    payload = InvoiceBase.model_validate(
        {
            "id": invoice.id,
            "tenant_id": invoice.tenant_id,
            "filename": invoice.filename,
            "vendor": invoice.vendor,
            "vendor_address": invoice.vendor_address,
            "vendor_contact": invoice.vendor_contact,
            "category": invoice.category,
            "subtotal": invoice.subtotal,
            "tax": invoice.tax,
            "total": invoice.total,
            "supplier_nif": invoice.supplier_nif,
            "customer_name": invoice.customer_name,
            "customer_nif": invoice.customer_nif,
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date,
            "due_date": invoice.due_date,
            "currency": invoice.currency,
            "raw_text": invoice.raw_text,
            "ai_payload": invoice.ai_payload,
            "extraction_model": invoice.extraction_model,
            "notes": invoice.notes,
            "line_items": invoice.line_items,
            "learning_debug": learning_debug,
            "status": invoice.status,
            "created_at": invoice.created_at,
        }
    ).model_dump(mode="json")
    return payload


@app.patch("/api/invoices/{invoice_id}", response_model=InvoiceBase)
def update_invoice(invoice_id: UUID, payload: InvoiceUpdateRequest, session: Session = Depends(get_session)):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")

    updates = payload.model_dump(exclude_unset=True)
    line_items_payload = updates.pop("line_items", None)
    for field, value in updates.items():
        setattr(invoice, field, value)

    if line_items_payload is not None:
        session.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice.id).delete()
        for index, item in enumerate(line_items_payload, start=1):
            session.add(
                InvoiceLineItem(
                    invoice_id=invoice.id,
                    position=index,
                    code=item.get("code"),
                    description=item.get("description"),
                    quantity=item.get("quantity"),
                    unit_price=item.get("unit_price"),
                    line_subtotal=item.get("line_subtotal"),
                    line_tax_amount=item.get("line_tax_amount"),
                    line_total=item.get("line_total"),
                    tax_rate=item.get("tax_rate"),
                )
            )

    session.add(invoice)
    upsert_vendor_profile(invoice, session)
    upsert_invoice_template(invoice, session)
    session.commit()
    session.refresh(invoice)
    invoice.line_items  # trigger lazy load for response
    return serialize_invoice(invoice)


@app.post("/api/tenants/{tenant_id}/ingest", response_model=IngestResponse)
def ingest_invoices(
    tenant_id: str,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    tenant_id = require_tenant(tenant_id)
    if not files:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um ficheiro")

    files_to_process: List[UploadFile] = []
    for upload in files:
        filename = (upload.filename or "").lower()
        if filename.endswith(".zip"):
            files_to_process.extend(expand_zip_upload(upload))
        else:
            files_to_process.append(upload)

    if not files_to_process:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um ficheiro")

    ingested_rows = []
    for upload in files_to_process:
        learning_debug = init_learning_debug()
        extraction = extract_invoice_data(upload)
        extraction = apply_template_to_extraction(extraction, tenant_id, session, debug=learning_debug)
        extraction = apply_tenant_defaults_to_extraction(extraction, tenant_id, session)
        invoice = Invoice(
            tenant_id=tenant_id,
            filename=upload.filename or "documento",
            vendor=extraction["vendor"],
            vendor_address=extraction.get("vendor_address"),
            vendor_contact=extraction.get("vendor_contact"),
            category=extraction["category"],
            subtotal=extraction["subtotal"],
            tax=extraction["tax"],
            total=extraction["total"],
            supplier_nif=extraction.get("supplier_nif"),
            customer_name=extraction.get("customer_name"),
            customer_nif=extraction.get("customer_nif"),
            invoice_number=extraction.get("invoice_number"),
            invoice_date=extraction.get("invoice_date"),
            due_date=extraction.get("due_date"),
            currency=extraction.get("currency"),
            raw_text=extraction.get("raw_text"),
            ai_payload=extraction.get("ai_payload"),
            extraction_model=extraction.get("extraction_model"),
            notes=extraction["notes"],
        )
        session.add(invoice)
        session.flush()

        for item in extraction.get("line_items", []):
            session.add(
                InvoiceLineItem(
                    invoice_id=invoice.id,
                    position=item.get("position") or len(invoice.line_items) + 1,
                    code=item.get("code"),
                    description=item.get("description"),
                    quantity=item.get("quantity"),
                    unit_price=item.get("unit_price"),
                    line_subtotal=item.get("line_subtotal"),
                    line_tax_amount=item.get("line_tax_amount"),
                    line_total=item.get("line_total"),
                    tax_rate=item.get("tax_rate"),
                )
            )

        if settings.debug_learning:
            invoice.learning_debug = json.dumps(learning_debug)
        session.flush()
        session.refresh(invoice)
        ingested_rows.append(invoice)

    session.commit()

    for invoice in ingested_rows:
        try:
            upsert_invoice_embedding(invoice)
        except Exception as exc:
            logger.warning("Falha ao guardar embedding da fatura %s: %s", invoice.id, exc)

    return {"ingested": [serialize_invoice(invoice) for invoice in ingested_rows]}


@app.post("/api/tenants/{tenant_id}/chat", response_model=ChatResponse)
def chat_with_invoices(tenant_id: str, payload: ChatRequest, session: Session = Depends(get_session)):
    tenant_id = require_tenant(tenant_id)
    hits = search_invoice_embeddings(payload.question, tenant_id=tenant_id, top_k=payload.top_k)
    if not hits:
        return ChatResponse(answer="Não encontrei dados suficientes para responder.", references=[])

    invoice_ids: list[UUID] = []
    for hit in hits:
        invoice_id = hit.payload.get("invoice_id") if hit.payload else None
        if invoice_id:
            try:
                invoice_ids.append(UUID(invoice_id))
            except ValueError:
                continue

    invoices: list[Invoice] = []
    if invoice_ids:
        invoices = (
            session.query(Invoice)
            .options(selectinload(Invoice.line_items))
            .filter(Invoice.id.in_(invoice_ids))
            .all()
        )
    invoice_map = {str(inv.id): inv for inv in invoices}

    contexts: list[str] = []
    references: list[dict[str, Any]] = []
    for hit in hits:
        payload_hit = hit.payload or {}
        invoice_id = payload_hit.get("invoice_id")
        invoice = invoice_map.get(invoice_id)
        if not invoice:
            continue
        contexts.append(format_invoice_context(invoice))
        references.append(
            {
                "invoice_id": invoice.id,
                "vendor": invoice.vendor,
                "invoice_number": invoice.invoice_number,
                "score": hit.score,
            }
        )

    if not contexts:
        return ChatResponse(answer="Não encontrei dados suficientes para responder.", references=[])

    answer = build_chat_answer(payload.question, contexts)
    return ChatResponse(answer=answer, references=references)


@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: UUID, session: Session = Depends(get_session)):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")

    session.delete(invoice)
    session.commit()
    return {"ok": True}


@app.post("/api/invoices/{invoice_id}/corrections", response_model=InvoiceBase)
def apply_invoice_correction(
    invoice_id: UUID,
    payload: InvoiceCorrectionRequest,
    session: Session = Depends(get_session),
):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    if not invoice.raw_text:
        raise HTTPException(status_code=400, detail="Fatura não tem texto bruto guardado")

    extraction = build_extraction_from_text(
        text=invoice.raw_text,
        file_name=invoice.filename,
        correction_message=payload.message,
        previous_payload=invoice.ai_payload,
    )
    extraction = apply_tenant_defaults_to_extraction(extraction, invoice.tenant_id, session)
    apply_extraction_to_invoice(invoice, extraction, session)
    invoice.status = "corrigido"
    upsert_vendor_profile(invoice, session)
    upsert_invoice_template(invoice, session)

    if settings.debug_learning:
        invoice.learning_debug = json.dumps(
            {
                **init_learning_debug(),
                "vendor_profile_applied": False,
                "invoice_template_applied": False,
            }
        )

    correction = InvoiceCorrection(
        invoice_id=invoice.id,
        message=payload.message.strip(),
        ai_payload=extraction.get("ai_payload"),
    )
    session.add(correction)
    session.commit()
    try:
        upsert_invoice_embedding(invoice)
    except Exception as exc:
        logger.warning("Falha ao atualizar embedding da fatura %s: %s", invoice.id, exc)
    session.refresh(invoice)
    return serialize_invoice(invoice)


@app.get("/api/invoices/{invoice_id}/corrections", response_model=InvoiceCorrectionListResponse)
def list_invoice_corrections(invoice_id: UUID, session: Session = Depends(get_session)):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    corrections = (
        session.query(InvoiceCorrection)
        .filter(InvoiceCorrection.invoice_id == invoice_id)
        .order_by(InvoiceCorrection.created_at.desc())
        .all()
    )
    return {"items": corrections}
