import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { HeroLogo } from "../components/HeroLogo";
import { formatAmount } from "../lib/format";
import { STATUS_LABELS } from "../core/types";
import { IconChevronRight, IconReceipt, IconShield, IconUpload } from "../components/icons";

export function Home() {
  const { records } = useStore();
  const navigate = useNavigate();
  const recent = records.slice(0, 3);

  return (
    <div className="stack" style={{ gap: "var(--s6)" }}>
      {/* Hero */}
      <section className="hero reveal">
        <div>
          <div className="hero-eyebrow">For U.S. Government &amp; Defense cardholders</div>
          <h1 className="hero-title">
            Upload once,
            <br />
            we do the rest.
          </h1>
          <p className="hero-sub">
            We read the receipt, extract the key fields, and build an audit-ready record for GPC
            entry in seconds.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg cta" onClick={() => navigate("/scan")}>
              <IconUpload /> Upload receipt
            </button>
            <Link to="/records" className="btn btn-lg cta">
              View my records
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <HeroLogo />
        </div>
      </section>

      {/* Recent records */}
      {recent.length > 0 && (
        <section className="reveal" style={{ animationDelay: "80ms" }}>
          <div className="section-head">
            <h2>Recent records</h2>
            <Link to="/records" className="viewall">
              View all →
            </Link>
          </div>
          <div className="rec-list">
            {recent.map((r) => (
              <Link key={r.id} to={`/records/${r.id}`} className="rec-row">
                <span className="rec-ico">
                  <IconReceipt width={18} height={18} />
                </span>
                <div>
                  <div className="rec-vendor">{r.vendor || "Untitled record"}</div>
                  <div className="rec-date">{r.transactionDate || "no date"}</div>
                </div>
                <span className={`statusline status-${r.status}`}>
                  <span className="dot" />
                  {STATUS_LABELS[r.status]}
                </span>
                <div className="rec-amt">{formatAmount(r.totalAmount, r.currency)}</div>
                <IconChevronRight width={18} height={18} className="rec-chev" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trust line */}
      <section className="reveal" style={{ animationDelay: "140ms" }}>
        <div className="trustline">
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
