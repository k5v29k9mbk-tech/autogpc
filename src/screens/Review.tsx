import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { newId, useStore } from "../store";
import { recordFromDraft, type RecordEdits } from "../core/draft";
import { useAuth } from "../auth";
import {
  DEFAULT_ETO,
  DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS,
  ETO_OPTIONS,
  FINAL_DELIVERY_OUTSIDE_US_OPTIONS,
  finalDeliveryDefault,
  GPC_CURRENCIES,
  PREPURCHASE_APPROVALS_OPTIONS,
  REQUEST_TO_PURCHASE_OPTIONS,
  REQUIRED_SOURCE_SCREENED_OPTIONS,
  SECTION_508_OPTIONS,
  SPECIAL_PRE_APPROVAL_OPTIONS,
  SPEND_ANALYSIS_OPTIONS,
} from "../lib/usbankOrder";
import { Field } from "../components/ui";
import { confidenceBucket, toISODate } from "../lib/format";
import { Section889Field } from "../components/Section889Field";
import { MandatoryAuthCard } from "../components/MandatoryAuthCard";
import { suggestSpecialPreApproval } from "../core/mandatoryAuth";
import { IconEye, IconTrash } from "../components/icons";
import {
  DESIGNATION_889_OPTIONS,
  DOC_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  emptyMandatoryAuth,
  type DocType,
  type LineItem,
  type RecordStatus,
  type Saved889,
} from "../core/types";

// The review form is exactly the set of fields a reviewer confirms before save.
type Form = RecordEdits;

const CURRENCIES = ["", ...GPC_CURRENCIES];
const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

