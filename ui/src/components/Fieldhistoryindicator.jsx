import { useState, useRef, useEffect } from "react";
import { Clock, ArrowRight, X, ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * FieldHistoryIndicator
 *
 * Props:
 *   fieldName  – the DB column key (e.g. "cylinders")
 *   history    – vehicle.History array from the API:
 *                  { ID, FieldName, OldValue, NewValue, CreatedAt, Username, is_trusted }
 */
export default function FieldHistoryIndicator({ fieldName, history = [] }) {
  const entries = history.filter((h) => h.field_name === fieldName);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (entries.length === 0) return null;

  const latest = [...entries].reverse()[0];
  const count = entries.length;

  return (
    <div ref={ref} className="relative flex items-center">
      {/* ── Pill trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="View edit history"
        className={`
          group flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium
          transition-all duration-150 select-none
          ${
            open
              ? "bg-accent/15 border-accent/40 text-accent"
              : "bg-bg-elevated border-border-subtle text-txt-muted hover:border-accent/30 hover:text-accent hover:bg-accent/8"
          }
        `}
      >
        <Clock className="w-3 h-3 shrink-0" />
        <span className="font-mono tabular-nums">{count}</span>
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className="absolute left-0 top-8 z-50 w-72 rounded-xl border border-border-subtle bg-bg-card shadow-card"
          style={{
            animation: "fhi-drop 140ms cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <style>{`
            @keyframes fhi-drop {
              from { opacity: 0; transform: translateY(-6px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-semibold text-txt-primary tracking-wide">
                Edit History
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-bg-elevated text-txt-muted border border-border-subtle tabular-nums">
                {count}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-txt-muted hover:text-txt-primary transition-colors rounded-lg p-0.5 hover:bg-bg-elevated"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Entries */}
          <ul className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
            {[...entries].reverse().map((entry, i) => {
              const date = entry.created_at
                ? new Date(entry.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : null;
              const time = entry.created_at
                ? new Date(entry.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;

              return (
                <li key={entry.id ?? i} className="px-4 py-3">
                  {/* Value change row */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="
                        inline-block px-2 py-0.5 rounded-md text-xs font-mono
                        bg-danger/10 text-danger border border-danger/20
                        line-through truncate max-w-[90px]
                      "
                      title={entry.OldValue || "empty"}
                    >
                      {entry.OldValue || "empty"}
                    </span>

                    <ArrowRight className="w-3.5 h-3.5 text-txt-muted shrink-0" />

                    <span
                      className="
                        inline-block px-2 py-0.5 rounded-md text-xs font-mono
                        bg-success/10 text-success border border-success/20
                        truncate max-w-[90px]
                      "
                      title={entry.NewValue || "empty"}
                    >
                      {entry.NewValue || "empty"}
                    </span>

                    {/* Trusted badge */}
                    {entry.is_trusted !== undefined && (
                      <span
                        className="ml-auto shrink-0"
                        title={
                          entry.is_trusted ? "Trusted edit" : "Unverified edit"
                        }
                      >
                        {entry.is_trusted ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-success/60" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-warn/60" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center justify-between gap-2">
                    {entry.Username && (
                      <span className="text-[11px] text-txt-secondary font-medium truncate">
                        {entry.Username}
                      </span>
                    )}
                    {date && (
                      <span className="text-[10px] text-txt-muted font-mono shrink-0 ml-auto">
                        {date} · {time}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
