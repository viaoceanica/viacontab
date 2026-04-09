import { useMemo, useState } from "react";
import {
  ViaContabClient,
  ViaContabApiError,
  type Invoice,
  type InvoiceUpdatePayload,
} from "@viacontab/api-client";

interface EditableLine {
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

const toText = (value: number | null | undefined) => (value == null ? "" : String(value));
const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : null;
};

const toEditableLine = (line: NonNullable<Invoice["line_items"]>[number]): EditableLine => ({
  id: line.id,
  code: line.code ?? "",
  description: line.description ?? "",
  quantity: toText(line.quantity ?? null),
  unit_price: toText(line.unit_price ?? null),
  line_subtotal: toText(line.line_subtotal ?? null),
  line_tax_amount: toText(line.line_tax_amount ?? null),
  line_total: toText(line.line_total ?? null),
  tax_rate: toText(line.tax_rate ?? null),
});

export function App() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8100");
  const [tenantId, setTenantId] = useState("demo");
  const [accessToken, setAccessToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("Ready");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<EditableLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const client = useMemo(
    () =>
      new ViaContabClient({
        baseUrl,
        accessToken: accessToken || undefined,
        apiKey: apiKey || undefined,
      }),
    [baseUrl, accessToken, apiKey]
  );

  const load = async () => {
    try {
      setStatus("Checking health...");
      await client.ready();
      setStatus("Loading invoices...");
      const data = await client.listInvoices(tenantId);
      setInvoices(data.items);
      setStatus(`Loaded ${data.items.length} invoices`);
    } catch (error) {
      if (error instanceof ViaContabApiError) {
        setStatus(`API error ${error.status}: ${String(error.detail)}`);
      } else {
        setStatus(`Error: ${String(error)}`);
      }
    }
  };

  const openInvoice = (invoice: Invoice) => {
    setSelected(invoice);
    setNotes(invoice.notes ?? "");
    setLineItems((invoice.line_items ?? []).map(toEditableLine));
    setStatus(`Opened ${invoice.invoice_number ?? invoice.filename}`);
  };

  const updateLine = (index: number, field: keyof EditableLine, value: string) => {
    setLineItems((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const save = async () => {
    if (!selected) return;

    const payload: InvoiceUpdatePayload = {
      notes,
      status: "corrigido",
      requires_review: false,
      line_items: lineItems.map((line) => ({
        id: line.id,
        code: line.code || null,
        description: line.description || null,
        quantity: toNumberOrNull(line.quantity),
        unit_price: toNumberOrNull(line.unit_price),
        line_subtotal: toNumberOrNull(line.line_subtotal),
        line_tax_amount: toNumberOrNull(line.line_tax_amount),
        line_total: toNumberOrNull(line.line_total),
        tax_rate: toNumberOrNull(line.tax_rate),
      })),
    };

    try {
      setIsSaving(true);
      setStatus("Saving invoice...");
      const updated = await client.updateInvoice(selected.id, payload);
      setSelected(updated);
      setInvoices((prev) => prev.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
      setStatus(`Saved ${updated.invoice_number ?? updated.filename} (status=${updated.status})`);
    } catch (error) {
      if (error instanceof ViaContabApiError) {
        setStatus(`Save failed ${error.status}: ${String(error.detail)}`);
      } else {
        setStatus(`Save failed: ${String(error)}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="layout">
      <h1>ViaContab External UI Example</h1>

      <div className="panel">
        <div className="grid">
          <label>
            Base URL
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label>
            Tenant ID
            <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
          </label>
          <label>
            Bearer token (optional)
            <input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="eyJ..." />
          </label>
          <label>
            API key (optional)
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="x-api-key" />
          </label>
        </div>
        <button onClick={load}>Load queue</button>
        <div className="status">{status}</div>
      </div>

      <div className="panel">
        <h2>Queue</h2>
        {invoices.length === 0 ? (
          <p>No invoices loaded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number ?? invoice.filename}</td>
                  <td>{invoice.vendor ?? "—"}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.total ?? "—"}</td>
                  <td>
                    <button onClick={() => openInvoice(invoice)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="panel">
          <h2>Edit invoice: {selected.invoice_number ?? selected.filename}</h2>
          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <h3>Line items</h3>
          {lineItems.length === 0 ? (
            <p>No line items.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Subtotal</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Tax %</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, index) => (
                  <tr key={line.id ?? `line-${index}`}>
                    <td><input value={line.code} onChange={(event) => updateLine(index, "code", event.target.value)} /></td>
                    <td><input value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} /></td>
                    <td><input value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} /></td>
                    <td><input value={line.unit_price} onChange={(event) => updateLine(index, "unit_price", event.target.value)} /></td>
                    <td><input value={line.line_subtotal} onChange={(event) => updateLine(index, "line_subtotal", event.target.value)} /></td>
                    <td><input value={line.line_tax_amount} onChange={(event) => updateLine(index, "line_tax_amount", event.target.value)} /></td>
                    <td><input value={line.line_total} onChange={(event) => updateLine(index, "line_total", event.target.value)} /></td>
                    <td><input value={line.tax_rate} onChange={(event) => updateLine(index, "tax_rate", event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button onClick={save} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save invoice"}
          </button>
        </div>
      )}
    </div>
  );
}
