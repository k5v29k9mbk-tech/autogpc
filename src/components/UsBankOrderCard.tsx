// "Create order in US Bank" action for a record. Maps the record to the clone's
// order payload (toUsBankOrder), surfaces the fields US Bank *requires* on the
// Create-Order form, makes the reviewer confirm the Emergency-Type Operation,
// then POSTs via Nexus's proxy.
//
// Gated by VITE_USBANK_ENABLED so the action only appears where the proxy and
// credentials are configured.

import { useMemo, useState } from "react";
import {
  DEFAULT_ETO,
  ETO_OPTIONS,
  GPC_CURRENCIES,
  toUsBankOrder,
} from "../lib/usbankOrder";
import { submitUsBankOrder } from "../lib/usbankClient";
import { formatAmount } from "../lib/format";
import { useAuth } from "../auth";
import type { PurchaseRecord } from "../core/types";
import { Section889Field } from "./Section889Field";
import { IconAlert, IconCheck } from "./icons";

export const USBANK_ENABLED = import.meta.env.VITE_USBANK_ENABLED === "true";
const APP_URL = import.meta.env.VITE_USBANK_APP_URL;

export function UsBankOrderCard({ record }: { record: PurchaseRecord }) {
  const { user } = useAuth();

  // Requestor defaults to the signed-in cardholder's name; the reviewer can
  // override. `null` means "untouched" so the default keeps tracking the user
  // until they type something.
  const cardholderName = useMemo(
    () =>
      (user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? "").trim(),
    [user],
  );
  // Seed from what the reviewer saved on the record; fall back to sensible
  // defaults. Still editable here as a last-minute override before submit.
  const [requestorEdit, setRequestorEdit] = useState<string | null>(null);
  const requestor = requestorEdit ?? (record.requestorName.trim() || cardholderName);

  const [eto, setEto] = useState<string>(record.emergencyTypeOperation || DEFAULT_ETO);
  const [currency, setCurrency] = useState<string>(
    (record.currency || "USD").toUpperCase(),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ controlNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo(
    () => toUsBankOrder(record, { requestorName: requestor, eto, currency }),
    [record, requestor, eto, currency],
  );

  // Requestor now has a default, so only warn when it's genuinely empty.
  const warnings = draft.warnings;
  const blocked = !draft.payload.merchantName || draft.payload.amount <= 0 || !requestor.trim();

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

  if (result) {
    return (
      <div className="card">
        <div className="card-title">Send to US Bank order</div>
        <div className="stack" style={{ gap: "var(--s3)" }}>
          <div className="alert alert-success">
            <IconCheck width={16} height={16} />
            <div>
              Order created in US Bank — Control Number <strong>{result.controlNumber}</strong>.
            </div>
          </div>
          {APP_URL && (
            <a
              className="btn btn-sm btn-ghost"
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              style={{ width: "fit-content" }}
            >
              Open in US Bank →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Send to US Bank order</div>
      <div className="stack" style={{ gap: "var(--s4)" }}>
        <p className="muted" style={{ fontSize: 13 }}>
          The fields US Bank requires, filled from this record. Confirm them, then create an Open
          order on the cardholder's account.
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
          <div className="field">
            <label htmlFor="usbank-eto">Emergency-Type Operation *</label>
            <select id="usbank-eto" className="select" value={eto} onChange={(e) => setEto(e.target.value)}>
              {ETO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <dl className="kv">
          <dt>Merchant name *</dt>
          <dd>{draft.payload.merchantName || <span className="muted">— add the vendor —</span>}</dd>

          <dt>Amount *</dt>
          <dd className="row" style={{ gap: "var(--s2)", alignItems: "center" }}>
            <span className="mono">{formatAmount(record.totalAmount, currency)}</span>
            <select
              aria-label="Source currency"
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ width: "auto", padding: "2px 6px", fontSize: 12 }}
            >
              {GPC_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
          <Section889Field vendor={record.vendor} />
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
              Needs a requestor, a merchant name, and an amount &gt; 0.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
