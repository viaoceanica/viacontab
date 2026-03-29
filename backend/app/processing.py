from __future__ import annotations

import base64
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, List

from openai import OpenAI
from pypdf import PdfReader
import fitz
from PIL import Image
import cv2
import numpy as np

from .config import get_settings

settings = get_settings()
_qr_detector = cv2.QRCodeDetector()


def _collapse_broken_words(value: str | None) -> str | None:
    if not value:
        return value
    tokens = value.split()
    new_tokens: list[str] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if len(token) == 1 and token.isalpha():
            j = i
            buffer: list[str] = []
            while j < len(tokens) and len(tokens[j]) == 1 and tokens[j].isalpha():
                buffer.append(tokens[j])
                j += 1
            next_token = tokens[j] if j < len(tokens) else None
            if len(buffer) == 1 and next_token and next_token.isalpha() and next_token.islower() and buffer[0].isupper():
                new_tokens.append(buffer[0] + next_token)
                i = j + 1
                continue
            if len(buffer) > 1:
                new_tokens.append("".join(buffer))
                i = j
                continue
            new_tokens.extend(buffer)
            i = j
            continue
        new_tokens.append(token)
        i += 1
    return " ".join(new_tokens)

CATEGORY_KEYWORDS = {
    "contabilidade": "servicos",
    "consultoria": "servicos",
    "software": "servicos",
    "combustivel": "combustivel",
    "gasoleo": "combustivel",
    "gasolina": "combustivel",
    "supermercado": "alimentacao",
    "restaurante": "alimentacao",
    "papelaria": "material_escritorio",
    "escritorio": "material_escritorio",
    "transporte": "transporte",
}


CAPS_BLOCK_PATTERN = re.compile(r"(?:[A-ZÀ-ÖØ-Ý]\s){2,}[A-ZÀ-ÖØ-Ý]")


def _collapse_spaced_caps(value: str) -> str:
    def repl(match: re.Match) -> str:
        return match.group(0).replace(" ", "")

    return CAPS_BLOCK_PATTERN.sub(repl, value)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _looks_like_scanned_pdf(text: str) -> bool:
    cleaned = _clean_text(text)
    if not cleaned:
        return True
    alnum_count = sum(char.isalnum() for char in cleaned)
    return len(cleaned) < 80 or alnum_count < 40


def _decode_qr_from_pil(image: Image.Image) -> str | None:
    try:
        rgb = image.convert("RGB")
        arr = np.array(rgb)
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        value, _, _ = _qr_detector.detectAndDecode(bgr)
    except Exception:
        return None
    return value or None


def _extract_qr_payload_from_pdf(raw: bytes) -> str | None:
    try:
        document = fitz.open(stream=raw, filetype="pdf")
    except Exception:
        return None
    for page_index in range(min(3, len(document))):
        page = document.load_page(page_index)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        mode = "RGB"
        image = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
        payload = _decode_qr_from_pil(image)
        if payload:
            return payload
    return None


def parse_portuguese_qr_payload(payload: str | None) -> dict[str, Any]:
    if not payload or "A:" not in payload:
        return {}
    result: dict[str, Any] = {"qr_payload": payload}
    parts = [part.strip() for part in payload.split("*") if ":" in part]
    fields: dict[str, str] = {}
    for part in parts:
        code, value = part.split(":", 1)
        fields[code.strip()] = value.strip()

    result["supplier_nif"] = fields.get("A") or None
    result["customer_nif"] = fields.get("B") or None
    result["document_type"] = fields.get("D") or None
    if fields.get("F") and len(fields["F"]) == 8:
        result["invoice_date"] = f"{fields['F'][0:4]}-{fields['F'][4:6]}-{fields['F'][6:8]}"
    if fields.get("G"):
        result["invoice_number"] = fields["G"]
    if fields.get("N"):
        result["tax"] = _to_decimal(fields["N"])
    if fields.get("O"):
        result["total"] = _to_decimal(fields["O"])
    if fields.get("P"):
        result["subtotal"] = _to_decimal(fields["P"])
    return result


def _extract_text_from_pdf_with_openai(raw: bytes, file_name: str) -> str:
    if not settings.openai_api_key:
        return ""

    client = OpenAI(api_key=settings.openai_api_key)
    data_url = f"data:application/pdf;base64,{base64.b64encode(raw).decode('ascii')}"
    prompt = (
        "Extract all readable text from this invoice PDF. "
        "Return plain text only, preserving key invoice identifiers, vendor/customer names, dates, totals, tax amounts, NIFs, "
        "and line items when visible. Do not summarize."
    )

    response = client.responses.create(
        model=settings.extraction_model,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_file", "filename": Path(file_name).name, "file_data": data_url},
                ],
            }
        ],
        max_output_tokens=4000,
    )
    return getattr(response, "output_text", "") or ""


