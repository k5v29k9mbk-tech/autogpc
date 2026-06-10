// App preferences — distinct from /account (identity & sign-in). Everything here
// is a local, client-side preference persisted to localStorage so toggles and
// choices actually stick across reloads without a backend round-trip. Grouped
// into Notifications, Scanning & extraction, Export, Appearance, and a
// Data & privacy footer.

import { useCallback, useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import {
  IconBell,
  IconCheck,
  IconDatabase,
  IconDownload,
  IconSliders,
  IconTrash,
} from "../components/icons";

const PREFS_KEY = "nexus.prefs.v1";

interface Prefs {
  notifyScanComplete: boolean;
  notifyWeeklySummary: boolean;
  notifyProductUpdates: boolean;
  autoCategorize: boolean;
  confidence: "low" | "medium" | "high";
  defaultCurrency: "USD" | "EUR" | "GBP" | "AUD";
  exportFormat: "csv" | "json" | "pdf";
  exportIncludeImages: boolean;
  density: "comfortable" | "compact";
}

const DEFAULT_PREFS: Prefs = {
  notifyScanComplete: true,
  notifyWeeklySummary: false,
  notifyProductUpdates: true,
  autoCategorize: true,
  confidence: "medium",
  defaultCurrency: "USD",
  exportFormat: "csv",
  exportIncludeImages: false,
  density: "comfortable",
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function Settings() {
  const { user, mode } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Single setter that persists immediately — there's no Save button; changes
  // apply on the spot (with a transient "Saved" confirmation).
  const set = useCallback(<K extends keyof Prefs>(key: K, val: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode); the in-memory value still
        // updates so the UI stays responsive.
      }
      return next;
    });
    setSavedAt(Date.now());
  }, []);

  return (
    <div className="stack" style={{ gap: "var(--s5)", maxWidth: 640 }}>
      <div className="page-head">
        <div className="eyebrow">Preferences</div>
        <h1>Settings</h1>
        <p className="sub">Tune how AutoGPC scans, notifies, and exports — saved to this device.</p>
      </div>

      {/* Notifications */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconBell width={15} height={15} /> Notifications
        </h2>
        <Toggle
          label="Scan complete"
          hint="Email me when a document finishes processing."
          checked={prefs.notifyScanComplete}
          onChange={(v) => set("notifyScanComplete", v)}
        />
        <Toggle
          label="Weekly summary"
          hint="A Monday digest of new records and amounts."
          checked={prefs.notifyWeeklySummary}
          onChange={(v) => set("notifyWeeklySummary", v)}
        />
        <Toggle
          label="Product updates"
          hint="Occasional notes on new features. No spam."
          checked={prefs.notifyProductUpdates}
          onChange={(v) => set("notifyProductUpdates", v)}
        />
      </section>

      {/* Scanning & extraction */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconSliders width={15} height={15} /> Scanning &amp; extraction
        </h2>
        <Toggle
          label="Auto-categorize"
          hint="Guess a category from the merchant and line items."
          checked={prefs.autoCategorize}
          onChange={(v) => set("autoCategorize", v)}
        />
        <SettingRow
          label="Confidence threshold"
          hint="Flag extractions below this for manual review."
        >
          <div className="segmented">
            {(["low", "medium", "high"] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={prefs.confidence === c ? "active" : ""}
                onClick={() => set("confidence", c)}
              >
                {c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Default currency" hint="Used when a document doesn't state one.">
          <select
            className="select"
            value={prefs.defaultCurrency}
            onChange={(e) => set("defaultCurrency", e.target.value as Prefs["defaultCurrency"])}
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="AUD">AUD — Australian Dollar</option>
          </select>
        </SettingRow>
      </section>

      {/* Export */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconDownload width={15} height={15} /> Export defaults
        </h2>
        <SettingRow label="Default format" hint="Pre-selected when you export records.">
          <div className="segmented">
            {(["csv", "json", "pdf"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={prefs.exportFormat === f ? "active" : ""}
                onClick={() => set("exportFormat", f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </SettingRow>
        <Toggle
          label="Include source images"
          hint="Bundle the original scans alongside the data."
          checked={prefs.exportIncludeImages}
          onChange={(v) => set("exportIncludeImages", v)}
        />
      </section>

      {/* Appearance */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          Appearance
        </h2>
        <SettingRow label="Density" hint="How tightly records and lists are packed.">
          <div className="segmented">
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={prefs.density === d ? "active" : ""}
                onClick={() => set("density", d)}
              >
                {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </SettingRow>
      </section>

      {/* Data & privacy */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconDatabase width={15} height={15} /> Data &amp; privacy
        </h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {mode === "guest"
            ? "You're in guest mode — nothing is stored on our servers."
            : "Your records are tied to your account. You can pull a full copy any time."}
        </p>
        <div className="row" style={{ gap: "var(--s3)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => exportData(user?.email ?? null)}
          >
            <IconDownload width={15} height={15} /> Export my data
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm("Clear locally cached scans and preferences on this device?")) {
                clearLocalCache();
                setPrefs(DEFAULT_PREFS);
                setSavedAt(Date.now());
              }
            }}
          >
            <IconTrash width={15} height={15} /> Clear local cache
          </button>
        </div>
      </section>

      {savedAt && (
        <div
          className="row"
          aria-live="polite"
          style={{ gap: "var(--s2)", color: "var(--accent-text)", fontSize: 14 }}
        >
          <IconCheck width={15} height={15} /> Preferences saved.
        </div>
      )}
    </div>
  );
}

/** A labelled row that hosts an arbitrary control on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <div className="setting-label">{label}</div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

/** Square brutalist on/off switch. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingRow label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </SettingRow>
  );
}

/** Download a small JSON stub representing the user's export. */
function exportData(email: string | null) {
  const payload = {
    exportedAt: new Date().toISOString(),
    account: email ?? "guest",
    note: "This is a placeholder export. Your full records archive will be attached here.",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "autogpc-data-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** Wipe app-owned localStorage keys (prefs + any cached scans). */
function clearLocalCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("nexus.")) localStorage.removeItem(key);
    }
  } catch {
    // best-effort
  }
}
