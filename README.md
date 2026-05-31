# Nexus

**Receipt OCR for GPC cardholders.** Upload a receipt, invoice, quote, or PDF;
Nexus reads it in the browser, extracts the key fields, lets you review and
correct them, and produces a clean structured summary for **manual** GPC / US
Bank entry — turning a ~12-minute order into under a minute.

> **This prototype does not connect to US Bank, PIEE, or any government system.
> It only demonstrates receipt OCR, field extraction, review, and structured
> export.**

This is a **Sprint 1 persuasion demo**, not a production MVP. Its job is to make
the time savings *visible and felt*. Everything runs **client-side** — no
backend, no API key, no database, no login.

---

## What it does

- **Routes by document type** to the right open-source engine, all in-browser:
  - **Native PDFs** (vendor quotes/invoices with a real text layer) → text is
    extracted directly with `pdfjs-dist`. **No OCR. Instant and exact.**
  - **Images** (thermal/scanned receipts) → canvas **preprocessing**
    (grayscale → upscale → contrast → Otsu binarize) then **Tesseract.js** OCR.
  - **Fallback** → instant **mock** results so a demo never dead-ends.
- **Structures raw text into fields** with a pure, tested regex parser
  (`parseReceipt`): vendor, date (US/EU/ISO formats), total, currency, tax/VAT,
  card last-4, receipt/invoice number, and line items. It prefers `null` over a
  wrong guess — the review screen is there to fix gaps.
- **Makes the savings tangible:** a live capture timer, a "Captured in 0:38"
  confirmation with the ~12-min manual contrast, and a cumulative time-saved
  counter on Home.
- **Persists locally:** record index in `localStorage`, image blobs in
  `IndexedDB`. Survives reload. Seeded with five scrubbed sample records on
  first launch.
- **Exports** a copy-pasteable structured summary and JSON. **No automated
  submission anywhere.**

---

## Run locally

Requirements: Node 18+ (built and tested on Node 24).

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check + production build to dist/
npm run preview      # serve the production build locally
npm test             # run the parseReceipt unit tests (Vitest)
npm run gen:logo     # regenerate the logo assets in public/ (only if the source mark changes)
```

---

## Deploy to Vercel (zero configuration)

The live demo needs **no env vars and no server**.

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **New Project → import the repo**. The Vite preset is detected
   automatically (build `npm run build`, output `dist`).
3. **Deploy.** That's it — the live URL works entirely client-side.

`vercel.json` contains only an SPA rewrite (all routes → `index.html`) so deep
links like `/records/<id>` resolve.

**Build gotchas — already handled and verified:**

- **pdfjs worker:** imported with Vite's `?url` suffix
  (`pdfjs-dist/build/pdf.worker.min.mjs?url`), so the worker file always matches
  the installed version and is emitted as a hashed asset in both `dev` and the
  production build.
- **Tesseract.js:** its worker, WASM core, and language data (`eng+deu`) are
  fetched from a CDN on first use and cached by the browser thereafter. No
  bundling config required. The production build was verified to serve all
  assets (not just `dev`).

---

## How to test

**With the seeded samples (fastest):**

- On **Home** you'll see the time-saved counter and recent records already
  populated.
- Go to **Scan / Upload → "Or try a sample document"** and pick any of the four.
  Each runs through the real pipeline (mock canned text for the samples), lands
  on the **Review** screen with fields auto-filled and the capture timer
  running, and saves to **Records**.

**With a real document (proves the OCR/PDF paths):**

- **A real receipt photo (image):** Scan / Upload → drop a JPG/PNG of a receipt
  → **Extract**. Watch the "reading…" progress; this is Tesseract running
  locally. Quality depends heavily on lighting/skew — that's expected, and the
  review screen is where you correct it. _First run downloads the OCR model
  (~a few MB) from a CDN; subsequent runs are cached._
- **A real text-based PDF (vendor quote/invoice):** Scan / Upload → choose a
  PDF that was generated digitally (not a scan) → **Extract**. It should be
  near-instant and exact, and the record is tagged **"PDF text layer."**
- Verify **search/filter** on Records, **edit/delete** and **status
  transitions** on Record Detail, **Copy summary / Copy JSON / Download JSON**,
  and that everything **persists across a page reload**.

To reset the demo to a clean seeded state, clear the site's storage
(DevTools → Application → Clear storage) and reload.

---

## What is real vs. mocked

| Capability | Status |
| --- | --- |
| Native-PDF text extraction (`pdfjs-dist`) | **Real** |
| Image preprocessing + Tesseract.js OCR | **Real**, in-browser |
| Field parser (`parseReceipt`) | **Real**, pure + unit-tested |
| Capture timer + time-saved math | **Real**, measured |
| Local persistence (localStorage + IndexedDB) | **Real** |
| Export (structured text + JSON) | **Real** |
| Mock provider / seeded samples | **Mocked** (canned text, scrubbed values) |
| Handwritten VAT-form extraction | **Mocked** — open-source OCR reads handwriting poorly, so the sample is backed by mock text + explicit fields. Flagged as an upgrade-tier capability. |
| Scanned PDF (no text layer) | Falls back to **mock** in Sprint 1 (rasterize-then-OCR is a Sprint 2 item) |
| Cloud extractor (`cloudExtractionService`) | **Stub only** — documented, not implemented |
| US Bank / PIEE / gov login / submission | **Not built** (by design) |

### Data handling / PII

The real source documents contain PII (names, `.mil` emails, CAGE codes, card
last-4). **All seeded demo data uses scrubbed/synthetic values** — see
`src/core/extraction/mockService.ts` and `src/data/sampleData.ts`. Because
Sprint 1 is fully client-side, **no document ever leaves the browser**; the only
network fetch is the open-source OCR model from a CDN (the document is processed
locally). This client-side privacy posture is a genuine advantage of the
open-source path.

---

## Architecture

```
src/
  core/                         UI-free, platform-agnostic (reusable by a future iOS shell)
    types.ts                    domain model
    parseReceipt.ts (+ .test)   raw text -> fields (the primary structurer)
    preprocessImage.ts          canvas grayscale/upscale/contrast/binarize
    storage.ts                  RecordStore interface
    extraction/
      extractionService.ts      the swappable engine interface
      pdfTextService.ts         native-PDF text layer        (real)
      tesseractService.ts       preprocessing + OCR          (real)
      mockService.ts            canned results + sample text (mock)
      cloudExtractionService.ts INTERFACE STUB ONLY          (Sprint 2)
      extractionRouter.ts       pdf-text -> tesseract -> mock
  storage/webStorage.ts         web impl (localStorage + IndexedDB)
  data/                         scrubbed sample records + generated SVG thumbnails
  lib/                          formatting, time-saved math, export, pdf thumbnail
  components/  screens/  store.tsx
