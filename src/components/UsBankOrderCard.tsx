// "Create order in US Bank" action for a record. Maps the record to the clone's
// order payload (toUsBankOrder), surfaces the fields US Bank *requires* on the
// Create-Order form, makes the reviewer confirm the Emergency-Type Operation,
// then POSTs via Nexus's proxy.
//
// Gated by VITE_USBANK_ENABLED so the action only appears where the proxy and
// credentials are configured.

import { useMemo, useState } from "react";
import { toUsBankOrder } from "../lib/usbankOrder";
import { submitUsBankOrder, type CreatedOrder } from "../lib/usbankClient";
import { buildUsBankDocuments } from "../lib/usbankDocuments";
import { missingRequiredDocs } from "../core/mandatoryAuth";
import { formatAmount } from "../lib/format";
import { displayName, useAuth } from "../auth";
import { useStore } from "../store";
import type { PurchaseRecord } from "../core/types";
import { Section889Field } from "./Section889Field";
import { IconAlert, IconCheck } from "./icons";

export const USBANK_ENABLED = import.meta.env.VITE_USBANK_ENABLED === "true";
const APP_URL = import.meta.env.VITE_USBANK_APP_URL;

/** Deep link to the order in the clone's Access Online UI. The clone routes on
 *  the hash (`#/orders/view/<controlNumber>`), so drop whatever hash the env var
 *  carries and address the order itself — `#/orders` is not a route and silently
 *  falls back to the dashboard, which is why an order looked unreachable. */
export function usBankOrderUrl(controlNumber?: string): string | null {
  if (!APP_URL) return null;
  const base = String(APP_URL).split("#")[0];
  return controlNumber
    ? `${base}#/orders/view/${encodeURIComponent(controlNumber)}`
    : `${base}#/orders/manage`;
}

