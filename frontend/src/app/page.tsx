"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface InvoiceCorrection {
  id: string;
  message: string;
  created_at: string;
}

interface ChatReference {
  invoice_id: string;
  vendor?: string | null;
  invoice_number?: string | null;
  score?: number | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: ChatReference[];
}

interface InvoiceLineItem {
  id: string;
  code?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  line_subtotal?: number | string | null;
  line_tax_amount?: number | string | null;
  line_total?: number | string | null;
  tax_rate?: number | string | null;
  tax_rate_source?: string | null;
  review_reason?: string | null;
}

interface EditableInvoiceLineItem {
  id?: string;
  code: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_subtotal: string;
  line_tax_amount: string;
  line_total: string;
  tax_rate: string;
}

interface TenantProfile {
  company_name?: string | null;
  company_nif?: string | null;
}

interface WatchtowerTask {
  task_id: string;
  tenant_id: string;
  filename: string;
  stage: string;
  started_at: string;
  updated_at: string;
  status: string;
  reason?: string | null;
  duration_seconds: number;
  stuck?: boolean;
}

interface FailedImportRow {
  id: string;
  tenant_id: string;
  filename: string;
  mime_type?: string | null;
  file_size?: number | null;
  reason: string;
  detected_type?: string | null;
  source: string;
  retry_count: number;
  last_retry_at?: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  tenant_id: string;
  filename: string;
  vendor?: string | null;
  vendor_address?: string | null;
  vendor_contact?: string | null;
  category?: string | null;
  subtotal?: number | string | null;
  tax?: number | string | null;
  total?: number | string | null;
  currency?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  supplier_nif?: string | null;
  customer_name?: string | null;
  customer_nif?: string | null;
  token_input?: number | null;
  token_output?: number | null;
  token_total?: number | null;
  confidence_score?: number | string | null;
  requires_review?: boolean;
  notes?: string | null;
  line_items?: InvoiceLineItem[];
  status: string;
  created_at: string;
}

interface ReviewLineItem {
  invoice_id: string;
  invoice_number?: string | null;
  vendor?: string | null;
  filename: string;
  created_at: string;
  line_item_id: string;
  position?: number | string | null;
  description?: string | null;
  line_total?: number | string | null;
  tax_rate?: number | string | null;
  tax_rate_source?: string | null;
  normalization_confidence?: number | string | null;
  review_reason?: string | null;
}

interface AutomationBlocker {
  invoice_id: string;
  invoice_number?: string | null;
  filename: string;
  vendor?: string | null;
  code: string;
  severity: string;
  message: string;
  created_at: string;
}

const makeMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const createEmptyLineItem = (): EditableInvoiceLineItem => ({
  code: "",
  description: "",
  quantity: "",
  unit_price: "",
  line_subtotal: "",
  line_tax_amount: "",
  line_total: "",
  tax_rate: "",
});

function toEditableLineItem(item: InvoiceLineItem): EditableInvoiceLineItem {
  return {
    id: item.id,
    code: item.code ?? "",
    description: item.description ?? "",
    quantity: toPtNumberString(item.quantity),
    unit_price: toPtNumberString(item.unit_price),
    line_subtotal: toPtNumberString(item.line_subtotal),
    line_tax_amount: toPtNumberString(item.line_tax_amount),
    line_total: toPtNumberString(item.line_total),
    tax_rate: toPtNumberString(item.tax_rate),
  };
}

function formatMoney(value: number | string | null | undefined, currency = "EUR") {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return num.toFixed(2);
  }
}

function formatQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return Math.abs(num % 1) < 1e-6 ? num.toFixed(0) : num.toFixed(2);
}

function toPtNumberString(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(num);
}

function parsePtNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function toPtDate(value: string | null | undefined) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTaxRateSource(source?: string | null) {
  if (!source) return null;
  if (source === "extracted") return "extraído";
  if (source === "calculated_line") return "calc. linha";
  if (source === "calculated_invoice") return "calc. fatura";
  return source;
}

function toIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  const dash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dash) return `${dash[3]}-${dash[2]}-${dash[1]}`;
  return trimmed;
}

async function parseResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(raw);
  }
}

