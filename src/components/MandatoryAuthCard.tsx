// Mandatory-authorization review: the detected GPC authorization categories
// (editable), the VAT / non-receipt-memo drivers, and an upload slot per
// required supporting document. Controlled — the parent (Review draft or saved
// RecordDetail) owns `value`/`attachments` and decides when to persist; this
// card only edits them and streams blobs into the store as files are picked.
//
// Used in two places, so it lives as one component rather than duplicated JSX.

import { useRef, useState } from "react";
import {
  ALL_AUTH_CATEGORIES,
  authCategory,
  requiredDocuments,
  suggestSpecialPreApproval,
  type RequiredDoc,
} from "../core/mandatoryAuth";
import { useStore } from "../store";
import type { Attachment, MandatoryAuth } from "../core/types";
import { IconAlert, IconCheck, IconTrash, IconUpload } from "./icons";

type Props = {
  recordId: string;
  /** The captured receipt image already satisfies the "receipt" slot. */
  hasReceiptImage: boolean;
  value: MandatoryAuth;
  attachments: Attachment[];
  onChange: (value: MandatoryAuth) => void;
  onAttachmentsChange: (attachments: Attachment[]) => void;
};

export function MandatoryAuthCard({
  recordId,
  hasReceiptImage,
  value,
  attachments,
  onChange,
  onAttachmentsChange,
}: Props) {
  const { putAttachment, deleteAttachment, resolveImage } = useStore();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docs = requiredDocuments(value.categories, {
    germanVendor: value.germanVendor,
    delivered: value.delivered,
  });
  const suggestion = suggestSpecialPreApproval(value.categories);
  const unselected = ALL_AUTH_CATEGORIES.filter((c) => !value.categories.includes(c.id));

  const attachmentFor = (slotId: string) => attachments.find((a) => a.slotId === slotId);
  const satisfied = (doc: RequiredDoc) =>
    (doc.id === "receipt" && hasReceiptImage) || !!attachmentFor(doc.id);
  const missingCount = docs.filter((d) => !satisfied(d)).length;

  const addCategory = (id: string) => {
    if (!id || value.categories.includes(id)) return;
    onChange({ ...value, categories: [...value.categories, id] });
  };
  const removeCategory = (id: string) =>
    onChange({ ...value, categories: value.categories.filter((c) => c !== id) });

  const upload = async (doc: RequiredDoc, file: File) => {
    setError(null);
    setBusySlot(doc.id);
    try {
      // Replace any existing file in this slot, dropping the old blob.
      const prev = attachmentFor(doc.id);
      const meta = await putAttachment(recordId, file);
      const att: Attachment = {
        ...meta,
        slotId: doc.id,
        category: doc.category,
        label: doc.label,
        uploadedAt: new Date().toISOString(),
      };
      onAttachmentsChange([...attachments.filter((a) => a.slotId !== doc.id), att]);
      if (prev) await deleteAttachment(prev.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusySlot(null);
    }
  };

  const remove = async (doc: RequiredDoc) => {
    const att = attachmentFor(doc.id);
    if (!att) return;
    onAttachmentsChange(attachments.filter((a) => a.slotId !== doc.id));
    await deleteAttachment(att.uri);
  };

  const view = async (uri: string) => {
    const src = await resolveImage(uri);
    if (src) window.open(src, "_blank", "noopener");
  };

  return (
    <div className="card">
      <div className="card-title">Mandatory authorization &amp; documents</div>
      <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
        Detected from the receipt against the 700 CONS authorization directory. Add or remove
        categories if the guess is wrong — each one sets the documents this order must carry.
      </p>

      {/* Detected categories */}
      <div className="stat-label" style={{ marginTop: "var(--s3)" }}>Authorization categories</div>
      {value.categories.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>None detected — add one if this purchase needs special approval.</p>
      ) : (
        <div className="row wrap" style={{ gap: "var(--s2)", marginTop: 4 }}>
          {value.categories.map((id) => {
            const cat = authCategory(id);
            return (
              <span
                key={id}
                className="badge"
                title={cat ? `${cat.requiredDoc} — ${cat.authority}${cat.phone ? ` (${cat.phone})` : ""}` : id}
                style={{ background: "var(--accent-soft)", borderColor: "#3a4a3c", color: "var(--accent-text)" }}
              >
                {cat?.label ?? id}
                <button
                  className="badge-x"
                  aria-label={`Remove ${cat?.label ?? id}`}
                  onClick={() => removeCategory(id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "0 0 0 6px", lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="row" style={{ gap: "var(--s2)", marginTop: "var(--s3)", alignItems: "center" }}>
        <select
          className="select"
          value=""
          style={{ width: "auto" }}
          onChange={(e) => addCategory(e.target.value)}
        >
          <option value="">+ Add a category…</option>
          {unselected.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {suggestion && (
          <span className="muted" style={{ fontSize: 12 }}>
            Suggested US Bank Special Pre-Approval: <strong>{suggestion}</strong>
          </span>
        )}
      </div>

      {/* Conditional drivers */}
      <div className="row wrap" style={{ gap: "var(--s4)", marginTop: "var(--s3)" }}>
        <label className="row" style={{ gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={value.germanVendor}
            onChange={(e) => onChange({ ...value, germanVendor: e.target.checked })}
          />
          Purchased from a German business (needs VAT-relief form)
        </label>
        <label className="row" style={{ gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!value.delivered}
            onChange={(e) => onChange({ ...value, delivered: !e.target.checked })}
          />
          Not yet delivered (needs non-receipt memo)
        </label>
      </div>

      {/* Required documents + upload slots */}
      <div className="stat-label" style={{ marginTop: "var(--s4)" }}>
        Required documents — {docs.length - missingCount}/{docs.length} attached
      </div>
      <div className="stack" style={{ gap: "var(--s2)", marginTop: 4 }}>
        {docs.map((doc) => (
          <DocRow
            key={doc.id}
            doc={doc}
            attachment={attachmentFor(doc.id)}
            receiptImage={doc.id === "receipt" && hasReceiptImage}
            busy={busySlot === doc.id}
            onUpload={(file) => upload(doc, file)}
            onRemove={() => remove(doc)}
            onView={view}
          />
        ))}
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: "var(--s3)" }}>
          <IconAlert width={16} height={16} />
          <div>{error}</div>
        </div>
      )}
      {missingCount > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: "var(--s3)" }}>
          {missingCount} document{missingCount === 1 ? "" : "s"} still missing. They'll be uploaded to
          the US Bank order alongside the receipt.
        </p>
      )}
    </div>
  );
}

function DocRow({
  doc,
  attachment,
  receiptImage,
  busy,
  onUpload,
  onRemove,
  onView,
}: {
  doc: RequiredDoc;
  attachment: Attachment | undefined;
  receiptImage: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onView: (uri: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const done = receiptImage || !!attachment;
  return (
    <div
      className="row"
      style={{
        gap: "var(--s2)",
        alignItems: "flex-start",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        aria-hidden
        style={{
          marginTop: 2,
          color: done ? "var(--accent-text)" : "var(--text-faint)",
          flex: "0 0 auto",
        }}
      >
        {done ? <IconCheck width={16} height={16} /> : <IconAlert width={16} height={16} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.label}</div>
        {doc.note && <div className="muted" style={{ fontSize: 12 }}>{doc.note}</div>}
        {attachment ? (
          <div className="row" style={{ gap: 6, fontSize: 12, marginTop: 2 }}>
            <button className="btn-link" onClick={() => onView(attachment.uri)} style={{ background: "none", border: "none", padding: 0, color: "var(--text)", textDecoration: "underline", cursor: "pointer" }}>
              {attachment.filename}
            </button>
          </div>
        ) : (
          receiptImage && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Covered by the uploaded receipt.</div>
        )}
      </div>
      <div className="row" style={{ gap: "var(--s2)", flex: "0 0 auto" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
        <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <span className="spinner" /> : <IconUpload width={14} height={14} />}
          {attachment ? "Replace" : "Upload"}
        </button>
        {attachment && (
          <button className="btn btn-sm btn-ghost" aria-label={`Remove ${doc.label}`} onClick={onRemove}>
            <IconTrash width={14} height={14} />
          </button>
        )}
      </div>
    </div>
  );
}
