// Client for the Section 889 lookup. Returns the SAM.gov candidates (with the
// SmartPay 889-compliance block) for a vendor name, mapped to Section889Entity.
//
// Two transports, same response shape:
//   - dev  (vite):    call the SmartPay API directly — its CORS allowlist
//                     includes http://localhost:5173, and no serverless
//                     function runs under `vite dev`.
//   - prod (vercel):  call our own /api/889-search proxy (their CORS does NOT
//                     allow the deployed origin).

import {
  build889Query,
  SAM_889_ENTITIES_PATH,
  summarizeEntities,
  type Section889Entity,
  type RawEntity,
} from "./section889";

const SMARTPAY_BASE = "https://889.smartpay.gsa.gov";

function devUrl(vendor: string): string {
  return `${SMARTPAY_BASE}${SAM_889_ENTITIES_PATH}?${build889Query(vendor).toString()}`;
}

export async function search889(vendor: string): Promise<Section889Entity[]> {
  const q = vendor.trim();
  if (!q) return [];

  const url = import.meta.env.DEV ? devUrl(q) : `/api/889-search?q=${encodeURIComponent(q)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Couldn't reach the SAM.gov 889 service. Check your connection and retry.");
  }

  if (res.status === 404) {
    throw new Error("889 lookup isn't available here (use the deployed site).");
  }
  const body = (await res.json().catch(() => ({}))) as {
    entityData?: RawEntity[];
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? `889 lookup failed (${res.status}).`);
  }
  return summarizeEntities(body.entityData ?? []);
}
