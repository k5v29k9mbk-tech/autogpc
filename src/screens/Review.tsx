import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { newId, useStore } from "../store";
import { missingRequired, recordFromDraft, seedEdits, type RecordEdits } from "../core/draft";
import { displayName, useAuth } from "../auth";
import {
  DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS,
  ETO_OPTIONS,
  FINAL_DELIVERY_OUTSIDE_US_OPTIONS,
  GPC_CURRENCIES,
  PREPURCHASE_APPROVALS_OPTIONS,
  REQUEST_TO_PURCHASE_OPTIONS,
  REQUIRED_SOURCE_SCREENED_OPTIONS,
  SECTION_508_OPTIONS,
  SPECIAL_PRE_APPROVAL_OPTIONS,
  SPEND_ANALYSIS_OPTIONS,
} from "../lib/usbankOrder";
import { toUsBankOrder } from "../lib/usbankOrder";
import { submitUsBankOrder, type CreatedOrder } from "../lib/usbankClient";
import { buildUsBankDocuments } from "../lib/usbankDocuments";
import { USBANK_ENABLED, UsBankOrderResult } from "../components/UsBankOrderCard";
import { Field, SelectField } from "../components/ui";
import { confidenceBucket } from "../lib/format";
import { Section889Field } from "../components/Section889Field";
import { MandatoryAuthCard } from "../components/MandatoryAuthCard";
import { IconEye, IconTrash } from "../components/icons";
import {
  DESIGNATION_889_OPTIONS,
  DOC_TYPE_LABELS,
  DOC_TYPE_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  type DocType,
  type LineItem,
  type RecordStatus,
} from "../core/types";

// The review form is exactly the set of fields a reviewer confirms before save.
type Form = RecordEdits;

const CURRENCIES = ["", ...GPC_CURRENCIES];

