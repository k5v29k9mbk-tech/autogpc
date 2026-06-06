// Client side of the US Bank order handoff. Talks ONLY to Nexus's own
// /api/usbank-order proxy (never the clone directly) — the proxy holds the
// credentials and avoids CORS. Pure transport; the payload is built by
// toUsBankOrder in usbankOrder.ts.

import type { UsBankOrderPayload } from "./usbankOrder";

export type CreatedOrder = {
  controlNumber: string;
  merchantName: string;
  amount: number;
};

export async function submitUsBankOrder(payload: UsBankOrderPayload): Promise<CreatedOrder> {
  const res = await fetch("/api/usbank-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    order?: { controlNumber?: string; merchantName?: string; amount?: number };
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
  };
}
