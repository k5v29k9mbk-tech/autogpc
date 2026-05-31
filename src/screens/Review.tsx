import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { newId, useStore } from "../store";
import { useElapsed } from "../hooks/useElapsed";
import { Field, SourceTag } from "../components/ui";
import { IconCheck, IconClock, IconTrash } from "../components/icons";
import { formatDuration, formatTimer } from "../lib/format";
import {
  DOC_TYPE_LABELS,
  MANUAL_BASELINE_SECONDS,
  STATUS_LABELS,
  STATUS_ORDER,
  emptyChecklist,
  type DocType,
  type DocumentChecklist,
  type LineItem,
  type PurchaseRecord,
  type RecordStatus,
} from "../core/types";

type Form = {
  vendor: string;
  transactionDate: string;
  totalAmount: string;
  currency: string;
  taxAmount: string;
  cardLast4: string;
  receiptNumber: string;
  invoiceNumber: string;
  notes: string;
  status: RecordStatus;
  docType: DocType;
  lineItems: LineItem[];
};

const CURRENCIES = ["", "USD", "EUR", "GBP"];
const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

function checklistForDocType(docType: DocType): DocumentChecklist {
  const c = emptyChecklist();
  if (docType === "receipt") c.receiptUploaded = true;
  else if (docType === "invoice") c.invoiceUploaded = true;
  else if (docType === "quote") c.quoteUploaded = true;
  else if (docType === "vat_form") c.approvalDocUploaded = true;
  else c.otherDocsUploaded = true;
  return c;
}

