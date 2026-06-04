// "Create order in US Bank" action for a record. Maps the record to the clone's
// order payload (toUsBankOrder), shows the required fields + warnings, makes the
// reviewer confirm the Emergency-Type Operation, then POSTs via Nexus's proxy.
//
// Gated by VITE_USBANK_ENABLED so the action only appears where the proxy and
// credentials are configured.

import { useMemo, useState } from "react";
import { DEFAULT_ETO, toUsBankOrder } from "../lib/usbankOrder";
import { submitUsBankOrder } from "../lib/usbankClient";
import { formatAmount } from "../lib/format";
import type { PurchaseRecord } from "../core/types";
import { IconAlert, IconCheck } from "./icons";

export const USBANK_ENABLED = import.meta.env.VITE_USBANK_ENABLED === "true";
const APP_URL = import.meta.env.VITE_USBANK_APP_URL;
const ETO_OPTIONS = ["Not in support of ETO", "In Support of ETO"];

export function UsBankOrderCard({ record }: { record: PurchaseRecord }) {
  const [requestor, setRequestor] = useState("");
  const [eto, setEto] = useState(DEFAULT_ETO);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ controlNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo(
    () => toUsBankOrder(record, { requestorName: requestor }),
    [record, requestor],
  );

  // Requestor is auto-resolved by the proxy from the cardholder, so drop that
  // warning; the rest (currency, line items, ETO, 889) are worth showing.
  const warnings = draft.warnings.filter((w) => !w.toLowerCase().includes("requestor"));
  const blocked = !draft.payload.merchantName || draft.payload.amount <= 0;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await submitUsBankOrder(draft.payload);
      setResult({ controlNumber: created.controlNumber });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">Send to US Bank order</div>

      {result ? (
        <div className="stack" style={{ gap: "var(--s3)" }}>
          <div className="alert alert-success">
            <IconCheck width={16} height={16} />
            <div>
              Order created in US Bank — Control Number <strong>{result.controlNumber}</strong>.
            </div>
          </div>
          {APP_URL && (
            <a className="btn btn-sm btn-ghost" href={APP_URL} target="_blank" rel="noreferrer" style={{ width: "fit-content" }}>
              Open in US Bank →
            </a>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: "var(--s4)" }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Creates an Open order on the cardholder's account. Merchant, amount, date, and line
            items come from this record; the requestor defaults to the signed-in cardholder.
          </p>

          {/* What will be sent */}
          <dl className="kv">
            <dt>Merchant</dt>
            <dd>{draft.payload.merchantName || "—"}</dd>
            <dt>Amount</dt>
            <dd>{formatAmount(record.totalAmount, record.currency)}</dd>
            <dt>Order date</dt>
            <dd>{draft.payload.orderDate ?? "today"}</dd>
            <dt>Line items</dt>
            <dd>{draft.payload.lineItems.length}</dd>
          </dl>

          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="usbank-requestor">Requestor name</label>
              <input
                id="usbank-requestor"
                className="input"
                value={requestor}
                onChange={(e) => setRequestor(e.target.value)}
                placeholder="Auto: signed-in cardholder"
              />
            </div>
            <div className="field">
              <label htmlFor="usbank-eto">Emergency-Type Operation</label>
              <select id="usbank-eto" className="select" value={eto} onChange={(e) => setEto(e.target.value)}>
                {ETO_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="alert">
              <IconAlert width={16} height={16} />
              <div>
                <strong>Before submitting:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>
                  {warnings.map((w, i) => (
                    <li key={i} style={{ fontSize: 13 }}>{w}</li>
                  ))}
                </ul>
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
              {submitting ? "Creating order…" : "Create order in US Bank"}
            </button>
            {blocked && (
              <span className="muted" style={{ fontSize: 12 }}>
                Needs a merchant name and an amount &gt; 0.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
