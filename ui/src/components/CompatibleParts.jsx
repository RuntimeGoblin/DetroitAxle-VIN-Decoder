import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  ExternalLink, Loader2,
} from "lucide-react";
import { getCompatibleParts } from "../api/parts";
import { useNavigate } from "react-router-dom";

/* ── Fit badge ────────────────────────────────────────────────────── */
function FitBadge({ result, notes }) {
  const [showNotes, setShowNotes] = useState(false);

  if (result === "exact") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 border border-success/25 text-success text-[10px] font-bold">
        <CheckCircle2 className="w-3 h-3" />
        Confirmed Fit
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setShowNotes((v) => !v)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-warn/10 border border-warn/25 text-warn text-[10px] font-bold hover:bg-warn/20 transition-colors"
      >
        <AlertTriangle className="w-3 h-3" />
        Verify
        {showNotes ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      </button>
      {showNotes && notes?.length > 0 && (
        <div className="bg-warn/8 border border-warn/20 rounded-lg px-2.5 py-1.5 space-y-0.5 max-w-[220px]">
          {notes.map((n, i) => (
            <p key={i} className="text-[10px] text-warn/90 leading-snug">{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Category group ───────────────────────────────────────────────── */
function CategoryGroup({ group, onPartClick }) {
  const [open, setOpen] = useState(true);
  const exactCount = group.parts.filter((p) => p.fit_result === "exact").length;

  return (
    <div className="border border-border-subtle rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-elevated/40 hover:bg-bg-elevated/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-bold text-txt-primary">{group.category || "Uncategorised"}</span>
          <span className="text-[10px] text-txt-muted">
            {group.parts.length} part{group.parts.length !== 1 ? "s" : ""}
            {exactCount > 0 && ` · ${exactCount} confirmed`}
          </span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-txt-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-txt-muted" />}
      </button>

      {open && (
        <div className="divide-y divide-border-subtle/50">
          {group.parts.map((part) => (
            <div key={part.id} className="px-4 py-2.5 hover:bg-bg-elevated/30 transition-colors space-y-1">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-txt-primary font-mono">{part.part_number}</p>
                  <p className="text-[11px] text-txt-secondary truncate">{part.name}</p>
                  {/* Matched rule note — e.g. "14.29 inch (363mm) Front Rotor" */}
                  {part.rule_note && (
                    <p className="text-[10px] text-txt-muted truncate">{part.rule_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <FitBadge result={part.fit_result} notes={part.fit_notes} />
                  <button
                    onClick={() => onPartClick(part.id)}
                    className="p-1 text-txt-muted hover:text-accent transition-colors"
                    title="View part details"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Verify notes inline */}
              {part.fit_result === "note" && part.fit_notes?.length > 0 && (
                <div className="space-y-0.5 pl-0.5">
                  {part.fit_notes.map((n, i) => (
                    <p key={i} className="text-[10px] text-warn flex items-start gap-1 leading-snug">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      {n}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function CompatibleParts({ vin }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["compatible-parts", vin],
    queryFn: () => getCompatibleParts(vin).then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!vin,
  });

  const groups = data?.groups ?? [];
  const totalParts = data?.total_parts ?? 0;

  return (
    <div className="section-card animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-0"
      >
        <span className="section-title">
          <Package className="w-4 h-4 text-accent" />
          Compatible Parts
          {!isLoading && totalParts > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
              {totalParts}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-txt-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-txt-muted" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent/50 animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-xs text-txt-muted text-center py-4">
              Failed to load compatible parts
            </p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="w-8 h-8 text-txt-muted/20 mb-2" />
              <p className="text-xs text-txt-muted">No compatible parts found</p>
              <p className="text-[10px] text-txt-muted/60 mt-0.5">
                The parts catalog may not have rules for this build yet
              </p>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <CategoryGroup
                  key={group.category}
                  group={group}
                  onPartClick={(id) => navigate(`/parts?id=${id}`)}
                />
              ))}
              <p className="text-[10px] text-txt-muted text-center pt-1">
                ✓ Confirmed Fit = all conditions verified · ⚠ Verify = some conditions not in vehicle record
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
