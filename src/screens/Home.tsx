import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { HeroLogo } from "../components/HeroLogo";
import { RecordRow } from "../components/ui";
import { setPendingFile } from "../lib/pendingFile";
import { IconReceipt, IconShield, IconUpload } from "../components/icons";

export function Home() {
  const { records } = useStore();
  const navigate = useNavigate();
  const recent = records.slice(0, 3);
  const [dragging, setDragging] = useState(false);

  // The front door does the work: a file dropped here goes straight into the
  // scan flow, no marketing detour.
  const take = (f: File | null | undefined) => {
    if (!f) return;
    setPendingFile(f);
    navigate("/scan");
  };

  return (
    <div className="stack" style={{ gap: "var(--s6)" }}>
      {/* Hero — the upload surface itself, not a pitch for it. */}
      <section className="hero reveal">
        {/* A <label> gives click-to-browse and keyboard access for free, so the
            drop surface needs no click handler and no ref. */}
        <label
          className={`hero-drop ${dragging ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="hero-drop-ico">
            <IconUpload width={22} height={22} />
          </span>
          <h1 className="hero-drop-title">Drop a receipt</h1>
          <span className="hero-drop-hint">or click to browse — JPG, PNG, PDF</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => take(e.target.files?.[0])}
          />
        </label>
        <div className="hero-visual" aria-hidden="true">
          <HeroLogo />
        </div>
      </section>

      {/* Recent records */}
      <section className="reveal" style={{ animationDelay: "80ms" }}>
        <div className="section-head">
          <h2>Recent records</h2>
          {recent.length > 0 && (
            <Link to="/records" className="viewall">
              View all →
            </Link>
          )}
        </div>
        {recent.length > 0 ? (
          <div className="rec-list">
            {recent.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        ) : (
          <div className="empty empty-records">
            <span className="empty-ico">
              <IconReceipt width={22} height={22} />
            </span>
            <div className="empty-title">No records yet</div>
            <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Upload a receipt and it'll show up here.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: "var(--s4)" }}
              onClick={() => navigate("/scan")}
            >
              <IconUpload width={15} height={15} /> Upload receipt
            </button>
          </div>
        )}
      </section>

      {/* Trust line */}
      <section className="reveal" style={{ animationDelay: "140ms" }}>
        <div className="trustline">
          <IconShield width={15} height={15} />
          <span>
            Prototype. Not connected to real US Bank, PIEE, or any government system — the order
            handoff targets a US Bank Access Online test environment.
          </span>
        </div>
      </section>
    </div>
  );
}
