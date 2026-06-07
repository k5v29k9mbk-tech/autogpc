import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { newId, useStore } from "../store";
import { recordFromDraft, type RecordEdits } from "../core/draft";
import { useAuth } from "../auth";
import { DEFAULT_ETO, ETO_OPTIONS, GPC_CURRENCIES } from "../lib/usbankOrder";
import { Field, SourceTag } from "../components/ui";
import { IconCheck, IconTrash } from "../components/icons";
import {
  DOC_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type DocType,
  type LineItem,
  type RecordStatus,
} from "../core/types";

// The review form is exactly the set of fields a reviewer confirms before save.
type Form = RecordEdits;

const CURRENCIES = ["", ...GPC_CURRENCIES];
const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

export function Review() {
  const { draft, setDraft, addRecord } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<{ id: string } | null>(null);

  // Receipts don't carry the requestor — default it to the signed-in cardholder.
  const cardholderName =
    (user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? "").trim();

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
      requestorName: cardholderName,
      emergencyTypeOperation: DEFAULT_ETO,
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
    const id = newId();
    const record = recordFromDraft(draft, form, { id, finishedAt: Date.now() });
    await addRecord(record, draft.imageBlob);
    setDraft(null);
    setSaved({ id });
  };

  if (saved) {
    return (
      <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card pad-lg reveal" style={{ textAlign: "center" }}>
          <div className="row" style={{ justifyContent: "center", marginBottom: "var(--s3)" }}>
            <span className="check" style={{ width: 32, height: 32 }}>
              <IconCheck width={20} height={20} />
            </span>
          </div>
          <h1 style={{ fontSize: 22 }}>Record saved</h1>
          <p className="muted" style={{ marginTop: "var(--s3)" }}>
            The record is saved and ready for review.
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
        <div className="eyebrow">Step 2 of 2</div>
        <h1>Review extracted fields</h1>
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

      {/* US Bank order fields — set here, reused when creating the order */}
      <div className="card">
        <h2 className="card-title" style={{ margin: "0 0 var(--s2)" }}>US Bank order</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: "var(--s3)" }}>
          Required when this record becomes a US Bank order. Pre-filled — edit if needed. (Currency
          is set in the fields above.)
        </p>
        <div className="grid cols-2">
          <Field label="Requestor name" valid={!!form.requestorName.trim()}>
            <input
              className="input"
              value={form.requestorName}
              onChange={(e) => set("requestorName", e.target.value)}
              placeholder="Cardholder first and last name"
            />
          </Field>
          <Field label="Emergency-Type Operation">
            <select
              className="select"
              value={form.emergencyTypeOperation}
              onChange={(e) => set("emergencyTypeOperation", e.target.value)}
            >
              {ETO_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
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
      </div>
    </div>
  );
}