def extract_text_from_upload(upload) -> str:
    filename = (upload.filename or "documento").lower()
    raw = upload.file.read()
    upload.file.seek(0)

    if filename.endswith(".pdf"):
        reader = PdfReader(upload.file)
        pages = [page.extract_text() or "" for page in reader.pages]
        upload.file.seek(0)
        text = "\n".join(pages)
        if _looks_like_scanned_pdf(text):
            try:
                text = _extract_text_from_pdf_with_openai(raw, upload.filename or "documento") or text
            except Exception:
                pass
    else:
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("latin-1", errors="ignore")

    text = text.replace("\x00", " ")
    text = _collapse_spaced_caps(text)
    return _clean_text(text)


def guess_category(text: str) -> str:
    lowered = text.lower()
    for keyword, category in CATEGORY_KEYWORDS.items():
        if keyword in lowered:
            return category
    return "servicos"


def _to_decimal(value: Any, quant: str = "0.01") -> Decimal | None:
    if value in (None, ""):
        return None
    if isinstance(value, Decimal):
        quant_value = Decimal(quant)
        return value.quantize(quant_value)
    if isinstance(value, (int, float, str)):
        try:
            normalized = str(value).replace("€", "").replace(" ", "").replace(",", ".")
            quant_value = Decimal(quant)
            return Decimal(normalized).quantize(quant_value)
        except (InvalidOperation, ValueError):
            return None
    return None


def _normalize_line_items(line_items: Any, fallback_description: str, subtotal: Decimal | None) -> List[dict[str, Any]]:
    normalized: List[dict[str, Any]] = []
    if isinstance(line_items, list):
        for idx, item in enumerate(line_items):
            if not isinstance(item, dict):
                continue
            description = item.get("description") if isinstance(item.get("description"), str) else None
            code = item.get("code") if isinstance(item.get("code"), str) else None
            normalized.append(
                {
                    "position": idx + 1,
                    "code": code.strip() if code else None,
                    "description": (description or fallback_description).strip(),
                    "quantity": _to_decimal(item.get("quantity")),
                    "unit_price": _to_decimal(item.get("unit_price")),
                    "line_subtotal": _to_decimal(item.get("subtotal")) or _to_decimal(item.get("line_subtotal")),
                    "line_tax_amount": _to_decimal(item.get("tax_amount")) or _to_decimal(item.get("line_tax_amount")),
                    "line_total": _to_decimal(item.get("total")) or _to_decimal(item.get("line_total")),
                    "tax_rate": _to_decimal(item.get("tax_rate"), quant="0.01"),
                }
            )

    if not normalized:
        normalized.append(
            {
                "position": 1,
                "code": None,
                "description": fallback_description,
                "quantity": Decimal("1.00") if subtotal else None,
                "unit_price": subtotal,
                "line_subtotal": subtotal,
                "line_tax_amount": None,
                "line_total": subtotal,
                "tax_rate": None,
            }
        )
    return normalized


def _normalize_for_search(value: str | None) -> str:
    if not value:
        return ""
    collapsed = _collapse_spaced_caps(value)
    return re.sub(r"\s+", " ", collapsed).lower().strip()


def _maybe_correct_parties(
    vendor: str,
    customer: str | None,
    supplier_nif: str | None,
    customer_nif: str | None,
    text: str,
    correction_message: str | None = None,
) -> tuple[str, str | None, str | None, str | None]:
    return vendor, customer, supplier_nif, customer_nif


