// Small presentational building blocks shared across screens.

import type { ReactNode } from "react";
import {
  DOC_TYPE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type DocType,
  type ExtractionSource,
  type RecordStatus,
} from "../core/types";
import { IconCheck, IconFile, IconImage } from "./icons";

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
  hint,
}: {
  label: string;
  children: ReactNode;
  valid?: boolean;
  hint?: string;
}) {
  return (
    <div className="field">
      <div className="label-row">
        <label>{label}</label>
        {valid && (
          <span className="check" title="Extracted">
            <IconCheck width={11} height={11} />
          </span>
        )}
      </div>
      {children}
      {hint && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{hint}</span>}
    </div>
  );
}