```

The router calls whichever `ExtractionService` fits the input; **the UI never
knows which engine ran.** That seam is the whole point: a cloud extractor drops
in behind the same `extract()` signature without touching a single screen.

The **core/** and **storage interface** are deliberately UI-free so a future
Expo / React Native shell can reuse them; only `webStorage.ts`,
`preprocessImage` (canvas), and `pdfThumbnail` are web-specific.

---

## Upgrade path — cloud extraction (Sprint 2, **not built now**)

When accuracy needs to jump — especially for faded thermal receipts and the
handwritten NATO SOFA *Abwicklungsschein* VAT-relief forms — implement
`cloudExtractionService` behind a **`/api/extract` Vercel serverless function**:

```
client ──ExtractionService.extract()──▶ /api/extract (serverless)
                                            │ holds the provider key in
                                            ▼ Vercel env vars (client never sees it)
                                         AWS Textract  AnalyzeExpense
```

**Lead option: AWS Textract `AnalyzeExpense`.** Purpose-built for
receipts/invoices; returns normalized vendor/total/tax/date + line items (so it
populates `fields` directly and `parseReceipt` becomes a fallback), handles
handwriting, and — decisive for a government tool — has **FedRAMP High in AWS
GovCloud and a DoD Impact Level path.** A vision LLM is the more flexible
alternative but has a weaker compliance story for real PII. The client keeps
calling `extractionService`; only the function carries the secret.

---

## Limitations

- **Handwriting / forms:** open-source OCR reads these poorly; the VAT-form
  sample is mock-backed. This is the strongest case for the cloud upgrade.
- **Thermal/scanned image accuracy** varies with photo quality; preprocessing
  helps but is not magic. Review-and-correct is the intended workflow.
- **Scanned PDFs** (image-only, no text layer) fall back to mock — no
  rasterize-then-OCR yet.
- **Line-item parsing** is conservative (under-extracts on purpose).
- **Deskew** is intentionally omitted from preprocessing (lowest-yield,
  artefact-prone).
- **Camera capture** uses the native file input's `capture` hint rather than a
  full `getUserMedia` viewfinder.
- Storage is per-browser/per-device (no sync).

---

## What Sprint 2 should be

1. **Cloud extractor** behind `cloudExtractionService` via `/api/extract`
   (AWS Textract `AnalyzeExpense` as the lead), **benchmarked** against the
   open-source path on the sample set.
2. **Richer line-item + VAT-form extraction** (incl. the handwritten forms).
3. A **real document-upload + checklist flow** (multiple docs per record).
4. An optional **Expo / iOS shell** reusing `core/` and the storage interface.
5. A polished **"export package"** for manual entry.

Still **no** live US Bank / PIEE integration.

---

## Tech

React + Vite + TypeScript · `pdfjs-dist` · `tesseract.js` · React Router ·
Vitest. Typography: IBM Plex Sans (UI) + IBM Plex Mono (data/readouts). Design:
"calm dark, audit-ready" warm charcoal, one restrained green reserved for
validation, cream as the single bold fill (echoes the hawk mark).