export function UsBankOrderCard({ record }: { record: PurchaseRecord }) {
  const { user, getAccessToken } = useAuth();
  const { updateRecord, resolveImage } = useStore();

  // Requestor defaults to the signed-in cardholder's name; the reviewer can
  // override. `null` means "untouched" so the default keeps tracking the user
  // until they type something.
  const cardholderName = displayName(user);
  // Seed from what the reviewer saved on the record; fall back to sensible
  // defaults. Still editable here as a last-minute override before submit.
  const [requestorEdit, setRequestorEdit] = useState<string | null>(null);
  const requestor = requestorEdit ?? (record.requestorName.trim() || cardholderName);

  // ETO and currency were confirmed on Review and live on the record — shown
  // here read-only rather than re-asked (two answers to one question drift).
  const eto = record.emergencyTypeOperation;
  const currency = (record.currency || "USD").toUpperCase();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreatedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo(
    () => toUsBankOrder(record, { requestorName: requestor }),
    [record, requestor],
  );

  // Requestor now has a default, so only warn when it's genuinely empty.
  const warnings = draft.warnings;
  const blocked = !draft.payload.merchantName || draft.payload.amount <= 0 || !requestor.trim();

  // Supporting documents the record should carry (GPC purchase request, VAT,
  // memo, approvals) that aren't attached yet. A reminder only — never blocks
  // the order, since the cardholder may attach them in US Bank themselves.
  const missingDocs = missingRequiredDocs(record);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const documents = await buildUsBankDocuments(record, resolveImage);
      const created = await submitUsBankOrder(draft.payload, { documents, autoMatch: true, accessToken });
      setResult(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <UsBankOrderResult result={result} currency={currency} />;

  return (
    <div className="card">
      <div className="card-title">Send to US Bank order</div>
      <div className="stack" style={{ gap: "var(--s4)" }}>
        <p className="muted" style={{ fontSize: 13 }}>
          The fields US Bank requires, filled from this record. Confirm them, then create the order,
          match it to its statement, and attach the receipt — in one step, on the cardholder's account.
        </p>

        {/* Required fields, mirroring the US Bank Create-Order form */}
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="usbank-requestor">Requestor name *</label>
            <input
              id="usbank-requestor"
              className="input"
              value={requestor}
              onChange={(e) => setRequestorEdit(e.target.value)}
              placeholder="Cardholder first and last name"
            />
          </div>
        </div>

        <dl className="kv">
          <dt>Emergency-Type Operation *</dt>
          <dd>{eto}</dd>

          <dt>Merchant name *</dt>
          <dd>{draft.payload.merchantName || <span className="muted">— add the vendor —</span>}</dd>

          <dt>Amount *</dt>
          <dd className="row" style={{ gap: "var(--s2)", alignItems: "center" }}>
            <span className="mono">{formatAmount(record.totalAmount, currency)}</span>
            <span className="muted" style={{ fontSize: 12 }}>{currency}</span>
          </dd>

          <dt>Order date *</dt>
          <dd className="mono">{draft.payload.orderDate ?? "today"}</dd>

          <dt>Total tax *</dt>
          <dd className="mono">{formatAmount(record.taxAmount ?? "0", currency)}</dd>
        </dl>

        {/* Line items, in US Bank's column order */}
        <div className="stack" style={{ gap: 6 }}>
          <div className="label-row" style={{ fontSize: 13, fontWeight: 600 }}>
            Line items ({draft.payload.lineItems.length})
          </div>
          {draft.payload.lineItems.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No line items extracted.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>Item Description</th>
                  <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: "right", width: 56 }}>Qty</th>
                  <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: "right", width: 96 }}>Unit Cost</th>
                  <th style={{ padding: "4px 0 4px 8px", fontWeight: 500, textAlign: "right", width: 96 }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {draft.payload.lineItems.map((li, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "4px 8px 4px 0" }}>{li.description || "—"}</td>
                    <td className="mono" style={{ padding: "4px 8px", textAlign: "right" }}>
                      {li.qty ?? "—"}
                    </td>
                    <td className="mono" style={{ padding: "4px 8px", textAlign: "right" }}>
                      {li.unitCost != null ? formatAmount(String(li.unitCost), currency) : "—"}
                    </td>
                    <td className="mono" style={{ padding: "4px 0 4px 8px", textAlign: "right" }}>
                      {li.lineTotal != null ? formatAmount(String(li.lineTotal), currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 889 Designation — SAM.gov representation lookup + downloadable record */}
        <div className="stack" style={{ gap: 6 }}>
          <div className="label-row" style={{ fontSize: 13, fontWeight: 600 }}>889 Designation *</div>
          <Section889Field
            vendor={record.vendor}
            saved={record.section889}
            onChange={(value) => updateRecord({ ...record, section889: value })}
          />
        </div>

        {warnings.length > 0 && (
          <div className="alert">
            <IconAlert width={16} height={16} />
            <div>
              <strong>Before submitting:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>
                {warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {missingDocs.length > 0 && (
          <div className="alert">
            <IconAlert width={16} height={16} />
            <div>
              <strong>Not attached yet (optional):</strong> {missingDocs.join(", ")}.
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Upload them in the documents section above so they ride along to US Bank — or add
                them in US Bank yourself later. You can still create the order without them.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert width={16} height={16} />
            <div>{error}</div>
          </div>
        )}

        <label className="row" style={{ gap: "var(--s2)", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I've verified the Emergency-Type Operation (<strong>{eto}</strong>) and the order details.
        </label>

        <div className="row">
          <button
            className="btn btn-primary"
            disabled={!confirmed || submitting || blocked}
            onClick={submit}
          >
            {submitting ? <span className="spinner" /> : null}
            {submitting ? "Working in US Bank…" : "Create, match & attach in US Bank"}
          </button>
          {blocked && (
            <span className="muted" style={{ fontSize: 12 }}>
              Needs a requestor, a merchant name, and an amount &gt; 0.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** What happened in US Bank. Shared by this card and Review's auto-push so the
 *  two paths report the order the same way. */
export function UsBankOrderResult({
  result,
  currency,
}: {
  result: CreatedOrder;
  currency: string;
}) {
  const orderUrl = usBankOrderUrl(result.controlNumber);
  return (
    <div className="card">
      <div className="card-title">Send to US Bank order</div>
      <div className="stack" style={{ gap: "var(--s3)" }}>
        <div className="alert alert-success">
          <IconCheck width={16} height={16} />
          <div>
            <strong>Done in US Bank.</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>
              <li style={{ fontSize: 13 }}>
                Order created — Control Number <strong>{result.controlNumber}</strong>.
              </li>
              <li style={{ fontSize: 13 }}>
                {result.matched ? (
                  <>
                    Matched to statement: {result.matched.merchant} ·{" "}
                    {formatAmount(String(result.matched.amount), currency)}
                    {result.matched.transDate ? ` · ${result.matched.transDate}` : ""}.
                  </>
                ) : (
                  "No statement matched."
                )}
              </li>
              <li style={{ fontSize: 13 }}>
                {result.documentsUploaded > 0
                  ? `${result.documentsUploaded} document${result.documentsUploaded === 1 ? "" : "s"} uploaded to the order.`
                  : "No documents uploaded."}
              </li>
            </ul>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <div className="alert">
            <IconAlert width={16} height={16} />
            <div>
              <strong>Needs a manual follow-up:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>
                {result.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {orderUrl && (
          <a
            className="btn btn-sm btn-ghost"
            href={orderUrl}
            target="_blank"
            rel="noreferrer"
            style={{ width: "fit-content" }}
          >
            Open order {result.controlNumber} in US Bank →
          </a>
        )}
      </div>
    </div>
  );
}
