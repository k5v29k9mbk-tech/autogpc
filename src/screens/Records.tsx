import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import { DocTypeTag, SourceTag } from "../components/ui";
import { IconChevronRight, IconReceipt, IconSearch } from "../components/icons";
import { formatAmount, formatDateUS } from "../lib/format";
import { STATUS_LABELS, STATUS_ORDER, type RecordStatus } from "../core/types";

type Filter = "all" | RecordStatus;

export function Records() {
  const { records } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.vendor.toLowerCase().includes(q) ||
        formatDateUS(r.transactionDate).toLowerCase().includes(q) ||
        r.totalAmount.toLowerCase().includes(q) ||
        (r.currency ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, query, filter]);

  return (
    <div className="stack" style={{ gap: "var(--s5)" }}>
      <div className="page-head">
        <h1>Saved records</h1>
        <p className="sub">
          {records.length} {records.length === 1 ? "record" : "records"} stored locally on this
          device.
        </p>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: 11, color: "var(--text-faint)" }}>
            <IconSearch width={16} height={16} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search vendor, date, or amount"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="segmented">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            All
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {records.length === 0 ? (
            <>
              No records yet. <Link to="/scan" style={{ color: "var(--text)" }}>Scan or upload one →</Link>
            </>
          ) : (
            "No records match this search or filter."
          )}
        </div>
      ) : (
        <div className="rec-list">
          {filtered.map((r) => (
            <Link key={r.id} to={`/records/${r.id}`} className="rec-row">
              <span className="rec-ico">
                <IconReceipt width={18} height={18} />
              </span>
              <div>
                <div className="rec-vendor">{r.vendor || "Untitled record"}</div>
                <div className="rec-date">{r.transactionDate ? formatDateUS(r.transactionDate) : "no date"}</div>
                <div className="rec-meta">
                  <DocTypeTag docType={r.docType} />
                  <SourceTag source={r.source} />
                </div>
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
      )}
    </div>
  );
}
