// The "889 Designation" widget inside the US Bank order card. Takes the
// extracted vendor, searches SAM.gov via the SmartPay 889 tool, lets the
// cardholder confirm which entity matched, shows the compliance verdict, and
// downloads the "Record of Section 889 Representations" PDF for the order.

import { useState } from "react";
import { search889 } from "../lib/section889Client";
import { download889Record } from "../lib/section889Pdf";
import { pickBestMatch, type Section889Entity } from "../lib/section889";
import { IconAlert, IconCheck, IconDownload, IconSearch } from "./icons";

type Phase = "idle" | "loading" | "done" | "error";

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

export function Section889Field({ vendor }: { vendor: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<Section889Entity[]>([]);
  const [selectedUei, setSelectedUei] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const selected =
    candidates.find((c) => c.uei === selectedUei) ?? candidates[0] ?? null;

  const lookup = async () => {
    setPhase("loading");
    setError(null);
    try {
      const results = await search889(vendor);
      setCandidates(results);
      setSelectedUei(pickBestMatch(results, vendor)?.uei ?? results[0]?.uei ?? null);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
      setPhase("error");
    }
  };

  const download = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      await download889Record(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (phase === "idle" || phase === "error") {
    return (
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <div className="row" style={{ gap: "var(--s2)" }}>
          <button className="btn btn-sm" onClick={lookup} disabled={!vendor.trim()}>
            <IconSearch width={14} height={14} /> Look up 889 representation
          </button>
          {!vendor.trim() && (
            <span className="muted" style={{ fontSize: 12 }}>Add a vendor first.</span>
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

  // phase === "done"
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
          ? "One match in SAM.gov — confirm it's the vendor, then download."
          : `${candidates.length} matches — pick the right entity, then download.`}
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
        <button className="btn btn-sm btn-primary" onClick={download} disabled={!selected || downloading}>
          {downloading ? <span className="spinner" /> : <IconDownload width={14} height={14} />}
          {downloading ? "Generating…" : "Download 889 record (PDF)"}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={lookup}>Search again</button>
      </div>
    </div>
  );
}
