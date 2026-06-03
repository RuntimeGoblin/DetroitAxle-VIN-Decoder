import React, { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Fuel,
  Gauge,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { listVehicles } from "../api/admin";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function Badge({ children, color = "neutral" }) {
  const colors = {
    neutral: "bg-bg-elevated text-txt-muted border border-border-subtle",
    blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function driveColor(dt) {
  if (!dt) return "neutral";
  if (dt === "AWD" || dt === "4WD") return "purple";
  if (dt === "FWD") return "blue";
  if (dt === "RWD") return "amber";
  return "neutral";
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handle}
      className="p-0.5 text-txt-muted/50 hover:text-accent transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

function SpecRow({ label, value }) {
  if (!value || value === "0" || value === "") return null;
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs text-txt-primary break-words">{value}</span>
    </div>
  );
}

function SpecSection({ title, children }) {
  const hasContent = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  if (!hasContent) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] uppercase tracking-widest font-bold text-txt-muted/60 border-b border-border-subtle/40 pb-1">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ── expanded drawer ───────────────────────────────────────────────────────────

function VehicleDrawer({ v }) {
  const customFields = v.custom_fields
    ? Object.entries(v.custom_fields).filter(([, val]) => val)
    : [];

  const created = v.created_at ? new Date(v.created_at).toLocaleString() : null;
  const updated = v.updated_at ? new Date(v.updated_at).toLocaleString() : null;

  return (
    <tr className="bg-bg-elevated/30">
      <td colSpan={6} className="px-5 pb-5 pt-1">
        <div className="border border-border-subtle/50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-bg-surface/40">
          {/* Engine */}
          <SpecSection title="Engine">
            <SpecRow
              label="Displacement"
              value={
                v.displacement_l && v.displacement_l !== "0.0"
                  ? `${v.displacement_l}L`
                  : null
              }
            />
            <SpecRow label="Cylinders" value={v.cylinders} />
            <SpecRow label="Config" value={v.engine_configuration} />
            <SpecRow label="Fuel" value={v.fuel_type} />
            <SpecRow label="Transmission" value={v.transmission_type} />
            <SpecRow
              label="Speeds"
              value={v.speeds > 0 ? String(v.speeds) : null}
            />
            <SpecRow label="Drive" value={v.drive_type} />
          </SpecSection>

          {/* Brakes & Suspension */}
          <SpecSection title="Brakes & Suspension">
            <SpecRow label="ABS" value={v.abs} />
            <SpecRow label="Brake System" value={v.brake_system_type} />
            <SpecRow label="Brake Code" value={v.brake_code} />
            <SpecRow label="Front Brake" value={v.front_brake_type} />
            <SpecRow label="Rear Brake" value={v.rear_brake_type} />
            <SpecRow label="Front Rotor" value={v.front_rotor_size} />
            <SpecRow label="Rear Rotor" value={v.rear_rotor_size} />
            <SpecRow label="Front Spring" value={v.front_spring_type} />
            <SpecRow label="Rear Spring" value={v.rear_spring_type} />
            <SpecRow label="Steering" value={v.steering_type} />
          </SpecSection>

          {/* General */}
          <SpecSection title="General">
            <SpecRow label="Body" value={v.body_type} />
            <SpecRow label="Doors" value={v.doors} />
            <SpecRow
              label="GVWR"
              value={v.gvwr_lbs && v.gvwr_lbs !== "0" ? v.gvwr_lbs : null}
            />
            <SpecRow label="Country" value={v.country} />
            <SpecRow label="Series" value={v.series} />
            <SpecRow label="Build Key" value={v.build_key} />
            <SpecRow label="Created" value={created} />
            <SpecRow label="Updated" value={updated} />
          </SpecSection>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <SpecSection title="Custom Fields">
              {customFields.map(([k, val]) => (
                <SpecRow key={k} label={k} value={String(val)} />
              ))}
            </SpecSection>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function VehiclesTab() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  // Backend receives `page` and `q` for server-side processing
  const { data, isLoading } = useQuery({
    queryKey: ["admin-vehicles", page, q],
    queryFn: () => listVehicles(page, q).then((r) => r.data?.data ?? r.data),
    keepPreviousData: true,
  });

  // Aligning with standard Go backend payload structures
  const vehicles = data?.items ?? [];
  const total = data?.total_count ?? 0;
  const pages = data?.total_pages ?? 1;

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setQ(draft);
              setPage(1); // Reset to first page on new search
            }
          }}
          placeholder="Search by make, model, year, VIN…"
          className="input-base max-w-sm"
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setDraft("");
              setPage(1);
            }}
            className="px-3 py-2 text-sm text-txt-muted hover:text-txt-primary hover:bg-bg-elevated rounded-xl transition-all flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
        <span className="text-sm text-txt-muted ml-1">
          {total} vehicle{total !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Table & Pagination Container */}
      <div className="section-card p-0 flex flex-col bg-bg-surface border border-border-subtle rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <p className="text-sm text-txt-muted">No vehicles found</p>
              {q && (
                <button
                  onClick={() => {
                    setQ("");
                    setDraft("");
                    setPage(1);
                  }}
                  className="text-xs text-accent hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated/60">
                  <th className="w-8 px-3 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden md:table-cell">
                    VIN / Build Key
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden lg:table-cell">
                    Specs
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden sm:table-cell">
                    Notes
                  </th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => {
                  const isExpanded = expanded.has(v.id);
                  const isLast = i === vehicles.length - 1;

                  return (
                    <Fragment key={v.id}>
                      <tr
                        className={`hover:bg-bg-elevated/40 transition-colors cursor-pointer ${
                          isExpanded ? "bg-bg-elevated/20" : ""
                        } ${!isLast && !isExpanded ? "border-b border-border-subtle/40" : ""}`}
                        onClick={() => toggleExpand(v.id)}
                      >
                        {/* Expand chevron */}
                        <td className="px-3 py-5 text-txt-muted/50">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>

                        {/* Vehicle name */}
                        <td className="px-4 py-5">
                          <p className="font-semibold text-txt-primary leading-tight">
                            {v.year} {v.make} {v.model}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {v.trim && (
                              <span className="text-[11px] text-txt-muted">
                                {v.trim}
                              </span>
                            )}
                            {v.drive_type && (
                              <Badge color={driveColor(v.drive_type)}>
                                {v.drive_type}
                              </Badge>
                            )}
                            {v.custom_fields &&
                              Object.keys(v.custom_fields).length > 0 && (
                                <Badge color="amber">
                                  +{Object.keys(v.custom_fields).length} custom
                                </Badge>
                              )}
                          </div>
                        </td>

                        {/* VIN / BuildKey */}
                        <td
                          className="px-4 py-5 hidden md:table-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {v.build_key ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] text-txt-muted tracking-widest">
                                {v.build_key}
                              </span>
                              <CopyButton text={v.build_key} />
                            </div>
                          ) : (
                            <span className="text-txt-muted/30 text-xs">—</span>
                          )}
                        </td>

                        {/* Quick specs */}
                        <td className="px-4 py-5 hidden lg:table-cell">
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.displacement_l && v.displacement_l !== "0.0" && (
                              <span className="flex items-center gap-1 text-[11px] text-txt-muted">
                                <Gauge className="w-3 h-3" />
                                {v.displacement_l}L
                              </span>
                            )}
                            {v.cylinders && (
                              <span className="text-[11px] text-txt-muted">
                                {v.cylinders}cyl
                              </span>
                            )}
                            {v.fuel_type && (
                              <span className="flex items-center gap-1 text-[11px] text-txt-muted">
                                <Fuel className="w-3 h-3" />
                                {v.fuel_type}
                              </span>
                            )}
                            {v.country && (
                              <span className="flex items-center gap-1 text-[11px] text-txt-muted">
                                <Globe className="w-3 h-3" />
                                {v.country}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {v.front_rotor_size && (
                              <span className="text-[10px] text-txt-muted/60">
                                F: {v.front_rotor_size}
                              </span>
                            )}
                            {v.rear_rotor_size && (
                              <span className="text-[10px] text-txt-muted/60">
                                R: {v.rear_rotor_size}
                              </span>
                            )}
                            {v.abs && (
                              <span className="text-[10px] text-txt-muted/60">
                                {v.abs}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Notes count */}
                        <td className="px-4 py-5 text-center hidden sm:table-cell">
                          <span className="flex items-center gap-1 text-xs text-txt-muted justify-center">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {v.notes_count ?? 0}
                          </span>
                        </td>

                        {/* Actions (View Only) */}
                        <td
                          className="px-4 py-5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 justify-end">
                            {v.build_key && (
                              <a
                                href={`/v/${v.build_key}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-txt-muted hover:text-accent hover:bg-accent/10 transition-all"
                                title="View page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable detail drawer */}
                      {isExpanded && (
                        <VehicleDrawer key={`drawer-${v.id}`} v={v} />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!isLoading && vehicles.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated/40 border-t border-border-subtle/50">
            <span className="text-xs text-txt-muted">
              Showing page{" "}
              <span className="font-medium text-txt-primary">{page}</span> of{" "}
              <span className="font-medium text-txt-primary">{pages}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
