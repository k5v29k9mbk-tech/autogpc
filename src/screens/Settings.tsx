// Settings — deliberately small. Earlier sprints rendered notification/export/
// appearance preferences here that nothing else in the app read; they were cut
// rather than left as dead switches. What remains is the one section that does
// something: local data control.

import { useAuth } from "../auth";
import { clearLocalStore } from "../storage/webStorage";
import { IconDatabase, IconTrash } from "../components/icons";

export function Settings() {
  const { mode } = useAuth();

  return (
    <div className="stack" style={{ gap: "var(--s5)", maxWidth: 640 }}>
      <div className="page-head">
        <div className="eyebrow">Preferences</div>
        <h1>Settings</h1>
        <p className="sub">Manage what AutoGPC keeps on this device.</p>
      </div>

      {/* Data & privacy */}
      <section className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconDatabase width={15} height={15} /> Data &amp; privacy
        </h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {mode === "guest"
            ? "You're in guest mode — nothing is stored on our servers. Records live only in this browser."
            : "Your records are tied to your account and stored server-side. Locally cached data can be cleared below."}
        </p>
        <div className="row" style={{ gap: "var(--s3)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm("Clear locally cached scans and preferences on this device?")) {
                // Reload so the record list can't keep showing what was just
                // deleted — the store loaded it before the wipe.
                void clearLocalCache().then(() => location.reload());
              }
            }}
          >
            <IconTrash width={15} height={15} /> Clear local cache
          </button>
        </div>
      </section>
    </div>
  );
}

/** Wipe app-owned localStorage keys (prefs + any cached scans) and the blobs. */
async function clearLocalCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("nexus.")) localStorage.removeItem(key);
    }
  } catch {
    // best-effort
  }
  await clearLocalStore();
}
