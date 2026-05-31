import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Logo } from "../components/Logo";
import { summarizeSavings } from "../lib/timeSaved";
import { formatAmount, formatDuration, formatTimer } from "../lib/format";
import { MANUAL_BASELINE_SECONDS } from "../core/types";
import { StatusBadge } from "../components/ui";
import { IconShield, IconUpload } from "../components/icons";

export function Home() {
  const { records } = useStore();
  const navigate = useNavigate();
  const { totalSavedSeconds, recordCount, avgCaptureSeconds } = summarizeSavings(records);
  const recent = records.slice(0, 3);

  return (
    <div className="stack" style={{ gap: "var(--s6)" }}>
      {/* Hero */}
      <section className="reveal" style={{ display: "flex", alignItems: "center", gap: "var(--s5)" }}>
        <Logo size={64} />
        <div>
          <div className="eyebrow">GPC productivity · prototype</div>
          <h1 style={{ fontSize: 34, marginTop: 4, letterSpacing: "0.02em" }}>Nexus</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Receipt OCR for GPC cardholders.
          </p>
        </div>
      </section>

      {/* BLUF */}
      <section className="card pad-lg reveal" style={{ animationDelay: "60ms" }}>
        <div className="eyebrow" style={{ marginBottom: "var(--s2)" }}>
          Bottom line up front
        </div>
        <p style={{ fontSize: 18, lineHeight: 1.5, maxWidth: "52ch" }}>
          Upload once. Extract the key data. Review and save for manual GPC entry — turning a
          ~12-minute order into under a minute.
        </p>
        <div className="row wrap" style={{ marginTop: "var(--s5)" }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/scan")}>
            <IconUpload /> Scan / Upload receipt
          </button>
          <Link to="/records" className="btn btn-lg">
            Saved records
          </Link>
        </div>
      </section>

      {/* Time-saved counter */}
      <section className="grid cols-3 reveal" style={{ animationDelay: "120ms" }}>
        <div className="card" style={{ gridColumn: "span 1" }}>
          <div className="stat-label">Time saved with Nexus</div>
          <div className="stat-value" style={{ color: "var(--accent-text)", marginTop: 6 }}>
            {formatDuration(totalSavedSeconds)}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            across {recordCount} {recordCount === 1 ? "receipt" : "receipts"}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Manual GPC entry</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            ~{formatTimer(MANUAL_BASELINE_SECONDS)}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            per purchase, by hand
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Avg. capture with Nexus</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            {avgCaptureSeconds != null ? formatTimer(avgCaptureSeconds) : "—"}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            measured, scan to save
          </div>
        </div>
      </section>

      {/* Recent records */}
      {recent.length > 0 && (
        <section className="reveal" style={{ animationDelay: "180ms" }}>
          <div className="row" style={{ marginBottom: "var(--s3)" }}>
            <h2 style={{ fontSize: 16 }}>Recent records</h2>
            <div className="spacer" />
            <Link to="/records" className="muted" style={{ fontSize: 13 }}>
              View all →
            </Link>
          </div>
          <div className="stack" style={{ gap: "var(--s2)" }}>
            {recent.map((r) => (
              <Link key={r.id} to={`/records/${r.id}`} className="record-row">
                <div>
                  <div className="vendor">{r.vendor || "Untitled record"}</div>
                  <div className="meta">
                    <span>{r.transactionDate || "no date"}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="record-amount">
                  <div className="amt">{formatAmount(r.totalAmount, r.currency)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trust line */}
      <section className="reveal" style={{ animationDelay: "220ms" }}>
        <div className="row" style={{ gap: "var(--s2)", color: "var(--text-muted)", fontSize: 13 }}>
          <IconShield width={15} height={15} />
          <span>
            This prototype does not connect to US Bank, PIEE, or any government system. It only
            demonstrates receipt OCR, field extraction, review, and structured export.
          </span>
        </div>
      </section>
    </div>
  );
}
