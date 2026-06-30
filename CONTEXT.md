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

**Authorization directory**:
The Ramstein 700 CONS "Mandatory Authorization Directory" as data
(`src/core/mandatoryAuth.ts`): item types that need extra approval before a GPC
purchase, each with match keywords, the required doc/approval, and the approval
authority. Detection is a keyword match the reviewer corrects after the fact.
_Avoid_: classifier, rules engine.

**MandatoryAuth**:
A record's authorization state — the confirmed directory `categories`
(auto-detected, reviewer-editable), `germanVendor` (drives the VAT-form
requirement; seeded from EUR), and `delivered` (false drives the
non-receipt-memo requirement).

**Attachment**:
A supporting document stored alongside a record beyond the primary receipt
image — GPC purchase request, VAT form, non-receipt memo, or a directory
approval. Metadata on the record; bytes in the same blob/Storage backend. Its
`slotId` binds it to a **RequiredDoc** slot.

**RequiredDoc**:
A document slot an order must carry, derived from MandatoryAuth: the always-on
base (receipt, GPC purchase request), the conditional ones (VAT, non-receipt
memo), and one approval slot per detected category. Satisfied by the receipt
image or a matching Attachment; missing slots surface on review and ride along
to the US Bank order.

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