export function Review() {
  const { draft, setDraft, addRecord } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  // The record's id, fixed up front so supporting documents uploaded during
  // review are keyed to it (and carried onto the record at save).
  const [recordId] = useState(newId());

  // Receipts don't carry the requestor — default it to the signed-in cardholder.
  const cardholderName =
    (user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? "").trim();

  const [form, setForm] = useState<Form>(() => {
    const f = draft?.fields ?? {};
    return {
      vendor: f.vendor ?? "",
      // Normalize the extractor's date (any format) to ISO for the date picker;
      // fall back to today when the receipt had no parseable date. Editable after.
      // en-CA renders local time as YYYY-MM-DD (not UTC like toISOString).
      transactionDate: toISODate(f.transactionDate) || new Date().toLocaleDateString("en-CA"),
      totalAmount: f.totalAmount ?? "",
      // Auto-grab the currency: use what the extractor read, else default to USD
      // (the GPC default) rather than leaving the reviewer on "— select —".
      currency: f.currency || "USD",
      // Tax fields are required by US Bank but default to 0.00 there, so seed
      // them rather than forcing the reviewer to type a zero.
      taxAmount: f.taxAmount || "0.00",
      cardLast4: f.cardLast4 ?? "",
      receiptNumber: f.receiptNumber ?? "",
      invoiceNumber: f.invoiceNumber ?? "",
      notes: f.notes ?? "",
      requestorName: cardholderName,
      emergencyTypeOperation: DEFAULT_ETO,
      designation889: "",
      // Required US Bank dropdowns — left blank so the reviewer must consciously
      // pick each one (they can't be inferred from a receipt). Special
      // Pre-Approval is the exception: seed it from the detected categories.
      specialPreApproval: suggestSpecialPreApproval(draft?.mandatoryAuth?.categories ?? []),
      delegatedProcurementAuthority: "",
      prePurchaseApprovals: "",
      section508Consideration: "",
      requestToPurchaseReceived: "",
      spendAnalysis: "",
      requiredSourceScreened: "",
      // Seed from the cardholder's duty station: CONUS → "No", OCONUS → APO/FPO.
      // Reviewer still confirms (or overrides) before save.
      finalDeliveryOutsideUs: finalDeliveryDefault(user?.dutyStationOconus),
      lineItemTax: "0.00",
      status: "needs_review",
      docType: draft?.docType ?? "receipt",
      lineItems: draft?.lineItems ?? [],
      mandatoryAuth: draft?.mandatoryAuth ?? emptyMandatoryAuth(),
      attachments: [],
    };
  });

  // Required-field validation surfaced on a failed save attempt.
  const [missing, setMissing] = useState<string[]>([]);

  // SAM.gov 889 determination confirmed during review; attached to the record on save.
  const [section889, setSection889] = useState<Saved889 | null>(null);

  // Full-screen view of the uploaded document, for checking fields against the source.
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  // "Auto-filled" reflects what the extractor actually read, not the defaults we
  // seed (currency/requestor), so count from the draft fields.
  const extractedCount = useMemo(() => {
    const f = draft?.fields ?? {};
    return [f.vendor, f.transactionDate, f.totalAmount, f.currency]
      .filter((v) => v && v.trim())
      .length;
  }, [draft]);

  if (!draft) return <Navigate to="/scan" replace />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setLineItem = (i: number, patch: Partial<LineItem>) =>
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => (idx === i ? { ...li, ...patch } : li)),
    }));

  // The new US Bank required dropdowns all render the same way: a labelled
  // select seeded blank, valid once picked.
  type UsBankSelectKey =
    | "specialPreApproval"
    | "delegatedProcurementAuthority"
    | "prePurchaseApprovals"
    | "section508Consideration"
    | "requestToPurchaseReceived"
    | "spendAnalysis"
    | "requiredSourceScreened"
    | "finalDeliveryOutsideUs";
  const selectField = (key: UsBankSelectKey, label: string, options: readonly string[]) => (
    <Field label={`${label} *`} valid={!!form[key].trim()}>
      <select className="select" value={form[key]} onChange={(e) => set(key, e.target.value)}>
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </Field>
  );

  // US Bank requires every red-asterisk field before an order can be created.
  // Enforce the same here so a saved record is order-ready, not half-filled.
  const requiredFields: [keyof Form, string][] = [
    ["requestorName", "Requestor name"],
    ["totalAmount", "Amount"],
    ["transactionDate", "Order date"],
    ["specialPreApproval", "Special Pre-Approval Obtained"],
    ["delegatedProcurementAuthority", "Delegated Procurement Authority Used"],
    ["prePurchaseApprovals", "A/BO and/or RM/FM Pre-Purch Approvals Obtained"],
    ["section508Consideration", "Items Subject to Section 508 Consideration"],
    ["requestToPurchaseReceived", "Request to Purchase Received"],
    ["spendAnalysis", "Spend Analysis"],
    ["vendor", "Merchant name"],
    ["requiredSourceScreened", "Required Source Screened"],
    ["designation889", "889 Designation"],
    ["finalDeliveryOutsideUs", "Final Delivery Location Outside United States"],
  ];

  const save = async () => {
    const gaps = requiredFields
      .filter(([key]) => !String(form[key]).trim())
      .map(([, label]) => label);
    // Line items are optional, but any present one needs a description and total.
    if (form.lineItems.some((li) => !li.description.trim() || !String(li.total ?? "").trim()))
      gaps.push("Line item description and total");
    if (gaps.length) {
      setMissing(gaps);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setMissing([]);
    const record = { ...recordFromDraft(draft, form, { id: recordId, finishedAt: Date.now() }), section889 };
    await addRecord(record, draft.imageBlob);
    setDraft(null);
    navigate("/records");
  };

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

      {missing.length > 0 && (
        <div className="alert alert-error">
          <div>
            Fill the required US Bank fields before saving: {missing.join(", ")}.
          </div>
        </div>
      )}

      {/* The uploaded document, kept on hand so the reviewer can check fields
          against the source. Click to open full screen. */}
      {draft.imageUri && (
        <div className="card">
          <div className="row" style={{ marginBottom: "var(--s3)" }}>
            <div className="card-title" style={{ margin: 0 }}>Uploaded document</div>
            <div className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => setZoom(true)}>
              <IconEye width={15} height={15} /> Full screen
            </button>
          </div>
          <button type="button" className="zoomable" onClick={() => setZoom(true)} aria-label="View document full screen">
            <img src={draft.imageUri} className="preview-img" alt="Uploaded document" />
          </button>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: "var(--s4)" }}>
          {draft.confidence != null && (
            <span className="tag" title={`${Math.round(draft.confidence * 100)}% confidence`}>
              {confidenceBucket(draft.confidence)} confidence
            </span>
          )}
          <div className="spacer" />
          <span className="muted" style={{ fontSize: 12 }}>{extractedCount} fields auto-filled</span>
        </div>

        {/* Fields follow the US Bank "Create Order" form, section by section.
            Every red-asterisk field there is required (*) and blocked on save. */}
        <div className="grid cols-2">
          {/* General / approvals */}
          <div className="stat-label" style={{ gridColumn: "1 / -1" }}>General &amp; approvals</div>
          <Field label="Requestor name *" valid={!!form.requestorName.trim()}>
            <input
              className="input"
              value={form.requestorName}
              onChange={(e) => set("requestorName", e.target.value)}
              placeholder="Cardholder first and last name"
            />
          </Field>
          <Field label="Order date *" valid={!!form.transactionDate.trim()}>
            <input type="date" className="input" value={form.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} />
          </Field>
          {selectField("specialPreApproval", "Special Pre-Approval Obtained", SPECIAL_PRE_APPROVAL_OPTIONS)}
          {selectField("delegatedProcurementAuthority", "Delegated Procurement Authority Used", DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS)}
          {selectField("prePurchaseApprovals", "A/BO and/or RM/FM Pre-Purch Approvals Obtained", PREPURCHASE_APPROVALS_OPTIONS)}
          {selectField("section508Consideration", "Items Subject to Section 508 Consideration?", SECTION_508_OPTIONS)}
          {selectField("requestToPurchaseReceived", "Request to Purchase Received", REQUEST_TO_PURCHASE_OPTIONS)}
          {selectField("spendAnalysis", "Spend Analysis", SPEND_ANALYSIS_OPTIONS)}
          <Field label="Emergency-Type Operation (OM) *">
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

          {/* Financials */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Financials</div>
          <Field label="Amount *" valid={!!form.totalAmount.trim()}>
            <div className="row" style={{ gap: "var(--s2)" }}>
              <input className="input mono" style={{ flex: 1 }} value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
              <select aria-label="Currency" className="select" style={{ width: "auto" }} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c || "— select —"}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Total Tax *" valid={!!form.taxAmount.trim()}>
            <input className="input mono" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
          </Field>
          <Field label="Line Item Tax *" valid={!!form.lineItemTax.trim()}>
            <input className="input mono" value={form.lineItemTax} onChange={(e) => set("lineItemTax", e.target.value)} />
          </Field>

          {/* Merchant */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Merchant</div>
          <Field label="Merchant name *" valid={!!form.vendor.trim()}>
            <input className="input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
          </Field>
          {selectField("requiredSourceScreened", "Required Source Screened", REQUIRED_SOURCE_SCREENED_OPTIONS)}
          <Field label="889 Designation (OM) *" valid={!!form.designation889.trim()}>
            <select className="select" value={form.designation889} onChange={(e) => set("designation889", e.target.value)}>
              <option value="">— select —</option>
              {DESIGNATION_889_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>

          {/* Ship to */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Shipping</div>
          {selectField("finalDeliveryOutsideUs", "Final Delivery Location Outside United States?", FINAL_DELIVERY_OUTSIDE_US_OPTIONS)}

          {/* Filing */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Filing</div>
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

        {/* SAM.gov 889 representation lookup — confirm the vendor's FAR
            52.204-26 status now; the verdict is attached to the saved record. */}
        <div className="field" style={{ marginTop: "var(--s4)" }}>
          <label>889 representation (SAM.gov lookup)</label>
          <Section889Field vendor={form.vendor} saved={section889} onChange={setSection889} />
        </div>

        <div className="field" style={{ marginTop: "var(--s4)" }}>
          <label>Notes</label>
          <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. 889 status, missing docs." />
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
            {/* Column headers, matching the US Bank line-item grid */}
            <div className="row" style={{ gap: "var(--s2)", fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              <span style={{ flex: 3 }}>Item Description *</span>
              <span style={{ flex: 1 }}>Qty</span>
              <span style={{ flex: 1 }}>Unit Cost</span>
              <span style={{ flex: 1 }}>Line Item Total *</span>
              <span style={{ width: 40, flex: "0 0 auto" }} aria-hidden />
            </div>
            {form.lineItems.map((li, i) => (
              <div key={i} className="row" style={{ gap: "var(--s2)" }}>
                <input className="input" style={{ flex: 3 }} aria-label="Item description" value={li.description} onChange={(e) => setLineItem(i, { description: e.target.value })} />
                <input className="input mono" style={{ flex: 1 }} aria-label="Quantity" value={li.quantity ?? ""} onChange={(e) => setLineItem(i, { quantity: e.target.value || null })} />
                <input className="input mono" style={{ flex: 1 }} aria-label="Unit cost" value={li.unitPrice ?? ""} onChange={(e) => setLineItem(i, { unitPrice: e.target.value || null })} />
                <input className="input mono" style={{ flex: 1 }} aria-label="Line item total" value={li.total ?? ""} onChange={(e) => setLineItem(i, { total: e.target.value || null })} />
                <button className="btn btn-ghost" style={{ width: 40, height: 40, padding: 0, flex: "0 0 auto" }} aria-label="Remove line item" onClick={() => set("lineItems", form.lineItems.filter((_, idx) => idx !== i))}>
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mandatory authorization + supporting documents */}
      <MandatoryAuthCard
        recordId={recordId}
        hasReceiptImage={!!draft.imageUri}
        value={form.mandatoryAuth}
        attachments={form.attachments}
        onChange={(v) => set("mandatoryAuth", v)}
        onAttachmentsChange={(a) => set("attachments", a)}
      />

      {/* Raw OCR */}
      <div className="card">
        <details className="collapsible">
          <summary>Raw extracted text ({draft.rawText.length.toLocaleString()} chars)</summary>
          <pre className="code" style={{ marginTop: "var(--s3)" }}>{draft.rawText || "(empty)"}</pre>
        </details>
      </div>

      {/* Discard is destructive — push it well clear of Save so it can't be hit by mistake. */}
      <div className="row wrap">
        <button className="btn btn-primary btn-lg" onClick={save}>Save record</button>
        <div className="spacer" />
        <Link to="/scan" className="btn btn-ghost btn-lg">Discard</Link>
      </div>

      {zoom && draft.imageUri && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Uploaded document" onClick={() => setZoom(false)}>
          <img src={draft.imageUri} alt="Uploaded document" />
        </div>
      )}
    </div>
  );
}
