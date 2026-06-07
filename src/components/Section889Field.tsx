// The "889 Designation" widget inside the US Bank order card. Takes the record,
// searches SAM.gov via the SmartPay 889 tool on the extracted vendor, lets the
// cardholder confirm which entity matched, then ATTACHES that determination to
// the record (persisted) so the verdict and the downloadable "Record of Section
// 889 Representations" survive a reload with no second SAM.gov call.

import { useState } from "react";
import { search889 } from "../lib/section889Client";
import { download889Record } from "../lib/section889Pdf";
import { pickBestMatch, type Section889Entity } from "../lib/section889";
import type { Saved889 } from "../core/types";
import { IconAlert, IconCheck, IconDownload, IconSearch } from "./icons";

type Phase = "idle" | "loading" | "results" | "error";

function ComplianceBadge({ compliance }: { compliance: Section889Entity["compliance"] }) {
  const ok = compliance.isCompliant;
  return (
    <span
      className="badge"
      style={{
        color: ok ? "var(--accent-text)" : "#f08a84",
        borderColor: ok ? "#3a4a3c" : "#5a3a3a",
        background: ok ? "var(--accent-soft)" : "rgba(229,83,75,0.12)",
      }}
    >
      {ok ? <IconCheck width={12} height={12} /> : <IconAlert width={12} height={12} />}
      {compliance.statusText}
    </span>
  );
}

// Controlled widget: the parent owns where the determination lives (a saved
// record on the detail page, or the in-flight draft on the review step) and how
// it's persisted. We just drive the SAM.gov lookup and hand back the verdict.
export function Section889Field({
  vendor,
  saved,
  onChange,
}: {
  vendor: string;
  saved: Saved889 | null;
  onChange: (value: Saved889 | null) => void | Promise<void>;
}) {

  const [recheck, setRecheck] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<Section889Entity[]>([]);
  const [selectedUei, setSelectedUei] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = candidates.find((c) => c.uei === selectedUei) ?? candidates[0] ?? null;

  const lookup = async () => {
    setPhase("loading");
    setError(null);
    try {
      const results = await search889(vendor);
      setCandidates(results);
      setSelectedUei(pickBestMatch(results, vendor)?.uei ?? results[0]?.uei ?? null);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
      setPhase("error");
    }
  };

  const attachAndDownload = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const determination: Saved889 = { entity: selected, checkedAt: new Date().toISOString() };
      await onChange(determination);
      await download889Record(selected);
      setRecheck(false); // record now carries it -> SavedView renders
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't attach / generate the record.");
    } finally {
      setBusy(false);
    }
  };

  // ── Saved determination ─────────────────────────────────────────────────────
  if (saved && !recheck) {
    const downloadSaved = async () => {
      setBusy(true);
      setError(null);
      try {
        await download889Record(saved.entity);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't generate the PDF.");
      } finally {
        setBusy(false);
      }
    };
    const checked = new Date(saved.checkedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return (
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <div className="row" style={{ gap: "var(--s2)", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13 }}>{saved.entity.legalName}</strong>
          <ComplianceBadge compliance={saved.entity.compliance} />
        </div>
        <div className="muted mono" style={{ fontSize: 11 }}>
          UEI {saved.entity.uei ?? "—"} · CAGE {saved.entity.cage ?? "—"} · checked {checked}
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert width={16} height={16} />
            <div>{error}</div>
          </div>
        )}
        <div className="row" style={{ gap: "var(--s2)" }}>
          <button className="btn btn-sm btn-primary" onClick={downloadSaved} disabled={busy}>
            {busy ? <span className="spinner" /> : <IconDownload width={14} height={14} />}
            {busy ? "Generating…" : "Download 889 record (PDF)"}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setRecheck(true);
              setPhase("idle");
            }}
          >
            Re-check
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      </div>
    );
  }

  // ── Lookup flow ─────────────────────────────────────────────────────────────
  if (phase === "idle" || phase === "error") {
    return (
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <div className="row" style={{ gap: "var(--s2)" }}>
          <button className="btn btn-sm" onClick={lookup} disabled={!vendor.trim()}>
            <IconSearch width={14} height={14} /> Look up 889 representation
          </button>
          {!vendor.trim() && <span className="muted" style={{ fontSize: 12 }}>Add a vendor first.</span>}
          {recheck && (
            <button className="btn btn-sm btn-ghost" onClick={() => setRecheck(false)}>
              Cancel
            </button>
          )}
        </div>
        {phase === "error" && error && (
          <div className="alert alert-error" role="alert">
            <IconAlert width={16} height={16} />
            <div>{error}</div>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Checks the vendor's FAR 52.204-26 representation in SAM.gov via the GSA SmartPay 889 tool.
        </p>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="row" style={{ gap: "var(--s2)", fontSize: 13 }}>
        <span className="spinner" /> Checking SAM.gov for “{vendor}”…
      </div>
    );
  }

  // phase === "results"
  if (candidates.length === 0) {
    return (
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <div className="alert">
          <IconAlert width={16} height={16} />
          <div>
            No active SAM.gov registration found for <strong>{vendor}</strong>. A manual 889
            determination is required.
          </div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={lookup} style={{ width: "fit-content" }}>
          Search again
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s3)" }}>
      <p className="muted" style={{ fontSize: 12 }}>
        {candidates.length === 1
          ? "One match in SAM.gov — confirm it's the vendor, then attach."
          : `${candidates.length} matches — pick the right entity, then attach.`}
      </p>

      <div className="stack" style={{ gap: 6 }}>
        {candidates.map((c) => {
          const active = c.uei === selected?.uei;
          return (
            <button
              key={c.uei ?? c.legalName}
              onClick={() => setSelectedUei(c.uei)}
              className="row"
              style={{
                textAlign: "left",
                gap: "var(--s2)",
                alignItems: "flex-start",
                padding: "var(--s2) var(--s3)",
                borderRadius: 8,
                border: `1px solid ${active ? "var(--accent-text)" : "var(--border)"}`,
                background: active ? "var(--accent-soft)" : "var(--surface-2)",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 3,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  flex: "0 0 auto",
                  border: `2px solid ${active ? "var(--accent-text)" : "var(--text-muted)"}`,
                  background: active ? "var(--accent-text)" : "transparent",
                }}
              />
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <div className="row" style={{ gap: "var(--s2)", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{c.legalName}</strong>
                  <ComplianceBadge compliance={c.compliance} />
                </div>
                <div className="muted mono" style={{ fontSize: 11 }}>
                  {c.addressLines.join(" · ") || "—"}
                </div>
                <div className="muted mono" style={{ fontSize: 11 }}>
                  UEI {c.uei ?? "—"} · CAGE {c.cage ?? "—"}
                  {c.expirationDate ? ` · exp ${c.expirationDate}` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert width={16} height={16} />
          <div>{error}</div>
        </div>
      )}

      <div className="row" style={{ gap: "var(--s2)" }}>
        <button className="btn btn-sm btn-primary" onClick={attachAndDownload} disabled={!selected || busy}>
          {busy ? <span className="spinner" /> : <IconDownload width={14} height={14} />}
          {busy ? "Attaching…" : "Attach & download 889 record"}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={lookup}>Search again</button>
      </div>
    </div>
  );
}