export function Review() {
  const { draft, setDraft, addRecord, deleteAttachment, resolveImage } = useStore();
  const { user, mode, getAccessToken } = useAuth();
  const navigate = useNavigate();

  // The record's id, fixed up front so supporting documents uploaded during
  // review are keyed to it (and carried onto the record at save).
  const [recordId] = useState(newId());

  // All seed defaults live in core/draft (seedEdits) — the screen just renders.
  const [form, setForm] = useState<Form>(() =>
    seedEdits(draft, {
      cardholderName: displayName(user),
      dutyStationOconus: user?.dutyStationOconus,
    }),
  );

  // Required-field validation surfaced on a failed save attempt.
  const [missing, setMissing] = useState<string[]>([]);
  // Storage/network failures on save — otherwise the button silently does nothing.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Save also pushes the order to US Bank (create → match → attach). These hold
  // the outcome: the record is already saved either way, so a failed push shows
  // the reason and hands off to the record's manual card instead of blocking.
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState<CreatedOrder | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

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

  // Leaving the outcome screen is what finally clears the draft — until then the
  // screen has to stay mounted (a null draft redirects to /scan). Declared above
  // the outcome screen that calls it: a `const` below would still be in its TDZ
  // when those buttons fire, and they'd throw instead of navigating.
  const finish = (to: string) => {
    setDraft(null);
    navigate(to);
  };

  // Post-save outcome: the record is stored and the US Bank push has run.
  if (pushed || pushError) {
    return (
      <div className="stack" style={{ gap: "var(--s5)" }}>
        <div className="page-head">
          <div className="eyebrow">Saved</div>
          <h1>Record saved</h1>
        </div>
        {pushed && (
          <UsBankOrderResult result={pushed} currency={(form.currency || "USD").toUpperCase()} />
        )}
        {pushError && (
          <div className="card">
            <div className="card-title">Send to US Bank order</div>
            <div className="alert alert-error" role="alert">
              <div>
                The record saved, but the US Bank order failed: {pushError} Open the record and use
                “Create, match &amp; attach in US Bank” to retry.
              </div>
            </div>
          </div>
        )}
        <div className="row wrap">
          <button className="btn btn-primary btn-lg" onClick={() => finish("/records")}>Done</button>
          <button className="btn btn-ghost btn-lg" onClick={() => finish(`/records/${recordId}`)}>
            Open record
          </button>
        </div>
      </div>
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setLineItem = (i: number, patch: Partial<LineItem>) =>
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => (idx === i ? { ...li, ...patch } : li)),
    }));

  // The required US Bank dropdowns all render the same way (ui.tsx SelectField);
  // this just binds one to its form key.
  type UsBankSelectKey =
    | "specialPreApproval"
    | "delegatedProcurementAuthority"
    | "prePurchaseApprovals"
    | "section508Consideration"
    | "requestToPurchaseReceived"
    | "spendAnalysis"
    | "requiredSourceScreened"
    | "finalDeliveryOutsideUs";
  const usBankSelect = (key: UsBankSelectKey, label: string, options: readonly string[]) => (
    <SelectField label={label} required value={form[key]} onChange={(v) => set(key, v)} options={options} />
  );

  const save = async () => {
    // The required-field policy (US Bank's red asterisks) lives in core/draft.
    const gaps = missingRequired(form);
    if (gaps.length) {
      setMissing(gaps);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setMissing([]);
    setSaveError(null);
    setSaving(true);
    const record = recordFromDraft(draft, form, { id: recordId });
    try {
      await addRecord(record, draft.imageBlob);
    } catch (e) {
      console.error("Save failed", e);
      setSaveError(e instanceof Error ? e.message : JSON.stringify(e));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    } finally {
      setSaving(false);
    }

    // Guests, and builds without the proxy, have nothing to push to — the
    // record's detail page still carries the manual card.
    if (!(USBANK_ENABLED && mode === "authenticated")) {
      setDraft(null);
      navigate("/records");
      return;
    }

    // Auto-push: create the order, match it to its statement, attach the docs.
    // The record is already saved, so a failure here is reported, not fatal.
    setPushing(true);
    try {
      const accessToken = await getAccessToken();
      const documents = await buildUsBankDocuments(record, resolveImage);
      const { payload } = toUsBankOrder(record, {
        requestorName: record.requestorName.trim() || displayName(user),
      });
      setPushed(await submitUsBankOrder(payload, { documents, autoMatch: true, accessToken }));
    } catch (e) {
      console.error("US Bank order failed", e);
      setPushError(e instanceof Error ? e.message : "Could not create the US Bank order.");
    } finally {
      setPushing(false);
    }
  };

  const discard = async () => {
    // Supporting documents were already uploaded to storage during review,
    // keyed to a record id that will now never exist — remove them so they
    // don't orphan. Best-effort: a failed delete shouldn't trap the user here.
    await Promise.allSettled(form.attachments.map((a) => deleteAttachment(a.uri)));
    setDraft(null);
    navigate("/scan");
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

      {saveError && (
        <div className="alert alert-error">
          <div>Could not save the record: {saveError}</div>
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
          {usBankSelect("specialPreApproval", "Special Pre-Approval Obtained", SPECIAL_PRE_APPROVAL_OPTIONS)}
          {usBankSelect("delegatedProcurementAuthority", "Delegated Procurement Authority Used", DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS)}
          {usBankSelect("prePurchaseApprovals", "A/BO and/or RM/FM Pre-Purch Approvals Obtained", PREPURCHASE_APPROVALS_OPTIONS)}
          {usBankSelect("section508Consideration", "Items Subject to Section 508 Consideration?", SECTION_508_OPTIONS)}
          {usBankSelect("requestToPurchaseReceived", "Request to Purchase Received", REQUEST_TO_PURCHASE_OPTIONS)}
          {usBankSelect("spendAnalysis", "Spend Analysis", SPEND_ANALYSIS_OPTIONS)}
          <SelectField
            label="Emergency-Type Operation (OM) *"
            value={form.emergencyTypeOperation}
            onChange={(v) => set("emergencyTypeOperation", v)}
            options={ETO_OPTIONS}
          />

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
          {usBankSelect("requiredSourceScreened", "Required Source Screened", REQUIRED_SOURCE_SCREENED_OPTIONS)}
          <SelectField
            label="889 Designation (OM)"
            required
            value={form.designation889}
            onChange={(v) => set("designation889", v)}
            options={DESIGNATION_889_OPTIONS}
          />

          {/* Ship to */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Shipping</div>
          {usBankSelect("finalDeliveryOutsideUs", "Final Delivery Location Outside United States?", FINAL_DELIVERY_OUTSIDE_US_OPTIONS)}

          {/* Filing */}
          <div className="stat-label" style={{ gridColumn: "1 / -1", marginTop: "var(--s2)" }}>Filing</div>
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

        {/* SAM.gov 889 representation lookup — confirm the vendor's FAR
            52.204-26 status now; the verdict is attached to the saved record. */}
        <div className="field" style={{ marginTop: "var(--s4)" }}>
          <label>889 representation (SAM.gov lookup)</label>
          <Section889Field
            vendor={form.vendor}
            saved={form.section889}
            onChange={(v) => set("section889", v)}
          />
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
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving || pushing}>
          {saving ? "Saving…" : pushing ? "Sending to US Bank…" : "Save record"}
        </button>
        <div className="spacer" />
        <button className="btn btn-ghost btn-lg" onClick={discard}>Discard</button>
      </div>

      {zoom && draft.imageUri && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Uploaded document" onClick={() => setZoom(false)}>
          <img src={draft.imageUri} alt="Uploaded document" />
        </div>
      )}
    </div>
  );
}
