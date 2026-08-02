// Public marketing site for AutoGPC — "Calm Authority", pushed to Awwwards-grade
// craft while staying trust-first: warm charcoal, IBM Plex, one restrained green
// reserved for verified/compliant states. Motion is present but disciplined and
// fully reduced-motion safe. No fabricated compliance claims; the hero panel is a
// decorative depiction of the real workflow (aria-hidden), roadmap items labeled.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/Logo";
import {
  IconCheck,
  IconFile,
  IconImage,
  IconSearch,
  IconShield,
  IconUpload,
} from "../components/icons";

const STEPS = [
  { n: "01", t: "Capture", d: "Upload a receipt, invoice, or PDF, or snap a photo on your phone." },
  { n: "02", t: "Extract", d: "Vendor, total, tax, dates, and line items are read automatically." },
  { n: "03", t: "Match", d: "Line the purchase up against its card transaction." },
  { n: "04", t: "Order", d: "Draft the GPC order straight from the extracted fields." },
  { n: "05", t: "Approve", d: "Route for approval with a complete, audit-ready record." },
];

const AUDIENCES = [
  { role: "Cardholders", line: "Capture and reconcile a purchase in seconds, not a coffee break." },
  { role: "Approving officials", line: "Review complete, consistent records before you sign." },
  { role: "Program coordinators", line: "Keep the whole portfolio audit-ready without chasing paperwork." },
];

// Depicted (not claimed) fields the extractor populates, shown in the hero panel.
const RECORD_FIELDS = [
  { k: "Vendor", v: "Apex Office Supply" },
  { k: "Total", v: "$1,284.00" },
  { k: "Tax", v: "$96.30" },
  { k: "Date", v: "2026-05-21" },
  { k: "Line items", v: "7 captured" },
];

