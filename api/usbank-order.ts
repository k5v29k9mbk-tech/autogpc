// /api/usbank-order — Vercel serverless proxy that creates an order in the
// US Bank "Access Online" clone (k5v29k9mbk-tech/usbank-clone).
//
// Why a proxy: the clone has no CORS headers, and we don't want to do the
// token exchange (or hold a bearer token) in the browser. The browser sends the
// signed-in autogpc user's short-lived Supabase access token; this function
// exchanges it for a clone session via the clone's /api/auth/supabase door, so
// the order lands on THAT user's Access Online account (the clone provisions a
// per-user sandbox keyed to the Supabase identity). No shared service login —
// the clone is SSO-only and rejects password logins for provisioned users.
//
// Env (server-only, NOT VITE_):
//   USBANK_API_BASE   e.g. https://test.autogpc.com

import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE = process.env.USBANK_API_BASE;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Use POST." });
    return;
  }
  if (!BASE) {
    res.status(500).json({ error: "config_missing", message: "USBANK_API_BASE is not set." });
    return;
  }

  try {
    // Everything except the two transport-only keys is forwarded verbatim: the
    // clone keeps the whole create-order body in its `details` JSONB, so a field
    // this proxy doesn't name is a field that reads "null" on the order page.
    const { documents, autoMatch, ...order } = (req.body ?? {}) as Record<string, unknown> & {
      merchantName?: string;
      requestorName?: string;
      amount?: number;
      documents?: { filename: string; contentType: string; dataBase64: string }[];
      autoMatch?: boolean;
    };
    const { merchantName, requestorName, amount } = order;
    if (!merchantName) {
      res.status(400).json({ error: "bad_request", message: "merchantName is required." });
      return;
    }
    // Bearer token from the Authorization header — never the JSON body, where
    // it would land in any body-logging middleware or error report.
    const accessToken = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      res.status(401).json({ error: "unauthenticated", message: "Sign in to autogpc first — no access token supplied." });
      return;
    }

    // 1) Exchange the signed-in autogpc user's Supabase token for a clone
    //    session, so everything below acts on THAT user's own account.
    const authRes = await fetch(`${BASE}/api/auth/supabase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    if (!authRes.ok) {
      res.status(502).json({ error: "auth_failed", message: `US Bank SSO exchange failed (${authRes.status}).` });
      return;
    }
    const { token } = (await authRes.json()) as { token?: string };
    if (!token) {
      res.status(502).json({ error: "auth_failed", message: "US Bank SSO exchange returned no token." });
      return;
    }
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

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

    // 3) Create the order. The clone spawns a matching statement line for it
    //    and returns that as `matchSuggestion`.
    const orderRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ...order, requestorName: requestor }),
    });
    const created = (await orderRes.json().catch(() => ({}))) as {
      order?: { controlNumber?: string; merchantName?: string; amount?: number };
      matchSuggestion?: { id?: number; merchant?: string; amount?: number; transDate?: string };
      message?: string;
    };
    if (!orderRes.ok) {
      res.status(502).json({
        error: "order_failed",
        message: created.message ?? `Order create failed (${orderRes.status}).`,
      });
      return;
    }
    // Not `order` — that name already holds the inbound payload (line 33).
    const createdOrder = created.order ?? {};
    const controlNumber = createdOrder.controlNumber;
    const suggestion = created.matchSuggestion;

    // The order exists from here on — later failures are surfaced as warnings
    // on the 201, not silently folded into "no match" / "no documents".
    const warnings: string[] = [];

    // 4) Match the order to the statement line the clone just spawned.
    let matched: { merchant: string; amount: number; transDate: string } | null = null;
    if (autoMatch !== false && controlNumber && suggestion?.id) {
      const matchRes = await fetch(`${BASE}/api/orders/match`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ controlNumber, transactionIds: [suggestion.id] }),
      });
      if (matchRes.ok) {
        matched = {
          merchant: suggestion.merchant ?? merchantName ?? "",
          // Number(amount) is NaN (never nullish) for junk input — || catches it.
          amount: suggestion.amount ?? (Number(amount) || 0),
          transDate: suggestion.transDate ?? "",
        };
      } else {
        warnings.push(`Statement match failed (${matchRes.status}) — match it manually in US Bank.`);
      }
    }

    // 5) Upload supporting documents to the matched order.
    let documentsUploaded = 0;
    if (controlNumber && Array.isArray(documents) && documents.length > 0) {
      const docRes = await fetch(`${BASE}/api/orders/${controlNumber}/documents`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ documents }),
      });
      if (docRes.ok) {
        const docBody = (await docRes.json().catch(() => ({}))) as { count?: number };
        documentsUploaded = docBody.count ?? documents.length;
      } else {
        warnings.push(`Document upload failed (${docRes.status}) — attach them in US Bank.`);
      }
    }

    // `order` here is the clone's created order (control number and all) — the
    // client reads body.order.controlNumber, NOT the payload we sent up.
    res.status(201).json({ ok: true, order: createdOrder, matched, documentsUploaded, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("usbank-order proxy failed:", message);
    res.status(502).json({ error: "proxy_failed", message });
  }
}
