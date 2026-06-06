# Nexus — Context

Receipt/quote OCR and field extraction for Government Purchase Card (GPC)
cardholders. A captured document is read, structured into fields, reviewed and
corrected by a human, then saved as an audit-ready record for manual GPC entry.

## Language

**Capture**:
The act of bringing a document into Nexus — an uploaded image, a native PDF, or
(future) a camera shot — and the timed session that runs from "Extract" until
the record is saved. The capture timer feeds the time-saved metric.

**Extraction**:
Turning a captured document into raw text plus a best guess at structured
fields. Performed by an **Extraction source** behind the `ExtractionService`
seam.
_Avoid_: parsing (that is one narrow step — see Parser), scanning.

**Extraction source**:
The engine that produced an extraction: `pdf_text` (native PDF text layer),
`tesseract` (in-browser OCR), or `cloud` (future server-side API, e.g. AWS
Textract AnalyzeExpense). The UI never chooses the source — the router does.
_Avoid_: engine, provider, driver.

**Parser**:
The pure regex structurer (`parseReceipt`) that maps raw text to fields. One
implementation behind an extraction source; a fallback once a cloud source
returns fields directly.

**ExtractionResult**:
What an extraction source returns: `fields`, `rawText`, `lineItems`, `source`,
optional `confidence`. The single shape every source emits.

**ReviewDraft**:
The transient, in-flight capture between extraction and save — extracted fields
plus the pending image, inferred DocType, and capture start time. Not yet
persisted; lives only in the store until reviewed.
_Avoid_: form state, temp record.

**PurchaseRecord**:
The saved, audit-ready entity: corrected fields, status, document checklist,
capture timing, timestamps. The thing that persists.
_Avoid_: entry, transaction, purchase.

**DocType**:
What kind of document a capture is — `receipt`, `invoice`, `quote`, `vat_form`,
`other`. Inferred during assembly, correctable on review.

**DocumentChecklist**:
The set of supporting documents a record should carry for audit (receipt,
invoice, quote, approval, other). Derived from DocType, then user-managed.

**Record assembly**:
The UI-free core module (`src/core/draft.ts`) that owns the staged transform
**ExtractionResult → ReviewDraft → PurchaseRecord**: DocType inference,
checklist derivation, and field assembly. Screens call it; they no longer hold
these rules.
_Avoid_: mapper, builder, transformer (use "assembly").

**Time saved**:
The persuasion metric — `MANUAL_BASELINE_SECONDS − captureSeconds`, computed by
`savedSecondsFor` and shown per record (on Review right after save, and on
RecordDetail). The number the demo exists to make felt.

