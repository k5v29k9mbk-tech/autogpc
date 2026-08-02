import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { useAuth } from "../auth";
import { RecordImage } from "../components/RecordImage";
import { DocTypeTag, Field, SelectField, SourceTag, StatusBadge } from "../components/ui";
import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconTrash } from "../components/icons";
import { formatAmount, formatDateUS, orDash, toISODate } from "../lib/format";
import { documentsMissing, documentsPresent, toJson, toStructuredText } from "../lib/exportRecord";
import { USBANK_ENABLED, UsBankOrderCard } from "../components/UsBankOrderCard";
import { Section889Field } from "../components/Section889Field";
import { MandatoryAuthCard } from "../components/MandatoryAuthCard";
import { GPC_CURRENCIES } from "../lib/usbankOrder";
import {
  CHECKLIST_LABELS,
  DOC_TYPE_LABELS,
  DOC_TYPE_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  emptyMandatoryAuth,
  type DocType,
  type DocumentChecklist,
  type PurchaseRecord,
  type RecordStatus,
} from "../core/types";

const CHECKLIST_KEYS = Object.keys(CHECKLIST_LABELS) as (keyof DocumentChecklist)[];

export function RecordDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { ready, getRecord, updateRecord, deleteRecord } = useStore();
  const { mode } = useAuth();
  const record = getRecord(id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PurchaseRecord | null>(record ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (record && !editing) setForm(record);
  }, [record, editing]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!record || !form) {
    return (
      <div className="empty">
        Record not found. <Link to="/records" style={{ color: "var(--text)" }}>Back to records →</Link>
      </div>
    );
  }

  const set = <K extends keyof PurchaseRecord>(key: K, value: PurchaseRecord[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied`);
    } catch {
      setToast("Copy failed — select and copy manually");
    }
  };

  const downloadJson = () => {
    const blob = new Blob([toJson(record)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${record.vendor.replace(/\W+/g, "-").toLowerCase() || "record"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const saveEdits = async () => {
    await updateRecord(form);
    setEditing(false);
    setToast("Saved");
  };

  const setStatus = async (status: RecordStatus) => {
    await updateRecord({ ...record, status });
    setToast(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
  };

  const remove = async () => {
    await deleteRecord(record.id);
    navigate("/records");
  };

  const present = documentsPresent(record.documentChecklist);
  const missing = documentsMissing(record.documentChecklist);

  return (
    <div className="stack" style={{ gap: "var(--s5)" }}>
      <Link to="/records" className="row muted" style={{ gap: 6, fontSize: 14, width: "fit-content" }}>
        <IconArrowLeft width={16} height={16} /> All records
      </Link>

      {/* Header */}
      <div className="row wrap">
        <div>
          <h1 style={{ fontSize: 24 }}>{record.vendor || "Untitled record"}</h1>
          <div className="row wrap" style={{ gap: "var(--s2)", marginTop: "var(--s2)" }}>
            <StatusBadge status={record.status} />
            <DocTypeTag docType={record.docType} />
            <SourceTag source={record.source} />
          </div>
        </div>
        <div className="spacer" />
        <div className="row wrap">
          {!editing && !confirmDelete && (
            <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>
          )}
          {/* Confirm inline, right where the Delete button is — not in a far-off toast. */}
          {confirmDelete ? (
            <div className="row" style={{ gap: "var(--s2)" }}>
              <span className="muted" style={{ fontSize: 13 }}>Delete this record?</span>
              <button className="btn btn-sm btn-danger" onClick={remove}>Delete</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
              <IconTrash width={15} height={15} /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        {/* Image */}
        <div className="card">
          <div className="card-title">Document</div>
          <RecordImage uri={record.imageUri} className="preview-img" alt={`${record.vendor} document`} />
        </div>

        {/* Fields */}
        <div className="card">
          <div className="card-title">Extracted fields</div>
          {editing ? (
            <div className="grid cols-2">
              <Field label="Vendor"><input className="input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} /></Field>
              <Field label="Transaction date"><input type="date" className="input" value={toISODate(form.transactionDate)} onChange={(e) => set("transactionDate", e.target.value)} /></Field>
              <Field label="Total"><input className="input mono" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} /></Field>
              <SelectField
                label="Currency"
                required
                value={form.currency}
                onChange={(v) => set("currency", v)}
                options={GPC_CURRENCIES}
              />
              <Field label="Card last 4"><input className="input mono" value={form.cardLast4 ?? ""} maxLength={4} onChange={(e) => set("cardLast4", e.target.value || null)} /></Field>
              <Field label="Receipt number"><input className="input mono" value={form.receiptNumber ?? ""} onChange={(e) => set("receiptNumber", e.target.value || null)} /></Field>
              <Field label="Invoice number"><input className="input mono" value={form.invoiceNumber ?? ""} onChange={(e) => set("invoiceNumber", e.target.value || null)} /></Field>
              <SelectField
                label="Document type"
                value={form.docType}
                onChange={(v) => set("docType", v as DocType)}
                options={DOC_TYPE_ORDER.map((d) => ({ value: d, label: DOC_TYPE_LABELS[d] }))}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(v) => set("status", v as RecordStatus)}
                options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            </div>
          ) : (
            <dl className="kv">
              <dt>Vendor</dt><dd>{orDash(record.vendor)}</dd>
              <dt>Transaction date</dt><dd>{formatDateUS(record.transactionDate)}</dd>
              <dt>Total</dt><dd>{formatAmount(record.totalAmount, record.currency)}</dd>
              <dt>Currency</dt><dd>{orDash(record.currency)}</dd>
              <dt>Card last 4</dt><dd>{orDash(record.cardLast4)}</dd>
              <dt>Receipt no.</dt><dd>{orDash(record.receiptNumber)}</dd>
              <dt>Invoice no.</dt><dd>{orDash(record.invoiceNumber)}</dd>
            </dl>
          )}

          {editing ? (
            <div className="field" style={{ marginTop: "var(--s4)" }}>
              <label>Notes</label>
              <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          ) : (
            record.notes.trim() && (
              <>
                <hr className="divider" />
                <div className="stat-label" style={{ marginBottom: 4 }}>Notes</div>
                <p style={{ fontSize: 14 }}>{record.notes}</p>
              </>
            )
          )}

          {editing && (
            <div className="row" style={{ marginTop: "var(--s4)" }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdits}>Save changes</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setForm(record); }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      {record.lineItems.length > 0 && (
        <div className="card">
          <div className="card-title">Line items</div>
          <div className="stack" style={{ gap: 6 }}>
            {record.lineItems.map((li, i) => (
              <div key={i} className="row" style={{ fontSize: 14, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span>{li.description}</span>
                <div className="spacer" />
                <span className="mono muted">{li.quantity ? `${li.quantity} × ` : ""}{li.unitPrice ? formatAmount(li.unitPrice, record.currency) : ""}</span>
                <span className="mono" style={{ minWidth: 90, textAlign: "right" }}>{li.total ? formatAmount(li.total, record.currency) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document checklist */}
      <div className="card">
        <div className="card-title">Document checklist</div>
        <div className="row wrap" style={{ gap: "var(--s3)" }}>
          {CHECKLIST_KEYS.map((key) => {
            const checked = (editing ? form : record).documentChecklist[key];
            return (
              <button
                key={key}
                className="badge"
                style={{ cursor: editing ? "pointer" : "default", color: checked ? "var(--accent-text)" : "var(--text-muted)", borderColor: checked ? "#3a4a3c" : "var(--border)", background: checked ? "var(--accent-soft)" : "var(--surface-2)" }}
                onClick={() => {
                  if (!editing) return;
                  set("documentChecklist", { ...form.documentChecklist, [key]: !checked });
                }}
              >
                {checked && <IconCheck width={12} height={12} />}
                {CHECKLIST_LABELS[key]}
              </button>
            );
          })}
        </div>
        {!editing && <p className="muted" style={{ fontSize: 12, marginTop: "var(--s3)" }}>Edit the record to update the checklist.</p>}
      </div>

      {/* US Bank required order fields, confirmed on review. Read-only here;
          edit them by re-reviewing. */}
      {record.usBank && (
        <div className="card">
          <div className="card-title">US Bank order fields</div>
          <dl className="kv">
            <dt>Special Pre-Approval</dt><dd>{orDash(record.usBank.specialPreApproval)}</dd>
            <dt>Delegated Procurement Authority</dt><dd>{orDash(record.usBank.delegatedProcurementAuthority)}</dd>
            <dt>A/BO-RM/FM Pre-Purch Approvals</dt><dd>{orDash(record.usBank.prePurchaseApprovals)}</dd>
            <dt>Section 508 Consideration</dt><dd>{orDash(record.usBank.section508Consideration)}</dd>
            <dt>Request to Purchase Received</dt><dd>{orDash(record.usBank.requestToPurchaseReceived)}</dd>
            <dt>Spend Analysis</dt><dd>{orDash(record.usBank.spendAnalysis)}</dd>
            <dt>Required Source Screened</dt><dd>{orDash(record.usBank.requiredSourceScreened)}</dd>
            <dt>Final Delivery Outside US</dt><dd>{orDash(record.usBank.finalDeliveryOutsideUs)}</dd>
            <dt>Line Item Tax</dt><dd>{orDash(record.usBank.lineItemTax)}</dd>
          </dl>
        </div>
      )}

      {/* Status actions */}
      <div className="card">
        <div className="card-title">Workflow</div>
        <div className="row wrap">
          <button className="btn btn-sm" disabled={record.status === "reviewed"} onClick={() => setStatus("reviewed")}>Mark reviewed</button>
          <button className="btn btn-sm" disabled={record.status === "ready_for_entry"} onClick={() => setStatus("ready_for_entry")}>Mark ready for entry</button>
          <button className="btn btn-sm" disabled={record.status === "exported"} onClick={() => setStatus("exported")}>Mark exported</button>
        </div>
      </div>

      {/* 889 representation — SAM.gov lookup. When the US Bank card renders,
          the same lookup lives inside it, so only stand alone otherwise. */}
      {!(USBANK_ENABLED && mode === "authenticated") && (
        <div className="card">
          <div className="card-title">889 representation</div>
          <Section889Field
            vendor={record.vendor}
            saved={record.section889}
            onChange={(value) => updateRecord({ ...record, section889: value })}
          />
        </div>
      )}

      {/* Mandatory authorization + supporting documents. Edits persist
          immediately so the gathered docs are ready for the US Bank handoff. */}
      <MandatoryAuthCard
        recordId={record.id}
        hasReceiptImage={!!record.imageUri}
        value={record.mandatoryAuth ?? emptyMandatoryAuth()}
        attachments={record.attachments ?? []}
        onChange={(mandatoryAuth) => updateRecord({ ...record, mandatoryAuth })}
        onAttachmentsChange={(attachments) => updateRecord({ ...record, attachments })}
      />

      {/* US Bank order handoff — needs a signed-in session (the proxy exchanges
          the Supabase token), so a guest gets the explanation, not a card whose
          submit can only fail. */}
      {USBANK_ENABLED &&
        (mode === "authenticated" ? (
          <UsBankOrderCard record={record} />
        ) : (
          <div className="card">
            <div className="card-title">Send to US Bank order</div>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              <Link to="/login" style={{ color: "var(--text)" }}>Sign in</Link> to create, match,
              and attach this order in US Bank — guest mode has no account to act on.
            </p>
          </div>
        ))}

      {/* Export / summary */}
      <div className="card">
        <div className="row" style={{ marginBottom: "var(--s3)" }}>
          <div className="card-title" style={{ margin: 0 }}>Export for manual entry</div>
          <div className="spacer" />
          <button className="btn btn-sm" onClick={() => copy(toStructuredText(record), "Structured summary")}>
            <IconCopy width={15} height={15} /> Copy summary
          </button>
          <button className="btn btn-sm" onClick={() => copy(toJson(record), "JSON")}>
            <IconCopy width={15} height={15} /> Copy JSON
          </button>
          <button className="btn btn-sm" onClick={downloadJson}>
            <IconDownload width={15} height={15} /> Download JSON
          </button>
        </div>
        <pre className="code">{toStructuredText(record)}</pre>
        <p className="muted" style={{ fontSize: 12, marginTop: "var(--s3)" }}>
          Documents present: {present.length ? present.join(", ") : "none"} · missing: {missing.length ? missing.join(", ") : "none"}. Copy this for manual entry — nothing is
          submitted from here.
        </p>
      </div>

      {/* Raw OCR */}
      <div className="card">
        <details className="collapsible">
          <summary>Raw extracted text ({record.rawOcrText.length.toLocaleString()} chars)</summary>
          <pre className="code" style={{ marginTop: "var(--s3)" }}>{record.rawOcrText || "(empty)"}</pre>
        </details>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
