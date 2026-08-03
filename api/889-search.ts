// /api/889-search — serverless proxy to the GSA SmartPay "889 Representations"
// tool (GSA/889-tool), which wraps the openGSA SAM.gov Entity Management API.
//
// Why a proxy: the SmartPay API only allows CORS from localhost:5173 and its
// own domain, so a deployed browser can't call it directly. It needs no secret
// of ours — the public SmartPay deployment carries its own SAM.gov key — so this
// just forwards the vendor query and returns the candidate entities (with the
// `samToolsData.eightEightNine` 889-compliance block appended per vendor).
//
// PII NOTE: this is public SAM.gov entity-registration data only — vendor names,
// UEI/CAGE, registration status, and FAR 52.204-26 representations. No GPC PII.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { build889Query, SAM_889_ENTITIES_PATH } from "../src/lib/section889.js";

const SAM_TOOL_BASE =
  process.env.SAM_889_BASE ?? "https://889.smartpay.gsa.gov";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed", message: "Use GET." });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.status(400).json({ error: "bad_request", message: "Missing ?q= vendor query." });
    return;
  }

  // Query contract (term cap, sections, active-only) lives in lib/section889 —
  // shared with the dev direct-call path so the two can't drift.
  const url = `${SAM_TOOL_BASE}${SAM_889_ENTITIES_PATH}?${build889Query(q).toString()}`;

  try {
    const upstream = await fetch(url, { headers: { Accept: "application/json" } });
    if (!upstream.ok) {
      res.status(502).json({
        error: "upstream_failed",
        message: `SAM.gov 889 lookup failed (${upstream.status}).`,
      });
      return;
    }
    const body = (await upstream.json()) as { entityData?: unknown[] };
    res.status(200).json({ entityData: body.entityData ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("889 lookup proxy failed:", message);
    res.status(502).json({ error: "proxy_failed", message });
  }
}