const MARQUEE = [
  "Receipts", "Invoices", "Quotes", "Packing slips", "Native PDF", "Scanned images",
  "Vendor", "Total", "Tax", "Line items", "Card last four", "Transaction match", "Audit trail",
];

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Landing() {
  const { mode } = useAuth();
  const signedIn = mode === "authenticated" || mode === "guest";

  // Auto-advancing pipeline in the hero panel. Under reduced-motion we settle on
  // the finished state and never cycle.
  const [step, setStep] = useState(prefersReduced() ? STEPS.length : 0);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Pipeline cycle
  useEffect(() => {
    if (prefersReduced()) return;
    const id = window.setInterval(() => {
      setStep((s) => (s >= STEPS.length ? 0 : s + 1));
    }, 1250);
    return () => window.clearInterval(id);
  }, []);

  // Nav elevation on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Subtle pointer-tilt on the hero panel (rAF, never via React state).
  const onPanelMove = (e: React.MouseEvent) => {
    if (prefersReduced() || !panelRef.current) return;
    const el = panelRef.current;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${nx * 5}deg`);
      el.style.setProperty("--ry", `${-ny * 5}deg`);
    });
  };
  const onPanelLeave = () => {
    const el = panelRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  // Scroll reveal. Reduced-motion (or no IntersectionObserver) reveals everything.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp-reveal"));
    if (prefersReduced() || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.16 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const extracted = step >= 2 || step >= STEPS.length;
  const timer = `0:${String(Math.min(step, STEPS.length) * 11).padStart(2, "0")}`;

  return (
    <div className="lp">
      <a href="#lp-main" className="lp-skip">Skip to content</a>

      {/* Nav */}
      <header className={`lp-nav${scrolled ? " scrolled" : ""}`}>
        <div className="lp-container lp-nav-inner">
          <Link to="/marketing" className="lp-brand" aria-label="AutoGPC home">
            <Logo size={28} />
            <span className="lp-wordmark">AutoGPC</span>
          </Link>
          <nav className="lp-nav-links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#security">Security</a>
          </nav>
          <div className="lp-nav-cta">
            {signedIn ? (
              <Link to="/" className="btn btn-primary btn-sm">Open app</Link>
            ) : (
              <>
                <Link to="/login" className="lp-textlink">Sign in</Link>
                <Link to="/create-account" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="lp-main">
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="eyebrow lp-live">
                <span className="lp-live-dot" aria-hidden="true" />
                Government Purchase Card automation
              </div>
              <h1 className="lp-h1">
                The GPC process,
                <br />
                start to <em>audit-ready</em>.
              </h1>
              <p className="lp-sub">
                Capture receipts, match transactions, draft orders, and route approvals, with an
                audit trail on every record.
              </p>
              <div className="lp-hero-cta">
                <Link to="/create-account" className="btn btn-primary btn-lg">Get started</Link>
                <a href="#how" className="btn btn-ghost btn-lg">See how it works</a>
              </div>
              <p className="lp-microline">
                Built for cardholders, approving officials, and program coordinators.
              </p>
            </div>

            {/* Animated depiction of the real workflow — decorative, so aria-hidden */}
            <div className="lp-panel-wrap lp-reveal" aria-hidden="true">
              <div
                className="lp-panel"
                ref={panelRef}
                onMouseMove={onPanelMove}
                onMouseLeave={onPanelLeave}
              >
                <div className="lp-panel-head">
                  <span className="lp-live-dot" />
                  Live workflow
                  <span className="lp-panel-timer">{timer}</span>
                </div>

                <div className="lp-pipe">
                  {STEPS.map((s, i) => {
                    const done = i < step;
                    const active = i === step;
                    const status = done ? "verified" : active ? "reading" : "queued";
                    return (
                      <div
                        className={`lp-pipe-row${done ? " done" : ""}${active ? " active" : ""}`}
                        key={s.n}
                      >
                        <span className="lp-pipe-rail" />
                        <span className="lp-pipe-node">
                          {done ? <IconCheck width={12} height={12} /> : <span>{i + 1}</span>}
                        </span>
                        <span className="lp-pipe-t">{s.t}</span>
                        <span className="lp-pipe-s">{status}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="lp-record">
                  <div className="lp-record-head">Purchase record</div>
                  {RECORD_FIELDS.map((f) => (
                    <div className="lp-field" key={f.k}>
                      <span className="lp-field-k">{f.k}</span>
                      {extracted ? (
                        <span className="lp-field-v">{f.v}</span>
                      ) : (
                        <span className="lp-field-v pending" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="lp-section">
          <div className="lp-container">
            <div className="eyebrow lp-reveal">How it works</div>
            <h2 className="lp-h2 lp-reveal">Five steps, one record.</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li
                  className="lp-step lp-reveal"
                  key={s.n}
                  style={{ "--d": `${i * 80}ms` } as CSSProperties}
                >
                  <span className="lp-step-n">{s.n}</span>
                  <h3 className="lp-step-t">{s.t}</h3>
                  <p className="lp-step-d">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities — bento */}
        <section id="capabilities" className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="eyebrow lp-reveal">Capabilities</div>
            <h2 className="lp-h2 lp-reveal">What it actually does.</h2>
            <div className="lp-bento">
              <article className="lp-cell lp-cell-wide lp-tint lp-reveal">
                <IconFile className="lp-cell-icon" width={20} height={20} />
                <h3>Routes by document type</h3>
                <p>
                  Native PDFs are read straight from their text layer. Photos and scans run through
                  image OCR. Faded or handwritten documents can route to cloud extraction.
                </p>
                <div className="lp-chips">
                  {["Native PDF", "Image OCR", "Cloud OCR"].map((c) => (
                    <span className="lp-chip" key={c}>{c}</span>
                  ))}
                </div>
              </article>
              <article className="lp-cell lp-reveal" style={{ "--d": "60ms" } as CSSProperties}>
                <IconSearch className="lp-cell-icon" width={20} height={20} />
                <h3>Field extraction</h3>
                <p>Vendor, total, tax, dates, card last four, and line items.</p>
              </article>
              <article className="lp-cell lp-reveal" style={{ "--d": "120ms" } as CSSProperties}>
                <IconImage className="lp-cell-icon" width={20} height={20} />
                <h3>Transaction matching</h3>
                <p>Tie each purchase to the card transaction it belongs to.</p>
              </article>
              <article className="lp-cell lp-tint lp-reveal" style={{ "--d": "60ms" } as CSSProperties}>
                <IconUpload className="lp-cell-icon" width={20} height={20} />
                <h3>Order drafting</h3>
                <p>Generate a GPC order from the reviewed fields, ready for entry.</p>
              </article>
              <article className="lp-cell lp-reveal" style={{ "--d": "120ms" } as CSSProperties}>
                <IconCheck className="lp-cell-icon" width={20} height={20} />
                <h3>Audit trail and export</h3>
                <p>A reviewable record per order, exportable as structured text or JSON.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="lp-section">
          <div className="lp-container lp-who-grid">
            <div className="lp-who-head lp-reveal">
              <div className="eyebrow">Who it's for</div>
              <h2 className="lp-h2">Built for the people who run the cards.</h2>
              <p className="lp-sub">One system for the whole chain of custody on a purchase.</p>
            </div>
            <ul className="lp-who-list">
              {AUDIENCES.map((a, i) => (
                <li className="lp-who-item lp-reveal" key={a.role}>
                  <span className="lp-who-idx">0{i + 1}</span>
                  <div>
                    <h3>{a.role}</h3>
                    <p>{a.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Security & data handling — accurate, roadmap labeled */}
        <section id="security" className="lp-section lp-section-alt">
          <div className="lp-container lp-sec-grid">
            <div className="lp-sec-head lp-reveal">
              <div className="eyebrow">Security and data handling</div>
              <h2 className="lp-h2">Serious about where the data goes.</h2>
              <p className="lp-sub">
                Sensible defaults now, with a clear path for the compliance work that government use
                will require.
              </p>
            </div>
            <ul className="lp-sec-list">
              <li className="lp-reveal">
                <span className="lp-sec-ico"><IconShield width={18} height={18} /></span>
                <div>
                  <h3>Processed locally by default</h3>
                  <p>Open-source OCR runs in your browser; documents stay on the device. Cloud extraction is optional and runs server-side.</p>
                </div>
              </li>
              <li className="lp-reveal">
                <span className="lp-sec-ico"><IconShield width={18} height={18} /></span>
                <div>
                  <h3>Keys stay on the server</h3>
                  <p>Cloud OCR and order handoff run behind serverless functions. Credentials never reach the browser bundle.</p>
                </div>
              </li>
              <li className="lp-reveal">
                <span className="lp-sec-ico"><IconShield width={18} height={18} /></span>
                <div>
                  <h3>Access control</h3>
                  <p>Accounts use email-confirmed sign-in. Data access is designed around row-level security.</p>
                </div>
              </li>
              <li className="lp-reveal lp-sec-roadmap">
                <span className="lp-pill"><span className="lp-pill-label">Roadmap</span></span>
                <div>
                  <h3>Government compliance</h3>
                  <p>A GovCloud deployment and formal authorization are planned. AutoGPC is not yet FedRAMP authorized or ATO'd; do not process live PII until it is.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta">
          <div className="lp-container">
            <div className="lp-cta-inner lp-reveal">
              <h2 className="lp-h2">Bring your GPC workflow into one system.</h2>
              <div className="lp-hero-cta">
                <Link to="/create-account" className="btn btn-primary btn-lg">Get started</Link>
                <Link to="/login" className="btn btn-ghost btn-lg">Sign in</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <Link to="/marketing" className="lp-brand" aria-label="AutoGPC home">
              <Logo size={24} />
              <span className="lp-wordmark">AutoGPC</span>
            </Link>
            <p className="lp-footer-disclaimer">
              AutoGPC is an independent automation tool. It is not affiliated with or endorsed by
              U.S. Bank, PIEE, or any government agency, and does not connect to real U.S. Bank or
              government systems. Demonstration software.
            </p>
          </div>
          <nav className="lp-footer-links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#security">Security</a>
            <Link to="/terms">Terms</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