export function Review() {
  const { draft, setDraft, addRecord } = useStore();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<{ seconds: number; id: string } | null>(null);

  const elapsed = useElapsed(draft?.captureStartedAt ?? null, !saved);

  const [form, setForm] = useState<Form>(() => {
    const f = draft?.fields ?? {};
    return {
      vendor: f.vendor ?? "",
      transactionDate: f.transactionDate ?? "",
      totalAmount: f.totalAmount ?? "",
      currency: f.currency ?? "",
      taxAmount: f.taxAmount ?? "",
      cardLast4: f.cardLast4 ?? "",
      receiptNumber: f.receiptNumber ?? "",
      invoiceNumber: f.invoiceNumber ?? "",
      notes: f.notes ?? "",
      status: "needs_review",
      docType: draft?.docType ?? "receipt",
      lineItems: draft?.lineItems ?? [],
    };
  });

  const extractedCount = useMemo(() => {
    if (!draft) return 0;
    return [form.vendor, form.transactionDate, form.totalAmount, form.currency, form.taxAmount, form.cardLast4]
      .filter((v) => v && v.trim())
      .length;
  }, [draft, form]);

  if (!draft) return <Navigate to="/scan" replace />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setLineItem = (i: number, patch: Partial<LineItem>) =>
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => (idx === i ? { ...li, ...patch } : li)),
    }));

  const save = async () => {
    const seconds = Math.round((Date.now() - draft.captureStartedAt) / 1000);
    const now = new Date().toISOString();
    const id = newId();
    const record: PurchaseRecord = {
      id,
      vendor: form.vendor.trim(),
      transactionDate: form.transactionDate.trim(),
      totalAmount: form.totalAmount.trim(),
      currency: form.currency.trim(),
      taxAmount: form.taxAmount.trim() || null,
      cardLast4: form.cardLast4.trim() || null,
      receiptNumber: form.receiptNumber.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      lineItems: form.lineItems,
      notes: form.notes,
      rawOcrText: draft.rawText,
      imageUri: draft.imageUri,
      status: form.status,
      documentChecklist: checklistForDocType(form.docType),
      captureSeconds: seconds,
      source: draft.source,
      docType: form.docType,
      createdAt: now,
      updatedAt: now,
    };
    await addRecord(record, draft.imageBlob);
    setDraft(null);
    setSaved({ seconds, id });
  };

  if (saved) {
    const savedSeconds = Math.max(0, MANUAL_BASELINE_SECONDS - saved.seconds);
    return (
      <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card pad-lg reveal" style={{ textAlign: "center" }}>
          <div className="row" style={{ justifyContent: "center", marginBottom: "var(--s3)" }}>
            <span className="check" style={{ width: 32, height: 32 }}>
              <IconCheck width={20} height={20} />
            </span>
          </div>
          <h1 style={{ fontSize: 22 }}>Record saved</h1>
          <div className="stat-value" style={{ color: "var(--accent-text)", margin: "var(--s4) 0 0" }}>
            Captured in {formatTimer(saved.seconds)}
          </div>
          <p className="muted" style={{ marginTop: "var(--s3)" }}>
            Manual GPC entry takes <strong style={{ color: "var(--text)" }}>~12 min</strong>. This
            capture saved about <strong style={{ color: "var(--text)" }}>{formatDuration(savedSeconds)}</strong>.
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: "var(--s5)" }}>
            <button className="btn btn-primary" onClick={() => navigate(`/records/${saved.id}`)}>
              View record
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/scan")}>
              Scan another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s5)" }}>
      <div className="page-head">
        <div className="row" style={{ gap: "var(--s3)" }}>
          <div>
            <div className="eyebrow">Step 2 of 2</div>
            <h1>Review extracted fields</h1>
          </div>
          <div className="spacer" />
          <span className="badge" title="Live capture timer" style={{ color: "var(--accent-text)" }}>
            <IconClock width={14} height={14} />
            <span className="readout">{formatTimer(elapsed)}</span>
          </span>
        </div>
        <p className="sub">
          Correct anything the extractor missed, then save. Prefer fixing here over trusting a shaky
          guess — that is what keeps the record audit-ready.
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: "var(--s4)" }}>
          <SourceTag source={draft.source} />
          {draft.confidence != null && (
            <span className="tag">OCR confidence {Math.round(draft.confidence * 100)}%</span>
          )}
          <div className="spacer" />
          <span className="muted" style={{ fontSize: 12 }}>{extractedCount} fields auto-filled</span>
        </div>

        <div className="grid cols-2">
          <Field label="Vendor" valid={!!form.vendor.trim()}>
            <input className="input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
          </Field>
          <Field label="Transaction date" valid={!!form.transactionDate.trim()}>
            <input className="input mono" value={form.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} placeholder="MM/DD/YYYY · DD.MM.YYYY · YYYY-MM-DD" />
          </Field>
          <Field label="Total amount" valid={!!form.totalAmount.trim()}>
            <input className="input mono" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
          </Field>
          <Field label="Currency" valid={!!form.currency.trim()}>
            <select className="select" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c || "— select —"}</option>
              ))}
            </select>
          </Field>
          <Field label="Tax / VAT" valid={!!form.taxAmount.trim()}>
            <input className="input mono" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
          </Field>
          <Field label="Card last 4" valid={!!form.cardLast4.trim()}>
            <input className="input mono" value={form.cardLast4} onChange={(e) => set("cardLast4", e.target.value)} maxLength={4} />
          </Field>
          <Field label="Receipt number" valid={!!form.receiptNumber.trim()}>
            <input className="input mono" value={form.receiptNumber} onChange={(e) => set("receiptNumber", e.target.value)} />
          </Field>
          <Field label="Invoice number" valid={!!form.invoiceNumber.trim()}>
            <input className="input mono" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
          </Field>
          <Field label="Document type">
            <select className="select" value={form.docType} onChange={(e) => set("docType", e.target.value as DocType)}>
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>{DOC_TYPE_LABELS[d]}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" value={form.status} onChange={(e) => set("status", e.target.value as RecordStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="field" style={{ marginTop: "var(--s4)" }}>
          <label>Notes</label>
          <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything a reviewer should know (e.g. 889 status, missing docs)." />
        </div>
      </div>

      {/* Line items */}
      <div className="card">
        <div className="row" style={{ marginBottom: "var(--s3)" }}>
          <h2 className="card-title" style={{ margin: 0 }}>Line items</h2>
          <div className="spacer" />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => set("lineItems", [...form.lineItems, { description: "", quantity: null, unitPrice: null, total: null }])}
          >
            Add line item
          </button>
        </div>
        {form.lineItems.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No line items parsed. Add them manually if needed.</p>
        ) : (
          <div className="stack" style={{ gap: "var(--s2)" }}>
            {form.lineItems.map((li, i) => (
              <div key={i} className="row" style={{ gap: "var(--s2)" }}>
                <input className="input" style={{ flex: 3 }} placeholder="Description" value={li.description} onChange={(e) => setLineItem(i, { description: e.target.value })} />
                <input className="input mono" style={{ flex: 1 }} placeholder="Qty" value={li.quantity ?? ""} onChange={(e) => setLineItem(i, { quantity: e.target.value || null })} />
                <input className="input mono" style={{ flex: 1 }} placeholder="Unit" value={li.unitPrice ?? ""} onChange={(e) => setLineItem(i, { unitPrice: e.target.value || null })} />
                <input className="input mono" style={{ flex: 1 }} placeholder="Total" value={li.total ?? ""} onChange={(e) => setLineItem(i, { total: e.target.value || null })} />
                <button className="btn btn-sm btn-ghost" aria-label="Remove line item" onClick={() => set("lineItems", form.lineItems.filter((_, idx) => idx !== i))}>
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw OCR */}
      <div className="card">
        <details className="collapsible">
          <summary>Raw extracted text ({draft.rawText.length.toLocaleString()} chars)</summary>
          <pre className="code" style={{ marginTop: "var(--s3)" }}>{draft.rawText || "(empty)"}</pre>
        </details>
      </div>

      <div className="row wrap">
        <button className="btn btn-primary btn-lg" onClick={save}>Save record</button>
        <Link to="/scan" className="btn btn-ghost btn-lg">Discard</Link>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>
          Manual baseline ~{formatTimer(MANUAL_BASELINE_SECONDS)} · live capture {formatTimer(elapsed)}
        </span>
      </div>
    </div>
  );
}
