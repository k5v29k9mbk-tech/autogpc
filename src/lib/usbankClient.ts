// Client side of the US Bank order handoff. Talks ONLY to Nexus's own
// /api/usbank-order proxy (never the clone directly) — the proxy holds the
// credentials and runs the create → match → upload chain. Pure transport; the
// payload is built by toUsBankOrder in usbankOrder.ts and the documents by
// buildUsBankDocuments in usbankDocuments.ts.

import type { UsBankOrderPayload } from "./usbankOrder";

export type UsBankDocument = { filename: string; contentType: string; dataBase64: string };

/**
 * Deep link into the clone's Access Online UI. It routes on the hash, so drop
 * whatever hash VITE_USBANK_APP_URL carries and address the order itself.
 * `#/orders` is NOT one of its routes — it falls through to the dashboard,
 * which is why a created order looked unreachable. Order list: `#/orders/manage`.
 */
export function usBankOrderUrl(
  controlNumber?: string,
  appUrl: string | undefined = import.meta.env.VITE_USBANK_APP_URL,
): string | null {
  if (!appUrl) return null;
  const base = appUrl.split("#")[0];
  return controlNumber
    ? `${base}#/orders/view/${encodeURIComponent(controlNumber)}`
    : `${base}#/orders/manage`;
}

export type CreatedOrder = {
  controlNumber: string;
  merchantName: string;
  amount: number;
  /** The statement line the order was auto-matched to, if matching ran. */
  matched: { merchant: string; amount: number; transDate: string } | null;
  documentsUploaded: number;
  /** Steps that failed AFTER the order was created (match / document upload). */
  warnings: string[];
};

export async function submitUsBankOrder(
  payload: UsBankOrderPayload,
  opts: { documents?: UsBankDocument[]; autoMatch?: boolean; accessToken?: string | null } = {},
): Promise<CreatedOrder> {
  if (!opts.accessToken) {
    throw new Error("Sign in to autogpc before creating a US Bank order.");
  }
  const res = await fetch("/api/usbank-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Bearer token travels as a header, never in the JSON body — request
      // bodies get logged by middleware and error reporters; auth headers are
      // routinely redacted.
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      ...payload,
      documents: opts.documents ?? [],
      autoMatch: opts.autoMatch ?? true,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    order?: { controlNumber?: string; merchantName?: string; amount?: number };
    matched?: { merchant?: string; amount?: number; transDate?: string } | null;
    documentsUploaded?: number;
    warnings?: string[];
    message?: string;
  };
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("US Bank integration isn't running (use the deployed site, not `vite dev`).");
    }
    throw new Error(body.message ?? `Order create failed (${res.status}).`);
  }
  return {
    controlNumber: body.order?.controlNumber ?? "",
    merchantName: body.order?.merchantName ?? payload.merchantName,
    amount: body.order?.amount ?? payload.amount,
    matched: body.matched
      ? {
          merchant: body.matched.merchant ?? payload.merchantName,
          amount: body.matched.amount ?? payload.amount,
          transDate: body.matched.transDate ?? "",
        }
      : null,
    documentsUploaded: body.documentsUploaded ?? 0,
    warnings: body.warnings ?? [],
  };
}