def _extract_with_openai(
    text: str,
    file_name: str,
    correction_message: str | None = None,
    previous_payload: str | None = None,
) -> dict[str, Any]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY não configurada")

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = (
        "Extract accounting data from the invoice text below and return strict JSON only. "
        "Fields: vendor, supplier_nif, vendor_address, vendor_contact, customer_name, customer_nif, invoice_number, "
        "invoice_date, due_date, currency, subtotal, tax, total, notes, line_items. "
        "Vendor/supplier = the entity issuing the invoice (look near headers, IBAN, company info). "
        "Customer/adquirente = the entity addressed or labelled as Cliente/Exmo(s)/V/ Contribuinte. Never swap them. "
        "Layout heuristics: in most invoices the vendor/supplier issuer block is in the top-left header area; prefer that block when multiple companies are mentioned. "
        "Invoice number and invoice dates are often in the top-right or upper header metadata area. "
        "Customer/client usually appears in a separate bill-to / cliente / exmo(s) block, often top-right or below the header. "
        "Totals usually appear in the bottom-right summary area, while line items occupy the central table. "
        "Use footer, bank, payment, transport, and legal text as supporting evidence only unless they clearly identify the issuer. "
        "For invoices with item tables, extract every visible line item row from the article/service table, not just one summary line. "
        "Prefer rows under headers like Ref., Artigo, Designação, Qtd., Uni., Preço, Imposto, Total Líquido. Ignore summary/tax/payment rows unless they are actual invoice items. "
        "supplier_nif must belong to the vendor. line_items must be an array; each element requires code, description, quantity, unit_price, subtotal, tax_amount, total, tax_rate. "
        "Normalize whitespace so that words are not split (ex.: escreva \"Via Oceanica\" em vez de \"V ia O c e a n i c a\"). Use null for missing values. Keep notes curtas.\n\n"
        f"filename: {Path(file_name).name}\n"
        f"text: {text[:18000]}"
    )
    if correction_message:
        prompt += "\nCorrections requested: " + correction_message.strip() + "\n"
        if previous_payload:
            trimmed = previous_payload[:6000]
            prompt += "Previous JSON output:\n" + trimmed + "\n"
        prompt += (
            "Re-run the extraction applying the correction(s) while keeping all other correct values. "
            "Return full JSON again.\n"
        )

    response = client.responses.create(
        model=settings.extraction_model,
        input=prompt,
        max_output_tokens=700,
    )
    content = getattr(response, "output_text", "") or ""
    if not content:
        raise RuntimeError("Modelo não devolveu conteúdo")

    match = re.search(r"\{.*\}", content, re.S)
    payload = match.group(0) if match else content
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        repair_prompt = (
            "Convert the following malformed JSON-like invoice extraction into valid strict JSON only. "
            "Do not add commentary, markdown, or explanations. Preserve the same fields and values when possible.\n\n"
            f"{payload[:12000]}"
        )
        repair_response = client.responses.create(
            model=settings.extraction_model,
            input=repair_prompt,
            max_output_tokens=900,
        )
        repaired = getattr(repair_response, "output_text", "") or ""
        repaired_match = re.search(r"\{.*\}", repaired, re.S)
        repaired_payload = repaired_match.group(0) if repaired_match else repaired
        data = json.loads(repaired_payload)
    data["notes"] = data.get("notes") or f"Documento processado por IA: {Path(file_name).name}"
    return data


def extract_invoice_data(upload: UploadFile) -> dict[str, Any]:
    text = extract_text_from_upload(upload)
    raw = upload.file.read()
    upload.file.seek(0)
    qr_payload = None
    filename = (upload.filename or "documento").lower()
    if filename.endswith(".pdf"):
        qr_payload = _extract_qr_payload_from_pdf(raw)
    extraction = build_extraction_from_text(text=text, file_name=upload.filename or "documento")
    qr_data = parse_portuguese_qr_payload(qr_payload)
    if qr_data:
        for field in ["supplier_nif", "invoice_number", "invoice_date", "subtotal", "tax", "total"]:
            if qr_data.get(field) not in (None, ""):
                extraction[field] = qr_data[field]
        extraction["notes"] = (extraction.get("notes") or "") + " | QR português detetado"
        extraction["qr_payload"] = qr_payload
    return extraction


def _is_swap_parties_correction(correction_message: str | None) -> bool:
    correction_norm = _normalize_for_search(correction_message)
    if not correction_norm:
        return False
    return (
        ("swap" in correction_norm or "troca" in correction_norm or "invert" in correction_norm or "ao contrario" in correction_norm or "ao contrário" in correction_norm)
        and ("vendor" in correction_norm or "fornecedor" in correction_norm)
        and ("client" in correction_norm or "cliente" in correction_norm or "customer" in correction_norm)
    )


def _extract_nif_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    for match in re.finditer(r"(?:PT\s*)?(\d{9})", text, re.I):
        value = match.group(1)
        if value not in candidates:
            candidates.append(value)
    return candidates


def _extract_due_date_from_text(text: str) -> str | None:
    patterns = [
        r"data\s+de\s+vencimento\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})",
        r"vencimento\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})",
        r"vencimento\s+em\s*[:\-]?\s*(\d{2}/\d{2}/\d{4})",
    ]
    lowered = text.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered, re.I)
        if match:
            return match.group(1)
    return None


