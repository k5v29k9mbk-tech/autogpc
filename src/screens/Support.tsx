// Support — the help surface reachable from the account menu. No backend: it
// routes people to email, answers the common questions inline (native <details>
// accordion), links out to resources, and surfaces copy-able diagnostics so a
// support reply can skip the back-and-forth.

import { useState } from "react";
import { useAuth } from "../auth";
import {
  IconActivity,
  IconAlert,
  IconBook,
  IconCheck,
  IconCopy,
  IconExternal,
  IconLifebuoy,
  IconMail,
} from "../components/icons";

const SUPPORT_EMAIL = "support@autogpc.app";
const APP_VERSION = "1.0.0";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Which file types can I scan?",
    a: "PDFs and common image formats (PNG, JPG, HEIC). Multi-page PDFs are split and processed page by page.",
  },
  {
    q: "How accurate is the extraction?",
    a: "Most clean receipts and invoices extract cleanly. Anything below your confidence threshold (set in Settings) is flagged for review before it counts as a record.",
  },
  {
    q: "Where is my data stored?",
    a: "Signed-in accounts store records against your profile. Guest sessions keep nothing on our servers — closing the tab clears everything.",
  },
  {
    q: "Can I export my records?",
    a: "Yes — export to CSV, JSON, or PDF from the Records screen, or pull a full archive from Settings → Data & privacy.",
  },
  {
    q: "How do I delete my account?",
    a: `Email us at ${SUPPORT_EMAIL} from your account address and we'll remove your account and associated records within 30 days.`,
  },
];

export function Support() {
  const { user, mode } = useAuth();
  const [copied, setCopied] = useState(false);

  const diagnostics = [
    `Version: ${APP_VERSION}`,
    `Account: ${user?.email ?? "guest"}`,
    `Mode: ${mode}`,
    `User ID: ${user?.id ?? "—"}`,
    `User agent: ${navigator.userAgent}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked; nothing to do.
    }
  };

  const bugReportHref =
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("AutoGPC bug report")}` +
    `&body=${encodeURIComponent(
      `Describe what happened:\n\n\n---\nDiagnostics (please keep):\n${diagnostics}`,
    )}`;

  return (
    <div className="stack" style={{ gap: "var(--s5)", maxWidth: 640 }}>
      <div className="page-head">
        <div className="eyebrow">Help</div>
        <h1>Support</h1>
        <p className="sub">Answers to the common questions — and a fast line to a human.</p>
      </div>

      {/* Contact */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconLifebuoy width={15} height={15} /> Contact us
        </h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Email support and we typically reply within one business day.
        </p>
        <div className="row" style={{ gap: "var(--s3)", flexWrap: "wrap" }}>
          <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>
            <IconMail width={15} height={15} /> Email support
          </a>
          <a className="btn btn-ghost" href={bugReportHref}>
            <IconAlert width={15} height={15} /> Report a bug
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="card stack" style={{ gap: "var(--s2)" }}>
        <h2 className="card-title" style={{ margin: "0 0 var(--s2)" }}>
          Frequently asked
        </h2>
        {FAQ.map(({ q, a }) => (
          <details key={q} className="faq">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      {/* Resources */}
      <section className="card stack" style={{ gap: "var(--s2)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: "0 0 var(--s2)" }}>
          <IconBook width={15} height={15} /> Resources
        </h2>
        <ResourceLink label="Documentation" hint="Guides, FAQs, and how-tos." href="/marketing" />
        <ResourceLink label="What's new" hint="Recent releases and changes." href="/marketing" />
        <ResourceLink
          label="Status"
          hint="Live service status and incident history."
          href="/marketing"
        />
      </section>

      {/* Diagnostics */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconActivity width={15} height={15} /> Diagnostics
        </h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Include these details when you contact us — it helps us help you faster.
        </p>
        <dl className="kv">
          <dt>Version</dt>
          <dd>{APP_VERSION}</dd>
          <dt>Account</dt>
          <dd>{user?.email ?? "guest"}</dd>
          <dt>Mode</dt>
          <dd>{mode}</dd>
        </dl>
        <div className="row" style={{ gap: "var(--s3)", alignItems: "center" }}>
          <button type="button" className="btn btn-ghost" onClick={copyDiagnostics}>
            {copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />}
            {copied ? "Copied" : "Copy diagnostics"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ResourceLink({ label, hint, href }: { label: string; hint: string; href: string }) {
  return (
    <a className="resource-link" href={href}>
      <div>
        <div className="setting-label">{label}</div>
        <div className="setting-hint">{hint}</div>
      </div>
      <IconExternal width={16} height={16} className="muted" />
    </a>
  );
}
