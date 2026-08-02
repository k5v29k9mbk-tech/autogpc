// Small presentational building blocks shared across screens.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  DOC_TYPE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type DocType,
  type ExtractionSource,
  type PurchaseRecord,
  type RecordStatus,
} from "../core/types";
import { formatAmount, formatDateUS } from "../lib/format";
import { IconCheck, IconChevronRight, IconFile, IconImage, IconReceipt } from "./icons";

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SourceTag({ source }: { source: ExtractionSource }) {
  const Icon = source === "pdf_text" ? IconFile : source === "tesseract" ? IconImage : IconFile;
  // Older/guest records may carry a source no longer in the map — never render
  // an empty, label-less chip.
  const label = SOURCE_LABELS[source] ?? "Unknown source";
  return (
    <span className="tag" title={`Extraction source: ${label}`}>
      <Icon width={12} height={12} />
      {label}
    </span>
  );
}

export function DocTypeTag({ docType }: { docType: DocType }) {
  return <span className="tag">{DOC_TYPE_LABELS[docType]}</span>;
}

export function Field({
  label,
  children,
  valid,
}: {
  label: string;
  children: ReactNode;
  /** Shows the little check — "this field is filled/satisfied". */
  valid?: boolean;
}) {
  return (
    <div className="field">
      <div className="label-row">
        <label>{label}</label>
        {valid && (
          <span className="check" title="Filled">
            <IconCheck width={11} height={11} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * The labelled <select> every form here needs. `required` adds the "*" marker,
 * the "— select —" sentinel, and the filled-check; options are plain values or
 * {value, label} pairs. Review, RecordDetail, and the US Bank card used to
 * hand-roll this shape ~15 times between them.
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  required?: boolean;
}) {
  return (
    <Field label={required ? `${label} *` : label} valid={required ? !!value.trim() : undefined}>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {required && <option value="">— select —</option>}
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

/**
 * One saved record as a list row (Home's recent list and the Records screen —
 * previously two hand-rolled copies that had already drifted on date format).
 */
export function RecordRow({
  record,
  showMeta = false,
}: {
  record: PurchaseRecord;
  /** Show the DocType/Source tags (the full Records list does; Home doesn't). */
  showMeta?: boolean;
}) {
  return (
    <Link to={`/records/${record.id}`} className="rec-row">
      <span className="rec-ico">
        <IconReceipt width={18} height={18} />
      </span>
      <div>
        <div className="rec-vendor">{record.vendor || "Untitled record"}</div>
        <div className="rec-date">
          {record.transactionDate ? formatDateUS(record.transactionDate) : "no date"}
        </div>
        {showMeta && (
          <div className="rec-meta">
            <DocTypeTag docType={record.docType} />
            <SourceTag source={record.source} />
          </div>
        )}
      </div>
      <span className={`statusline status-${record.status}`}>
        <span className="dot" />
        {STATUS_LABELS[record.status]}
      </span>
      <div className="rec-amt">{formatAmount(record.totalAmount, record.currency)}</div>
      <IconChevronRight width={18} height={18} className="rec-chev" />
    </Link>
  );
}