def _apply_deterministic_corrections(result: dict[str, Any], text: str, correction_message: str | None) -> dict[str, Any]:
    if not correction_message:
        return result

    message = correction_message.strip()
    lowered = message.lower()

    def mentions_invalid(field_aliases: list[str]) -> bool:
        return any(alias in lowered for alias in field_aliases) and any(
            token in lowered for token in ["incorrect", "incorreto", "errado", "invalid", "invalido", "inválido", "wrong"]
        )

    if _is_swap_parties_correction(correction_message):
        result["vendor"], result["customer_name"] = result.get("customer_name") or result.get("vendor"), result.get("vendor")
        result["supplier_nif"], result["customer_nif"] = result.get("customer_nif"), result.get("supplier_nif")

    vendor_match = re.search(r"(?:nome\s+do\s+)?fornecedor\s+(?:eh|é|e)\s+([^,\.]+)", message, re.I)
    if vendor_match:
        candidate = vendor_match.group(1).strip()
        if len(candidate.split()) <= 8:
            result["vendor"] = candidate

    customer_match = re.search(r"(?:nome\s+do\s+)?cliente\s+(?:eh|é|e)\s+([^,\.]+)", message, re.I)
    if customer_match:
        candidate = customer_match.group(1).strip()
        if len(candidate.split()) <= 8:
            result["customer_name"] = candidate

    if ("data de vencimento" in lowered or "vencimento" in lowered) and ("em branco" in lowered or "falta" in lowered):
        due_date = _extract_due_date_from_text(text)
        if due_date:
            result["due_date"] = due_date

    invalid_customer_markers = {
        "EXMO(S)",
        "EXMO (S)",
        "EXMO(S) SR (S)",
        "EXMO(S) SENHOR(ES)",
        "CLIENTE",
    }
    customer_name = str(result.get("customer_name") or "").strip().upper()
    if customer_name in invalid_customer_markers:
        result["customer_name"] = None

    if "nif do fornecedor" in lowered and ("falta" in lowered or "em falta" in lowered or "missing" in lowered):
        candidates = _extract_nif_candidates(text)
        current_customer_nif = re.sub(r"\D+", "", str(result.get("customer_nif") or "")) or None
        for candidate in candidates:
            if candidate != current_customer_nif:
                result["supplier_nif"] = candidate
                break

    if mentions_invalid(["nif fornecedor", "nif do fornecedor", "supplier nif", "supplier_nif"]):
        result["supplier_nif"] = None

    if mentions_invalid(["nif cliente", "nif do cliente", "customer nif", "customer_nif"]):
        result["customer_nif"] = None

    if mentions_invalid(["data vencimento", "data de vencimento", "due date", "due_date"]):
        result["due_date"] = None

    return result


def build_extraction_from_text(
    text: str,
    file_name: str,
    *,
    correction_message: str | None = None,
    previous_payload: str | None = None,
) -> dict[str, Any]:
    ai_data = _extract_with_openai(
        text=text,
        file_name=file_name,
        correction_message=correction_message,
        previous_payload=previous_payload,
    )
    vendor = ai_data.get("vendor") or Path(file_name).stem
    vendor_address = ai_data.get("vendor_address")
    vendor_contact = ai_data.get("vendor_contact")
    customer_name = ai_data.get("customer_name")
    supplier_nif = ai_data.get("supplier_nif")
    customer_nif = ai_data.get("customer_nif")

    if isinstance(vendor_address, list):
        vendor_address = ", ".join([str(part) for part in vendor_address if part])
    if isinstance(vendor_contact, dict):
        vendor_contact = ", ".join([f"{key}: {value}" for key, value in vendor_contact.items() if value])
    elif isinstance(vendor_contact, list):
        vendor_contact = ", ".join([str(part) for part in vendor_contact if part])

    vendor, customer_name, supplier_nif, customer_nif = _maybe_correct_parties(
        vendor,
        customer_name,
        supplier_nif,
        customer_nif,
        text,
        correction_message=correction_message,
    )

    if _is_swap_parties_correction(correction_message):
        vendor, customer_name = customer_name or vendor, vendor
        supplier_nif, customer_nif = customer_nif, supplier_nif

    category = guess_category(f"{vendor} {text} {ai_data.get('notes', '')}")

    subtotal = _to_decimal(ai_data.get("subtotal"))

    result = {
        "vendor": vendor,
        "vendor_address": vendor_address,
        "vendor_contact": vendor_contact,
        "category": category,
        "subtotal": subtotal,
        "tax": _to_decimal(ai_data.get("tax")),
        "total": _to_decimal(ai_data.get("total")),
        "supplier_nif": supplier_nif,
        "customer_name": customer_name,
        "customer_nif": customer_nif,
        "invoice_number": ai_data.get("invoice_number"),
        "invoice_date": ai_data.get("invoice_date"),
        "due_date": ai_data.get("due_date"),
        "currency": ai_data.get("currency") or "EUR",
        "raw_text": text,
        "ai_payload": json.dumps(ai_data, ensure_ascii=False),
        "extraction_model": settings.extraction_model,
        "notes": ai_data.get("notes") or f"Documento processado por IA: {file_name}",
        "line_items": _normalize_line_items(
            ai_data.get("line_items"),
            fallback_description=vendor or file_name,
            subtotal=subtotal,
        ),
    }

    result = _apply_deterministic_corrections(result, text=text, correction_message=correction_message)

    for field in ("vendor", "vendor_address", "vendor_contact", "customer_name", "notes"):
        result[field] = _collapse_broken_words(result.get(field))

    for item in result["line_items"]:
        item["description"] = _collapse_broken_words(item.get("description"))

    return result
