import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { routeExtraction } from "../core/extraction/extractionRouter";
import { draftFromResult } from "../core/draft";
import type { ExtractionProgress } from "../core/extraction/extractionService";
import { renderPdfThumbnail } from "../lib/pdfThumbnail";
import { IconFile, IconImage, IconUpload } from "../components/icons";

// ponytail: intentionally generic — these labels must not name the engine or
// pipeline (see subtitle/hint copy below) so the extraction method stays opaque.
const STAGE_TEXT: Record<ExtractionProgress["stage"], string> = {
  loading: "Preparing",
  preprocessing: "Optimizing the image",
  recognizing: "Reading the document",
  parsing: "Structuring fields",
  done: "Done",
};

export function Scan() {
  const navigate = useNavigate();
  const { setDraft } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const onFiles = useCallback(async (f: File | null) => {
    if (!f) return;
    setError(null);
    setFile(f);
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setIsPdf(pdf);

    if (pdf) {
      setPreviewUrl(null);
      try {
        const thumb = await renderPdfThumbnail(f);
        if (thumb) {
          setPreviewBlob(thumb);
          setPreviewUrl(URL.createObjectURL(thumb));
        } else {
          setPreviewBlob(f);
        }
      } catch {
        setPreviewBlob(f);
      }
    } else {
      setPreviewBlob(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  }, []);

  const extract = useCallback(async () => {
    if (!file) return;
    setWorking(true);
    setError(null);
    setProgress({ stage: "loading", progress: 0 });
    const begin = Date.now();

    try {
      const result = await routeExtraction(
        { blob: file, mimeType: file.type, fileName: file.name },
        setProgress,
      );
      setDraft(
        draftFromResult(result, {
          imageUri: previewUrl ?? "",
          imageBlob: previewUrl ? previewBlob : null,
          captureStartedAt: begin,
        }),
      );
      navigate("/review");
    } catch (err) {
      setWorking(false);
      setError(err instanceof Error ? err.message : "Extraction failed. Please try another file.");
    }
  }, [file, previewUrl, previewBlob, setDraft, navigate]);

  return (
    <div className="stack" style={{ gap: "var(--s5)" }}>
      <div className="page-head">
        <h1>Scan or upload a document</h1>
        <p className="sub">
          Drop in a receipt, invoice, or PDF and we'll pull out the fields for you to review.
          Encrypted in transit.
        </p>
      </div>

      {!file ? (
        <div
          className={`dropzone ${dragging ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div className="row" style={{ justifyContent: "center", marginBottom: "var(--s3)", color: "var(--text-muted)" }}>
            <IconUpload width={26} height={26} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Drop a receipt, invoice, or PDF here</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            or click to browse · JPG, PNG, or PDF
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => onFiles(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="card">
          <div className="grid cols-2" style={{ alignItems: "start" }}>
            <div>
              {previewUrl ? (
                <img src={previewUrl} className="preview-img" alt="Document preview" />
              ) : (
                <div className="preview-img row" style={{ justifyContent: "center", flexDirection: "column", gap: "var(--s2)", minHeight: 240 }}>
                  <IconFile width={32} height={32} />
                  <span className="muted">Preparing preview…</span>
                </div>
              )}
            </div>

            <div className="stack">
              <div>
                <div className="row" style={{ gap: "var(--s2)" }}>
                  {isPdf ? <IconFile /> : <IconImage />}
                  <span style={{ fontWeight: 600, wordBreak: "break-all" }}>{file.name}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {isPdf ? "PDF ready to extract." : "Image ready to extract."}
                </div>
              </div>

              {working && progress && (
                <div className="stack" style={{ gap: "var(--s2)" }}>
                  <div className="row">
                    <span className="readout" style={{ fontSize: 13 }}>
                      {STAGE_TEXT[progress.stage]}
                      {progress.message ? ` · ${progress.message}` : ""}
                    </span>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${Math.round(
                          (progress.stage === "recognizing" ? progress.progress : progress.stage === "parsing" ? 1 : 0.15) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Reading the document and structuring the fields…
                  </div>
                </div>
              )}

              {error && (
                <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>
              )}

              {!working && (
                <div className="row wrap" style={{ marginTop: "var(--s2)" }}>
                  <button className="btn btn-primary" onClick={extract}>
                    Extract
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setPreviewBlob(null);
                      setError(null);
                    }}
                  >
                    Choose another
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
