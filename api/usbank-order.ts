// /api/usbank-order — Vercel serverless proxy that creates an order in the
// US Bank "Access Online" clone (k5v29k9mbk-tech/usbank-clone).
//
// Why a proxy: the clone has no CORS headers, and we don't want its login
// credentials or bearer token in the browser. This function holds the service
// cardholder credentials (server-side env), logs in, resolves the requestor
// name from the cardholder identity, and POSTs the order.
//
// Env (server-only, NOT VITE_):
//   USBANK_API_BASE   e.g. https://test.autogpc.com
//   USBANK_USERNAME   e.g. mholloway
//   USBANK_PASSWORD   e.g. password123

import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE = process.env.USBANK_API_BASE;
const USERNAME = process.env.USBANK_USERNAME;
const PASSWORD = process.env.USBANK_PASSWORD;

type LineItem = {
  productCode?: string | null;
  description?: string;
  qty?: number | null;
  unitCost?: number | null;
  lineTotal?: number | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Use POST." });
    return;
  }
  if (!BASE || !USERNAME || !PASSWORD) {
    res.status(500).json({
      error: "config_missing",
      message: "USBANK_API_BASE / USBANK_USERNAME / USBANK_PASSWORD are not set.",
    });
    return;
  }

  try {
    const { merchantName, requestorName, amount, orderDate, lineItems } = (req.body ?? {}) as {
      merchantName?: string;
      requestorName?: string;
      amount?: number;
      orderDate?: string;
      lineItems?: LineItem[];
    };
    if (!merchantName) {
      res.status(400).json({ error: "bad_request", message: "merchantName is required." });
      return;
    }

    // 1) Log in to the clone.
    const loginRes = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (!loginRes.ok) {
      res.status(502).json({ error: "login_failed", message: `US Bank login failed (${loginRes.status}).` });
      return;
    }
    const { token } = (await loginRes.json()) as { token?: string };
    if (!token) {
      res.status(502).json({ error: "login_failed", message: "US Bank login returned no token." });
      return;
    }

    // 2) Resolve the requestor from the cardholder identity if not supplied.
    let requestor = (requestorName ?? "").trim();
    if (!requestor) {
      const meRes = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.ok) {
        const me = (await meRes.json()) as { fullName?: string };
        requestor = (me.fullName ?? "").trim();
      }
    }
    if (!requestor) {
      res.status(400).json({ error: "bad_request", message: "Could not resolve a requestor name." });
      return;
    }

    // 3) Create the order.
    const orderRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ merchantName, requestorName: requestor, amount, orderDate, lineItems }),
    });
    const body = (await orderRes.json().catch(() => ({}))) as {
      order?: unknown;
      message?: string;
    };
    if (!orderRes.ok) {
      res.status(502).json({
        error: "order_failed",
        message: body.message ?? `Order create failed (${orderRes.status}).`,
      });
      return;
    }

    res.status(201).json({ ok: true, order: body.order });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("usbank-order proxy failed:", message);
    res.status(502).json({ error: "proxy_failed", message });
  }
}
