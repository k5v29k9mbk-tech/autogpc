# Nexus / AutoGPC

**Receipt → audit-ready GPC order.** A cardholder uploads a receipt, invoice, or
PDF; Nexus reads it, extracts the fields, checks the vendor's Section 889
representation in SAM.gov, flags the mandatory-authorization rules that apply,
collects the supporting documents, and hands the finished order to US Bank
Access Online — created, matched to its statement line, documents attached.

> **Prototype.** Not connected to real US Bank, PIEE, or any government system.
> The order handoff targets a US Bank Access Online **test clone**. Commercial
> AWS Textract regions are for synthetic/scrubbed data only — real GPC PII
> requires an AWS GovCloud region under an ATO.

---

## Run it

Node 18+.

```bash
npm install
npm run dev       # http://localhost:5173 — UI only, /api/* returns 404
vercel dev        # UI + the serverless functions (needed for extraction, 889, US Bank)
```

```bash
npm run build     # type-check + production build to dist/
npm test          # 94 unit tests (parser, extraction, US Bank mapping, 889)
npm run typecheck
```

Copy `.env.example` → `.env.local` and fill it in. Every `VITE_`-prefixed value
is **inlined into the browser bundle** — secrets never carry that prefix.

| Variable | Side | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | client | auth + per-user storage |
| `VITE_CLOUD_EXTRACTION` | client | `true` routes extraction to Textract first |
| `TEXTRACT_REGION`, `TEXTRACT_ACCESS_KEY_ID`, `TEXTRACT_SECRET_ACCESS_KEY` | **server** | AWS creds for `/api/extract`. Not named `AWS_*` — Lambda reserves those |
| `VITE_USBANK_ENABLED`, `VITE_USBANK_APP_URL` | client | show the order handoff card + link |
| `USBANK_API_BASE` | **server** | base URL the `/api/usbank-order` proxy talks to |
| `VITE_SSO_ALLOWED_ORIGINS` | client | origins allowed to receive a "Sign in with Nexus" token |

Run [`supabase/migrations/`](supabase/migrations/) in the Supabase SQL editor
once, in order. They create the `records` table and the private `receipts`
bucket, both under owner-only Row-Level Security.

---

## How it works

**Flow.** `/scan` upload → extraction → `/review` correct + attach documents →
`/records/:id` saved record → "Create, match & attach in US Bank".

**Extraction** ([`core/extraction/`](src/core/extraction/)) — the router picks
the engine; the UI never knows which one ran.

1. **Cloud first** (when enabled) → AWS Textract `AnalyzeExpense` via
   [`/api/extract`](api/extract.ts). Reads documents by layout, so it assigns
   vendor / total / tax / line items far more reliably than regex.
2. **Automatic local fallback** — native PDF → real text layer (`pdfjs-dist`,
   instant and exact); scanned PDF → rasterize page 1 at ~300dpi → OCR; image →
   canvas preprocessing (grayscale → upscale → contrast → Otsu binarize) →
   Tesseract.js in WebAssembly, on-device.
3. Failure surfaces an error. It never fabricates a result.

**Field parsing** ([`parseReceipt.ts`](src/core/parseReceipt.ts)) — pure and
unit-tested. US and EU number formats, three date formats, EN/DE keywords.
Cloud fields win; the parser fills gaps. **Design rule throughout: a blank the
reviewer fills beats a confident wrong value.**

Vendor gets three layers of defense, because scanned thermal receipts carry
mirrored bleed-through from the back of the paper that OCRs as gibberish
*above* the real header: a server-side blacklist + shape check + OCR
corroboration gate ([`textractPostProcessor.ts`](api/textractPostProcessor.ts)),
a client-side contact-block anchor, and deterministic overrides for vendors
whose storefront banner is an unreadable logo
([`knownVendors.ts`](src/core/knownVendors.ts)).

**Compliance.**

- **Mandatory Authorization Directory**
  ([`mandatoryAuth.ts`](src/core/mandatoryAuth.ts)) — the Ramstein 700 CONS GPC
  listing as data: 22 item categories with match keywords, the required
  approval, the approving authority + DSN, and the DAFI 64-117 reference, plus
  the >$5,000 equipment rule. Detection is a keyword match the reviewer
  corrects. Each confirmed category adds a document slot the order must carry.
- **Section 889** — [`/api/889-search`](api/889-search.ts) proxies the GSA
  SmartPay 889 tool (openGSA SAM.gov Entity Management API). The cardholder
  confirms the entity; the determination is snapshotted onto the record and a
  "Record of Section 889 Representations" PDF is generated for the order file.
  Nexus never decides compliance — it surfaces what the vendor represented
  under FAR 52.204-26(c).
- **US Bank required fields** ([`usbankOrder.ts`](src/lib/usbankOrder.ts)) —
  every red-asterisk Create-Order dropdown, in US Bank's exact option strings,
  seeded to the standard GPC answer and blocked on save if empty.

**US Bank handoff** ([`api/usbank-order.ts`](api/usbank-order.ts)) — one button
runs SSO token exchange → create order → match to the statement line the clone
spawns → upload the audit summary, receipt, and every attachment. Proxied
server-side because the clone has no CORS and no token belongs in the browser.

**Identity and storage.** Supabase email/password, plus a guest mode with no
backend session (a `sessionStorage` flag that dies with the tab). Authenticated
sessions store rows in Postgres and images in a private bucket; guests stay in
`localStorage` + IndexedDB and nothing is uploaded. **Scoping is enforced by
Row-Level Security, not by the client** — the route guard is UX only. Images
are served as one-hour signed URLs.

---

## Architecture

```
src/
  core/            UI-free, platform-agnostic (reusable by a future iOS shell)
    types.ts             domain model
    draft.ts             ExtractionResult -> ReviewDraft -> PurchaseRecord
    parseReceipt.ts      raw text -> fields
    mandatoryAuth.ts     700 CONS authorization directory as data
    knownVendors.ts      deterministic vendor overrides
    preprocessImage.ts   canvas grayscale/upscale/contrast/binarize
    storage.ts           RecordStore interface
    extraction/          the swappable engine seam + router
  storage/         webStorage (local) | supabaseStore (cloud)
  auth/            AuthContext + Supabase provider behind one interface
  lib/             US Bank mapping, 889 mapping + PDF, export, formatting
  components/  screens/  store.tsx
api/               Vercel serverless: extract, 889-search, usbank-order
supabase/migrations/     schema + RLS policies
```

`core/` and the storage interface are deliberately UI-free so an Expo / React
Native shell can reuse them; only `webStorage`, `preprocessImage`, and the PDF
rasterizer are web-specific.

---

## Limitations

- **Handwriting / VAT-relief forms** (NATO SOFA *Abwicklungsschein*) are the
  weakest path even with Textract.
- **Scanned PDFs: page 1 only.** Multi-page scanned invoices need a loop.
- **Thermal receipt accuracy** varies with photo quality. Review-and-correct is
  the intended workflow, not an admission of failure.
- **Line-item parsing under-extracts on purpose.**
- The **Spend Analysis** option list is truncated to what was legible in the
  source screenshot.
- Mandatory-authorization detection is a keyword match, not a classifier.
- Guest storage is per-browser, per-device, no sync.

## Tech

React 18 · Vite · TypeScript · React Router · Supabase · AWS Textract ·
`pdfjs-dist` · `tesseract.js` · jsPDF · Vitest. Type: IBM Plex Sans + IBM Plex
Mono.