export default function Home() {
  const [tenantId, setTenantId] = useState("demo");
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState("Pronto para processar.");
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [failedImports, setFailedImports] = useState<FailedImportRow[]>([]);
  const [reviewLineItems, setReviewLineItems] = useState<ReviewLineItem[]>([]);
  const [automationBlockers, setAutomationBlockers] = useState<AutomationBlocker[]>([]);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile>({ company_name: "", company_nif: "" });
  const [isSavingTenantProfile, setIsSavingTenantProfile] = useState(false);
  const [watchtower, setWatchtower] = useState<{ active: WatchtowerTask[]; recent: WatchtowerTask[] }>({ active: [], recent: [] });
  const [editForm, setEditForm] = useState({
    vendor: "",
    vendor_address: "",
    vendor_contact: "",
    category: "",
    subtotal: "",
    tax: "",
    total: "",
    supplier_nif: "",
    customer_name: "",
    customer_nif: "",
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    currency: "",
    notes: "",
  });
  const [editLineItems, setEditLineItems] = useState<EditableInvoiceLineItem[]>([]);
  const [corrections, setCorrections] = useState<InvoiceCorrection[]>([]);
  const [correctionText, setCorrectionText] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionStatus, setCorrectionStatus] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const apiBase = API_BASE;

  const cardStyle = {
    background: "white",
    borderRadius: 24,
    padding: 20,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 25px 60px rgba(15, 23, 42, 0.15)",
  } as const;
  const detailValueStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    background: "#f8fafc",
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    lineHeight: 1.35,
  } as const;

  const [uploadProgress, setUploadProgress] = useState(0);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
      }
    };
  }, []);

  const fetchTenantProfile = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/profile`);
      const data = await parseResponse(response);
      setTenantProfile({
        company_name: data.company_name ?? "",
        company_nif: data.company_nif ?? "",
      });
    } catch (error) {
      console.error(error);
    }
  }, [tenantId, apiBase]);

  const fetchInvoices = useCallback(async () => {
    if (!tenantId) return [] as Invoice[];
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/invoices`);
      const data = await parseResponse(response);
      const items = data.items ?? [];
      setRows(items);
      return items;
    } catch (error) {
      console.error(error);
      return [] as Invoice[];
    }
  }, [tenantId, apiBase]);

  const fetchFailedImports = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/failed-imports`);
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao obter falhas de importação");
      }
      setFailedImports(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setFailedImports([]);
    }
  }, [tenantId, apiBase]);

  const fetchReviewLineItems = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/line-items/review`);
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao obter linhas para revisão");
      }
      setReviewLineItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setReviewLineItems([]);
    }
  }, [tenantId, apiBase]);

  const fetchAutomationBlockers = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/automation-blockers`);
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao obter bloqueios de automação");
      }
      setAutomationBlockers(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setAutomationBlockers([]);
    }
  }, [tenantId, apiBase]);

  const fetchWatchtower = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/watchtower/uploads`);
      const data = await parseResponse(response);
      if (!response.ok) return;
      setWatchtower({
        active: Array.isArray(data?.active) ? data.active : [],
        recent: Array.isArray(data?.recent) ? data.recent : [],
      });
    } catch (error) {
      console.error(error);
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchInvoices();
    void fetchFailedImports();
    void fetchReviewLineItems();
    void fetchAutomationBlockers();
    void fetchTenantProfile();
    void fetchWatchtower();
  }, [fetchInvoices, fetchFailedImports, fetchReviewLineItems, fetchAutomationBlockers, fetchTenantProfile, fetchWatchtower]);

  useEffect(() => {
    if (!isLoading) return;
    const intervalId = window.setInterval(() => {
      void fetchWatchtower();
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [isLoading, fetchWatchtower]);

  const fetchCorrections = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`${apiBase}/api/invoices/${invoiceId}/corrections`);
      const data = await parseResponse(response);
      setCorrections(data.items ?? []);
    } catch (error) {
      console.error(error);
      setCorrections([]);
    }
  }, [apiBase]);

  const populateDetailEditor = useCallback((invoice: Invoice) => {
    setDetailInvoice(invoice);
    setEditForm({
      vendor: invoice.vendor ?? "",
      vendor_address: invoice.vendor_address ?? "",
      vendor_contact: invoice.vendor_contact ?? "",
      category: invoice.category ?? "",
      subtotal: toPtNumberString(invoice.subtotal),
      tax: toPtNumberString(invoice.tax),
      total: toPtNumberString(invoice.total),
      supplier_nif: invoice.supplier_nif ?? "",
      customer_name: invoice.customer_name ?? "",
      customer_nif: invoice.customer_nif ?? "",
      invoice_number: invoice.invoice_number ?? "",
      invoice_date: toPtDate(invoice.invoice_date),
      due_date: toPtDate(invoice.due_date),
      currency: invoice.currency ?? "",
      notes: invoice.notes ?? "",
    });
    setEditLineItems((invoice.line_items ?? []).map(toEditableLineItem));
  }, []);

  const resetDetailEditor = useCallback(() => {
    setDetailInvoice(null);
    setEditForm({
      vendor: "",
      vendor_address: "",
      vendor_contact: "",
      category: "",
      subtotal: "",
      tax: "",
      total: "",
      supplier_nif: "",
      customer_name: "",
      customer_nif: "",
      invoice_number: "",
      invoice_date: "",
      due_date: "",
      currency: "",
      notes: "",
    });
    setEditLineItems([]);
  }, []);

  const handleTenantProfileChange = useCallback((field: keyof TenantProfile, value: string) => {
    setTenantProfile((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveTenantProfile = useCallback(async () => {
    setIsSavingTenantProfile(true);
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantProfile),
      });
      const data = await parseResponse(response);
      setTenantProfile({
        company_name: data.company_name ?? "",
        company_nif: data.company_nif ?? "",
      });
      setStatus("Perfil do tenant guardado.");
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar o perfil do tenant.");
    } finally {
      setIsSavingTenantProfile(false);
    }
  }, [apiBase, tenantId, tenantProfile]);

  const handleEditChange = useCallback((field: keyof typeof editForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleEditLineItemChange = useCallback((index: number, field: keyof EditableInvoiceLineItem, value: string) => {
    setEditLineItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }, []);

  const handleAddLineItem = useCallback(() => {
    setEditLineItems((prev) => [...prev, createEmptyLineItem()]);
  }, []);

  const handleRemoveLineItem = useCallback((index: number) => {
    setEditLineItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const openDetails = useCallback((invoice: Invoice) => {
    populateDetailEditor(invoice);
    void fetchCorrections(invoice.id);
  }, [fetchCorrections, populateDetailEditor]);

  const closeDetails = useCallback(() => {
    resetDetailEditor();
    setCorrections([]);
    setCorrectionText("");
    setCorrectionStatus("");
  }, [resetDetailEditor]);

  const handleSaveEdit = useCallback(async () => {
    if (!detailInvoice) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        ...editForm,
        subtotal: parsePtNumber(editForm.subtotal),
        tax: parsePtNumber(editForm.tax),
        total: parsePtNumber(editForm.total),
        invoice_date: toIsoDate(editForm.invoice_date),
        due_date: toIsoDate(editForm.due_date),
        line_items: editLineItems
          .filter((item) => Object.values(item).some((value) => (value ?? "").toString().trim() !== ""))
          .map((item) => ({
            id: item.id,
            code: item.code.trim() || null,
            description: item.description.trim() || null,
            quantity: parsePtNumber(item.quantity),
            unit_price: parsePtNumber(item.unit_price),
            line_subtotal: parsePtNumber(item.line_subtotal),
            line_tax_amount: parsePtNumber(item.line_tax_amount),
            line_total: parsePtNumber(item.line_total),
            tax_rate: parsePtNumber(item.tax_rate),
          })),
      };
      const response = await fetch(`${apiBase}/api/invoices/${detailInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao atualizar");
      }
      setStatus("Fatura atualizada.");
      setDetailInvoice(data);
      await fetchInvoices();
      await fetchReviewLineItems();
      await fetchAutomationBlockers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao atualizar");
    } finally {
      setIsSavingEdit(false);
    }
  }, [detailInvoice, editForm, editLineItems, fetchInvoices, fetchReviewLineItems, fetchAutomationBlockers, apiBase]);

  const handleSubmitCorrection = useCallback(async () => {
    if (!detailInvoice) return;
    const message = correctionText.trim();
    if (!message) return;
    setIsSubmittingCorrection(true);
    setCorrectionStatus("A reprocessar a fatura…");
    try {
      const response = await fetch(`${apiBase}/api/invoices/${detailInvoice.id}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao corrigir");
      }
      setRows((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      setDetailInvoice(data);
      populateDetailEditor(data);
      setCorrectionText("");
      setCorrectionStatus("Correção aplicada com sucesso.");
      await fetchCorrections(data.id);
      const refreshedRows = await fetchInvoices();
      await fetchReviewLineItems();
      await fetchAutomationBlockers();
      const refreshedInvoice = refreshedRows.find((row: Invoice) => row.id === data.id);
      if (refreshedInvoice) {
        setDetailInvoice(refreshedInvoice);
        populateDetailEditor(refreshedInvoice);
      }
    } catch (error) {
      setCorrectionStatus(error instanceof Error ? error.message : "Falha ao corrigir");
    } finally {
      setIsSubmittingCorrection(false);
    }
  }, [detailInvoice, correctionText, fetchCorrections, fetchInvoices, fetchReviewLineItems, fetchAutomationBlockers, apiBase, populateDetailEditor]);

  const handleSendChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: makeMessageId(), role: "user", text: trimmed };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatError("");
    setIsChatLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao obter resposta");
      }
      const assistantMessage: ChatMessage = {
        id: makeMessageId(),
        role: "assistant",
        text: data?.answer ?? "Sem resposta",
        references: data?.references ?? [],
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao obter resposta";
      setChatError(message);
      setChatHistory((prev) => [...prev, { id: makeMessageId(), role: "assistant", text: message }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, apiBase, tenantId]);

  const handleDelete = useCallback(
    async (invoice: Invoice) => {
      if (!window.confirm("Apagar esta fatura?")) return;
      try {
        const response = await fetch(`${apiBase}/api/invoices/${invoice.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = await parseResponse(response);
          throw new Error(data?.detail || "Falha ao remover");
        }
        if (detailInvoice?.id === invoice.id) {
          closeDetails();
        }
        if (detailInvoice?.id === invoice.id) {
          closeDetails();
        }
        setStatus("Fatura removida.");
        await fetchInvoices();
        await fetchReviewLineItems();
        await fetchAutomationBlockers();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Falha ao remover");
      }
    },
    [detailInvoice, closeDetails, fetchInvoices, fetchReviewLineItems, fetchAutomationBlockers]
  );

  const handleRetryFailedImport = useCallback(async (row: FailedImportRow) => {
    try {
      setStatus(`A tentar novamente: ${row.filename}…`);
      const response = await fetch(`${apiBase}/api/failed-imports/${row.id}/retry`, { method: "POST" });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao repetir importação");
      }
      if (data?.ok && data?.ingested) {
        setStatus(`Retry concluído com sucesso: ${row.filename}`);
      } else {
        setStatus(data?.rejected?.reason || `Retry falhou: ${row.filename}`);
      }
      await fetchInvoices();
      await fetchFailedImports();
      await fetchReviewLineItems();
      await fetchAutomationBlockers();
      await fetchAutomationBlockers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao repetir importação");
    }
  }, [apiBase, fetchInvoices, fetchFailedImports, fetchReviewLineItems, fetchAutomationBlockers]);

  const handleDeleteFailedImport = useCallback(async (row: FailedImportRow) => {
    if (!window.confirm("Remover esta falha da lista?")) return;
    try {
      const response = await fetch(`${apiBase}/api/failed-imports/${row.id}`, { method: "DELETE" });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao apagar falha de importação");
      }
      setStatus(`Falha removida: ${row.filename}`);
      await fetchFailedImports();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao apagar falha de importação");
    }
  }, [apiBase, fetchFailedImports]);

  const openInvoiceById = useCallback(async (invoiceId: string) => {
    let target = rows.find((invoice) => invoice.id === invoiceId);
    if (!target) {
      const refreshed = await fetchInvoices();
      target = refreshed.find((invoice: Invoice) => invoice.id === invoiceId);
    }
    if (!target) {
      setStatus("Não foi possível abrir a fatura da linha selecionada.");
      return;
    }
    openDetails(target);
  }, [rows, fetchInvoices, openDetails]);

  const handleOpenReviewInvoice = useCallback(async (row: ReviewLineItem) => {
    await openInvoiceById(row.invoice_id);
  }, [openInvoiceById]);

  const handleLabelDraftChange = useCallback((lineItemId: string, value: string) => {
    setLabelDrafts((prev) => ({ ...prev, [lineItemId]: value }));
  }, []);

  const handleSaveLineLabel = useCallback(async (row: ReviewLineItem) => {
    const canonicalName = (labelDrafts[row.line_item_id] ?? row.description ?? "").trim();
    if (!canonicalName) {
      setStatus("Defina um nome canónico antes de gravar.");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/line-items/${row.line_item_id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_name: canonicalName }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao gravar mapeamento");
      }
      setStatus(`Mapeamento guardado: ${canonicalName}`);
      await fetchReviewLineItems();
      await fetchInvoices();
      await fetchAutomationBlockers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gravar mapeamento");
    }
  }, [labelDrafts, apiBase, tenantId, fetchReviewLineItems, fetchInvoices, fetchAutomationBlockers]);

  const handleSaveLineLabelBulk = useCallback(async (row: ReviewLineItem) => {
    const canonicalName = (labelDrafts[row.line_item_id] ?? row.description ?? "").trim();
    if (!canonicalName) {
      setStatus("Defina um nome canónico antes de gravar.");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/line-items/${row.line_item_id}/label-bulk?scope=vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_name: canonicalName }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao gravar mapeamento em lote");
      }
      setStatus(`Mapeamento guardado em lote: ${canonicalName} (${data?.updated_count ?? 1} linha(s) atualizada(s))`);
      await fetchReviewLineItems();
      await fetchInvoices();
      await fetchAutomationBlockers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gravar mapeamento em lote");
    }
  }, [labelDrafts, apiBase, tenantId, fetchReviewLineItems, fetchInvoices, fetchAutomationBlockers]);

  const handleUpload = useCallback(async () => {
    if (!tenantId) {
      setStatus("Indique um tenant.");
      return;
    }
    if (!files || files.length === 0) {
      setStatus("Selecione ficheiros.");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    setIsLoading(true);
    setStatus("A processar…");
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
    }
    setUploadProgress(5);
    progressTimer.current = window.setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 5));
    }, 400);

    try {
      const response = await fetch(`${apiBase}/api/tenants/${tenantId}/ingest`, {
        method: "POST",
        body: formData,
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.detail || "Falha ao processar");
      }
      const ingestedCount = data?.ingested?.length ?? 0;
      const rejectedCount = data?.rejected?.length ?? 0;
      setStatus(`Processados ${ingestedCount} documentos${rejectedCount ? ` · ${rejectedCount} com falha` : ""}.`);
      setFiles(null);
      await fetchInvoices();
      await fetchFailedImports();
    } catch (error) {
      if (error instanceof TypeError) {
        setStatus("Falha de ligação ao servidor durante o upload. Possíveis causas: backend reiniciado, timeout, ou ZIP demasiado grande.");
      } else {
        setStatus(error instanceof Error ? error.message : "Falha ao processar");
      }
    } finally {
      setIsLoading(false);
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setUploadProgress((prev) => (prev === 0 ? 0 : 100));
      window.setTimeout(() => setUploadProgress(0), 600);
    }
  }, [tenantId, files, fetchInvoices, fetchFailedImports, fetchReviewLineItems, fetchAutomationBlockers]);

  const tableRows = useMemo(() => {
    const ranked = rows.map((row) => {
      const currency = row.currency ?? "EUR";
      return {
        ...row,
        currency,
        subtotalFmt: formatMoney(row.subtotal, currency),
        taxFmt: formatMoney(row.tax, currency),
        totalFmt: formatMoney(row.total, currency),
        tokenFmt: row.token_total ? Number(row.token_total).toLocaleString("pt-PT") : "—",
        confidenceValue:
          row.confidence_score === null || row.confidence_score === undefined || row.confidence_score === ""
            ? null
            : Number(row.confidence_score),
        confidenceFmt:
          row.confidence_score === null || row.confidence_score === undefined || row.confidence_score === ""
            ? "—"
            : `${Number(row.confidence_score).toFixed(2)}%`,
        statusLabel: row.status === "requere revisao" ? "requere revisão" : row.status,
        createdFmt: new Date(row.created_at).toLocaleString("pt-PT"),
      };
    });

    const statusRank = (status: string | null | undefined, requiresReview: boolean | null | undefined) => {
      const normalized = (status || "").toLowerCase();
      if (normalized.includes("reject") || normalized.includes("timeout") || normalized.includes("error")) return 0;
      if (requiresReview || normalized.includes("revisao") || normalized.includes("review")) return 1;
      return 2;
    };

    return ranked.sort((a, b) => {
      const diff = statusRank(a.status, a.requires_review) - statusRank(b.status, b.requires_review);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1d4ed8)", padding: 24 }}>
      <main style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <p style={{ color: "#cbd5f5", textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>ViaContab · Via Oceânica</p>
            <h1 style={{ margin: "6px 0", color: "#ffffff", fontSize: 32 }}>Módulo contabilístico inteligente</h1>
            <p style={{ color: "#bfdbfe", maxWidth: 640 }}>Carregue faturas, processe-as com IA e acompanhe despesas num só lugar.</p>
          </div>
          <img src="https://pub-a13384e123be4d79b99448c764b9dec0.r2.dev/site-assets/logo-viaoceanica.webp" alt="Via Oceânica" style={{ height: 60 }} />
        </header>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 2.8fr) minmax(320px, 1fr)" }}
>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ ...cardStyle }}>
              <div style={{ marginBottom: 20, padding: 16, border: "1px solid #dbeafe", borderRadius: 16, background: "#f8fbff" }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Dados da empresa do tenant</h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Nome da empresa
                    <input
                      value={tenantProfile.company_name ?? ""}
                      onChange={(event) => handleTenantProfileChange("company_name", event.target.value)}
                      style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    NIF da empresa
                    <input
                      value={tenantProfile.company_nif ?? ""}
                      onChange={(event) => handleTenantProfileChange("company_nif", event.target.value)}
                      style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => void handleSaveTenantProfile()}
                    disabled={isSavingTenantProfile}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "none", background: "#2563eb", color: "white", fontWeight: 600 }}
                  >
                    {isSavingTenantProfile ? "A guardar…" : "Guardar dados do tenant"}
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Tenant</label>
                  <input
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    placeholder="ex: demo"
                    style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5f5" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Documentos</label>
                  <input
                    type="file"
                    multiple
                    onChange={(event) => setFiles(event.target.files)}
                    style={{ width: "100%" }}
                  />
                  <button
                    onClick={() => void handleUpload()}
                    disabled={isLoading}
                    style={{ marginTop: 12, padding: "10px 14px", border: "none", borderRadius: 12, background: "#2563eb", color: "white", fontWeight: 600 }}
                  >
                    {isLoading ? "A processar…" : "Processar faturas"}
                  </button>
                  <div style={{ marginTop: 8, color: "#475569", fontSize: 14 }}>{status}</div>
                  {uploadProgress > 0 && (
                    <div style={{ marginTop: 8, height: 6, borderRadius: 9999, background: "#e2e8f0" }}>
                      <div
                        style={{
                          width: `${uploadProgress}%`,
                          height: "100%",
                          borderRadius: 9999,
                          background: "linear-gradient(90deg, #38bdf8, #2563eb)",
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Atualizar tabela</label>
                  <button
                    onClick={() => void fetchInvoices()}
                    style={{ padding: "10px 14px", border: "1px solid #cbd5f5", borderRadius: 12, background: "#f8fafc", fontWeight: 600 }}
                  >
                    Recarregar dados
                  </button>
                  <button
                    onClick={() => void fetchWatchtower()}
                    style={{ marginLeft: 8, padding: "10px 14px", border: "1px solid #cbd5f5", borderRadius: 12, background: "#f8fafc", fontWeight: 600 }}
                  >
                    Watchtower
                  </button>
                  <button
                    onClick={() => void fetchFailedImports()}
                    style={{ marginLeft: 8, padding: "10px 14px", border: "1px solid #cbd5f5", borderRadius: 12, background: "#f8fafc", fontWeight: 600 }}
                  >
                    Falhas ({failedImports.length})
                  </button>
                  <button
                    onClick={() => void fetchReviewLineItems()}
                    style={{ marginLeft: 8, padding: "10px 14px", border: "1px solid #cbd5f5", borderRadius: 12, background: "#f8fafc", fontWeight: 600 }}
                  >
                    Linhas ({reviewLineItems.length})
                  </button>
                  <button
                    onClick={() => void fetchAutomationBlockers()}
                    style={{ marginLeft: 8, padding: "10px 14px", border: "1px solid #cbd5f5", borderRadius: 12, background: "#f8fafc", fontWeight: 600 }}
                  >
                    Bloqueios ({automationBlockers.length})
                  </button>

                  <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
                    Ativos: <strong>{watchtower.active.length}</strong>
                  </div>
                  {watchtower.active.length > 0 ? (
                    <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {watchtower.active.map((task) => (
                        <div key={task.task_id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: task.stuck ? "#fff7ed" : "#f8fafc" }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{task.filename}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>
                            {task.stage} · {task.duration_seconds}s {task.stuck ? "· ⚠️" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {watchtower.recent.length > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                      Último: {watchtower.recent[0].filename} · {watchtower.recent[0].status}
                      {watchtower.recent[0].reason ? ` · ${watchtower.recent[0].reason}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {false && (
              <section style={{ ...cardStyle }}>
                <h3 style={{ marginTop: 0 }}>Editar fatura</h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Fornecedor
                    <input value={editForm.vendor} onChange={(event) => handleEditChange("vendor", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Morada fornecedor
                    <textarea value={editForm.vendor_address} onChange={(event) => handleEditChange("vendor_address", event.target.value)} rows={2} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Contacto fornecedor
                    <input value={editForm.vendor_contact} onChange={(event) => handleEditChange("vendor_contact", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Categoria
                    <input value={editForm.category} onChange={(event) => handleEditChange("category", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Número da fatura
                    <input value={editForm.invoice_number} onChange={(event) => handleEditChange("invoice_number", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Data da fatura
                    <input value={editForm.invoice_date} onChange={(event) => handleEditChange("invoice_date", event.target.value)} placeholder="DD/MM/YYYY" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Data de vencimento
                    <input value={editForm.due_date} onChange={(event) => handleEditChange("due_date", event.target.value)} placeholder="DD/MM/YYYY" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Moeda
                    <input value={editForm.currency} onChange={(event) => handleEditChange("currency", event.target.value)} placeholder="EUR" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Subtotal
                    <input value={editForm.subtotal} onChange={(event) => handleEditChange("subtotal", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    IVA
                    <input value={editForm.tax} onChange={(event) => handleEditChange("tax", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Total
                    <input value={editForm.total} onChange={(event) => handleEditChange("total", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    NIF fornecedor
                    <input value={editForm.supplier_nif} onChange={(event) => handleEditChange("supplier_nif", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Cliente
                    <input value={editForm.customer_name} onChange={(event) => handleEditChange("customer_name", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    NIF cliente
                    <input value={editForm.customer_nif} onChange={(event) => handleEditChange("customer_nif", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", fontWeight: 600, marginTop: 12 }}>
                  Notas
                  <textarea value={editForm.notes} onChange={(event) => handleEditChange("notes", event.target.value)} rows={3} style={{ marginTop: 4, padding: 8, borderRadius: 12, border: "1px solid #cbd5f5" }} />
                </label>
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <h4 style={{ margin: 0 }}>Linhas da fatura</h4>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5f5", background: "#f8fafc", fontWeight: 600 }}
                    >
                      + Adicionar linha
                    </button>
                  </div>
                  {editLineItems.length === 0 ? (
                    <div style={{ color: "#94a3b8", marginBottom: 12 }}>Sem linhas. Pode adicionar manualmente.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {editLineItems.map((item, index) => (
                        <div key={item.id ?? `new-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#f8fafc" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                            <strong>Linha {index + 1}</strong>
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(index)}
                              style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fecdd3", background: "#fee2e2" }}
                            >
                              Remover
                            </button>
                          </div>
                          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Código
                              <input value={item.code} onChange={(event) => handleEditLineItemChange(index, "code", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600, gridColumn: "span 2" }}>
                              Descrição
                              <input value={item.description} onChange={(event) => handleEditLineItemChange(index, "description", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Quantidade
                              <input value={item.quantity} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "quantity", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Preço unitário
                              <input value={item.unit_price} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "unit_price", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Subtotal linha
                              <input value={item.line_subtotal} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_subtotal", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              IVA linha
                              <input value={item.line_tax_amount} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_tax_amount", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Total linha
                              <input value={item.line_total} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_total", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                              Taxa IVA (%)
                              <input value={item.tax_rate} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "tax_rate", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={isSavingEdit}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "none", background: "#16a34a", color: "white", fontWeight: 600 }}
                  >
                    {isSavingEdit ? "A guardar…" : "Guardar"}
                  </button>
                  <button
                    onClick={resetDetailEditor}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #cbd5f5", background: "white", fontWeight: 600 }}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            )}

            {detailInvoice && (
              <section style={{ ...cardStyle }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Detalhes da fatura</h3>
                    <div style={{ color: "#475569", fontSize: 14 }}>{detailInvoice.filename}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>#{editForm.invoice_number || detailInvoice.invoice_number || "—"}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      Tokens: total {detailInvoice.token_total ?? "—"} · in {detailInvoice.token_input ?? "—"} · out {detailInvoice.token_output ?? "—"}
                    </div>
                  </div>
                  <button onClick={closeDetails} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5f5", background: "white" }}>Fechar</button>
                </div>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Fornecedor
                    <input value={editForm.vendor} onChange={(event) => handleEditChange("vendor", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Morada fornecedor
                    <textarea value={editForm.vendor_address} onChange={(event) => handleEditChange("vendor_address", event.target.value)} rows={2} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Contacto fornecedor
                    <input value={editForm.vendor_contact} onChange={(event) => handleEditChange("vendor_contact", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    NIF fornecedor
                    <input value={editForm.supplier_nif} onChange={(event) => handleEditChange("supplier_nif", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Cliente
                    <input value={editForm.customer_name} onChange={(event) => handleEditChange("customer_name", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    NIF cliente
                    <input value={editForm.customer_nif} onChange={(event) => handleEditChange("customer_nif", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Categoria
                    <input value={editForm.category} onChange={(event) => handleEditChange("category", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Número da fatura
                    <input value={editForm.invoice_number} onChange={(event) => handleEditChange("invoice_number", event.target.value)} style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Data da fatura
                    <input value={editForm.invoice_date} onChange={(event) => handleEditChange("invoice_date", event.target.value)} placeholder="DD/MM/YYYY" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Data de vencimento
                    <input value={editForm.due_date} onChange={(event) => handleEditChange("due_date", event.target.value)} placeholder="DD/MM/YYYY" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Moeda
                    <input value={editForm.currency} onChange={(event) => handleEditChange("currency", event.target.value)} placeholder="EUR" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Subtotal
                    <input value={editForm.subtotal} onChange={(event) => handleEditChange("subtotal", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    IVA
                    <input value={editForm.tax} onChange={(event) => handleEditChange("tax", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
                    Total
                    <input value={editForm.total} onChange={(event) => handleEditChange("total", event.target.value)} inputMode="decimal" style={{ marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #cbd5f5" }} />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", fontWeight: 600, marginTop: 12 }}>
                  Notas
                  <textarea value={editForm.notes} onChange={(event) => handleEditChange("notes", event.target.value)} rows={3} style={{ marginTop: 4, padding: 8, borderRadius: 12, border: "1px solid #cbd5f5" }} />
                </label>
                <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={isSavingEdit}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "none", background: "#16a34a", color: "white", fontWeight: 600 }}
                  >
                    {isSavingEdit ? "A guardar…" : "Guardar alterações"}
                  </button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <strong>Linhas da fatura</strong>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5f5", background: "#f8fafc", fontWeight: 600 }}
                    >
                      + Adicionar linha
                    </button>
                  </div>

                  {editLineItems.length === 0 ? (
                    <div style={{ color: "#94a3b8", marginTop: 8 }}>Sem linhas. Pode adicionar manualmente.</div>
                  ) : (
                    <div style={{ marginTop: 8, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Código</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Descrição</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Qtd</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Preço Unit.</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Subtotal</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>IVA</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Total</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Taxa %</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Revisão</th>
                            <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editLineItems.map((item, index) => (
                            <tr key={item.id ?? `line-${index}`}>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.code} onChange={(event) => handleEditLineItemChange(index, "code", event.target.value)} style={{ width: 120, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.description} onChange={(event) => handleEditLineItemChange(index, "description", event.target.value)} style={{ width: 320, maxWidth: "100%", padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.quantity} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "quantity", event.target.value)} style={{ width: 80, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.unit_price} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "unit_price", event.target.value)} style={{ width: 110, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.line_subtotal} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_subtotal", event.target.value)} style={{ width: 110, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.line_tax_amount} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_tax_amount", event.target.value)} style={{ width: 110, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <input value={item.line_total} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "line_total", event.target.value)} style={{ width: 110, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <input value={item.tax_rate} inputMode="decimal" onChange={(event) => handleEditLineItemChange(index, "tax_rate", event.target.value)} style={{ width: 90, padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }} />
                                  {(() => {
                                    const source = detailInvoice?.line_items?.find((line) => line.id === item.id)?.tax_rate_source;
                                    const label = formatTaxRateSource(source);
                                    return label ? (
                                      <span style={{ fontSize: 11, color: "#475569" }} title={`Origem da taxa: ${label}`}>
                                        {label}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                {detailInvoice?.line_items?.find((line) => line.id === item.id)?.review_reason ? (
                                  <span
                                    title={detailInvoice?.line_items?.find((line) => line.id === item.id)?.review_reason ?? ""}
                                    style={{ padding: "4px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: 12, cursor: "help" }}
                                  >
                                    rever
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLineItem(index)}
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecdd3", background: "#fee2e2" }}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 20, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                  <strong>Correções com IA</strong>
                  <p style={{ color: "#475569", fontSize: 14, marginTop: 6 }}>Explique em texto livre o que o modelo errou (ex.: "O nome da empresa está errado"). A IA volta a analisar o texto original com essa correção.</p>
                  {corrections.length > 0 ? (
                    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {corrections.map((entry) => (
                        <div key={entry.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f1f5f9" }}>
                          <div style={{ fontSize: 13, color: "#64748b" }}>{new Date(entry.created_at).toLocaleString("pt-PT")}</div>
                          <div>{entry.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    value={correctionText}
                    onChange={(event) => setCorrectionText(event.target.value)}
                    placeholder="Ex.: O nome do fornecedor está errado, deve ser Via Oceânica."
                    rows={3}
                    style={{ width: "100%", marginTop: 8, borderRadius: 12, border: "1px solid #cbd5f5", padding: 10 }}
                  />
                  <button
                    onClick={() => void handleSubmitCorrection()}
                    disabled={isSubmittingCorrection || !correctionText.trim()}
                    style={{ marginTop: 8, padding: "10px 14px", borderRadius: 12, border: "none", background: isSubmittingCorrection ? "#94a3b8" : "#0ea5e9", color: "white", fontWeight: 600 }}
                  >
                    {isSubmittingCorrection ? "A reaprender…" : "Reprocessar com correção"}
                  </button>
                  {correctionStatus && <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>{correctionStatus}</div>}
                </div>
              </section>
            )}

            <section style={{ ...cardStyle }}>
              <h2 style={{ marginTop: 0 }}>Faturas processadas</h2>
              {tableRows.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>Ainda não existem faturas para este tenant.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 700, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>Estado</th>
                        <th style={{ padding: 10 }}>Ações</th>
                        <th style={{ padding: 10 }}>Fornecedor</th>
                        <th style={{ padding: 10 }}>Fatura</th>
                        <th style={{ padding: 10 }}>Categoria</th>
                        <th style={{ padding: 10 }}>Subtotal</th>
                        <th style={{ padding: 10 }}>IVA</th>
                        <th style={{ padding: 10 }}>Total</th>
                        <th style={{ padding: 10 }}>Tokens</th>
                        <th style={{ padding: 10 }}>Confiança</th>
                        <th style={{ padding: 10 }}>Linhas</th>
                        <th style={{ padding: 10 }}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 10 }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontWeight: 700,
                                fontSize: 12,
                                background: row.status === "requere revisao" ? "#fef3c7" : "#dcfce7",
                                color: row.status === "requere revisao" ? "#92400e" : "#166534",
                              }}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => openDetails(row)}
                                title="Ver detalhes"
                                aria-label="Ver detalhes"
                                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #cbd5f5", background: "#f8fafc", cursor: "pointer" }}
                              >
                                👁
                              </button>
                              <button
                                onClick={() => void handleDelete(row)}
                                title="Apagar"
                                aria-label="Apagar fatura"
                                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #fecdd3", background: "#fee2e2", cursor: "pointer" }}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: 10 }}>{row.vendor ?? "—"}</td>
                          <td style={{ padding: 10 }}>{row.invoice_number ?? "—"}</td>
                          <td style={{ padding: 10 }}>{row.category ?? "—"}</td>
                          <td style={{ padding: 10 }}>{row.subtotalFmt}</td>
                          <td style={{ padding: 10 }}>{row.taxFmt}</td>
                          <td style={{ padding: 10 }}>{row.totalFmt}</td>
                          <td style={{ padding: 10 }}>{row.tokenFmt}</td>
                          <td style={{ padding: 10 }}>
                            {row.confidenceValue === null ? (
                              "—"
                            ) : (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  background:
                                    row.confidenceValue < 75
                                      ? "#fee2e2"
                                      : row.confidenceValue < 90
                                        ? "#fef3c7"
                                        : "#dcfce7",
                                  color:
                                    row.confidenceValue < 75
                                      ? "#b91c1c"
                                      : row.confidenceValue < 90
                                        ? "#92400e"
                                        : "#166534",
                                }}
                              >
                                {row.confidenceFmt}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: 10 }}>{row.line_items && row.line_items.length > 0 ? `${row.line_items.length} item(ns)` : "—"}</td>
                          <td style={{ padding: 10 }}>{row.createdFmt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ ...cardStyle }}>
              <h2 style={{ marginTop: 0 }}>Falhas de importação</h2>
              {failedImports.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>Sem falhas pendentes para este tenant.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>Documento</th>
                        <th style={{ padding: 10 }}>Origem</th>
                        <th style={{ padding: 10 }}>Motivo</th>
                        <th style={{ padding: 10 }}>Tipo</th>
                        <th style={{ padding: 10 }}>Tentativas</th>
                        <th style={{ padding: 10 }}>Data</th>
                        <th style={{ padding: 10 }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedImports.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 10, fontWeight: 600 }}>{row.filename}</td>
                          <td style={{ padding: 10 }}>{row.source}</td>
                          <td style={{ padding: 10, color: "#334155" }}>{row.reason}</td>
                          <td style={{ padding: 10 }}>{row.detected_type ?? "—"}</td>
                          <td style={{ padding: 10 }}>{row.retry_count}</td>
                          <td style={{ padding: 10 }}>{new Date(row.created_at).toLocaleString("pt-PT")}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => void handleRetryFailedImport(row)}
                                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff" }}
                              >
                                Retry
                              </button>
                              <button
                                onClick={() => void handleDeleteFailedImport(row)}
                                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecdd3", background: "#fee2e2" }}
                              >
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ ...cardStyle }}>
              <h2 style={{ marginTop: 0 }}>Bloqueios de automação</h2>
              {automationBlockers.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>Sem bloqueios relevantes no recorte atual.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>Severidade</th>
                        <th style={{ padding: 10 }}>Bloqueio</th>
                        <th style={{ padding: 10 }}>Fatura</th>
                        <th style={{ padding: 10 }}>Mensagem</th>
                        <th style={{ padding: 10 }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {automationBlockers.map((row, index) => (
                        <tr key={`${row.invoice_id}-${row.code}-${index}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 10 }}>
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontWeight: 700,
                              fontSize: 12,
                              background: row.severity === "error" ? "#fee2e2" : "#fef3c7",
                              color: row.severity === "error" ? "#991b1b" : "#92400e",
                            }}>
                              {row.severity}
                            </span>
                          </td>
                          <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{row.code}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ fontWeight: 700 }}>{row.invoice_number || row.filename}</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>{row.vendor || "—"}</div>
                          </td>
                          <td style={{ padding: 10 }}>{row.message}</td>
                          <td style={{ padding: 10 }}>
                            <button
                              onClick={() => void openInvoiceById(row.invoice_id)}
                              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff" }}
                            >
                              Abrir fatura
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ ...cardStyle }}>
              <h2 style={{ marginTop: 0 }}>Linhas a rever</h2>
              {reviewLineItems.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>Sem linhas pendentes de revisão.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>Fatura</th>
                        <th style={{ padding: 10 }}>Linha</th>
                        <th style={{ padding: 10 }}>Total</th>
                        <th style={{ padding: 10 }}>Taxa</th>
                        <th style={{ padding: 10 }}>Confiança</th>
                        <th style={{ padding: 10 }}>Motivo</th>
                        <th style={{ padding: 10 }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewLineItems.map((row) => (
                        <tr key={row.line_item_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 10 }}>
                            <div style={{ fontWeight: 700 }}>{row.invoice_number || row.filename}</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>{row.vendor || "—"}</div>
                          </td>
                          <td style={{ padding: 10 }}>{row.description || "—"}</td>
                          <td style={{ padding: 10 }}>{formatMoney(row.line_total)}</td>
                          <td style={{ padding: 10 }}>
                            {row.tax_rate == null ? "—" : `${Number(row.tax_rate).toFixed(2)}%`}
                            {row.tax_rate_source ? (
                              <div style={{ fontSize: 11, color: "#64748b" }}>{formatTaxRateSource(row.tax_rate_source)}</div>
                            ) : null}
                          </td>
                          <td style={{ padding: 10 }}>
                            {row.normalization_confidence == null ? "—" : `${Number(row.normalization_confidence).toFixed(2)}`}
                          </td>
                          <td style={{ padding: 10 }}>{row.review_reason || "revisão manual"}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                              <input
                                value={labelDrafts[row.line_item_id] ?? row.description ?? ""}
                                onChange={(event) => handleLabelDraftChange(row.line_item_id, event.target.value)}
                                placeholder="Nome canónico"
                                style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5f5" }}
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() => void handleSaveLineLabel(row)}
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#dcfce7" }}
                                >
                                  Gravar mapeamento
                                </button>
                                <button
                                  onClick={() => void handleSaveLineLabelBulk(row)}
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #a7f3d0", background: "#ecfdf5" }}
                                >
                                  Gravar + semelhantes
                                </button>
                                <button
                                  onClick={() => void handleOpenReviewInvoice(row)}
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff" }}
                                >
                                  Abrir fatura
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ ...cardStyle }}>
              <h3 style={{ marginTop: 0 }}>Chat inteligente</h3>
              <p style={{ color: "#475569" }}>Faça perguntas sobre as suas faturas. A resposta usa o histórico recente (top-K no Qdrant).</p>
              <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {chatHistory.length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>Sem conversas ainda. Experimente: “Quanto gastei com Via Oceânica este mês?”</div>
                ) : (
                  chatHistory.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                        background: message.role === "user" ? "#2563eb" : "#f1f5f9",
                        color: message.role === "user" ? "white" : "#0f172a",
                        padding: 12,
                        borderRadius: 16,
                        maxWidth: "85%",
                      }}
                    >
                      <div>{message.text}</div>
                      {message.references && message.references.length > 0 ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: message.role === "user" ? "#e0ecff" : "#475569" }}>
                          {message.references.map((ref) => (
                            <span key={`${message.id}-${ref.invoice_id}`} style={{ marginRight: 8 }}>
                              #{ref.invoice_number ?? ref.invoice_id.toString().slice(0, 8)} ({ref.vendor ?? "Fornecedor"})
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {chatError && <div style={{ marginTop: 8, color: "#ef4444", fontSize: 14 }}>{chatError}</div>}
              <textarea
                placeholder="Ex.: Total de IVA para Via Oceânica"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                rows={3}
                style={{ width: "100%", marginTop: 8, borderRadius: 12, border: "1px solid #cbd5f5", padding: 10 }}
              />
              <button
                onClick={() => void handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                style={{ marginTop: 8, padding: "10px 14px", borderRadius: 12, border: "none", background: isChatLoading ? "#94a3b8" : "#22c55e", color: "white", fontWeight: 600 }}
              >
                {isChatLoading ? "A pensar…" : "Perguntar"}
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
