// Client side of the US Bank order handoff. Talks ONLY to Nexus's own
// /api/usbank-order proxy (never the clone directly) — the proxy holds the
// credentials and runs the create → match → upload chain. Pure transport; the
// payload is built by toUsBankOrder in usbankOrder.ts and the documents by
// buildUsBankDocuments in usbankDocuments.ts.

import type { UsBankOrderPayload } from "./usbankOrder";

export type UsBankDocument = { filename: string; contentType: string; dataBase64: string };

export type CreatedOrder = {
  controlNumber: string;
  merchantName: string;
  amount: number;
  /** The statement line the order was auto-matched to, if matching ran. */
  matched: { merchant: string; amount: number; transDate: string } | null;
  documentsUploaded: number;
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      documents: opts.documents ?? [],
      autoMatch: opts.autoMatch ?? true,
      accessToken: opts.accessToken,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    order?: { controlNumber?: string; merchantName?: string; amount?: number };
    matched?: { merchant?: string; amount?: number; transDate?: string } | null;
    documentsUploaded?: number;
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
  };
}
