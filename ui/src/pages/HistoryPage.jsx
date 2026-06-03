import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Fingerprint,
  Car,
  User,
  ArrowRight,
  Filter,
  Zap,
  Pencil,
  ShieldOff,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/NavBar";
import { getVinHistory, verifyVinUpdate } from "../api/history";
import { useToast } from "../contexts/ToastContext";
import StatCard from "../components/StatCard";

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatFieldName(raw) {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(val) {
  if (!val || val === "<nil>" || val === "\u003cnil\u003e") return "—";
  return val;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ─── Vehicle info panel inside dialog ─────────────────────────────── */
const SPEC_GROUPS = [
  {
    label: "Identity",
    fields: [
      ["build_key", "Build Key"],
      ["example_build_number", "Example VIN"],
      ["year", "Year"],
      ["country", "Country"],
    ],
  },
  {
    label: "Classification",
    fields: [
      ["make", "Make"],
      ["model", "Model"],
      ["trim", "Trim"],
      ["series", "Series"],
      ["body_type", "Body"],
      ["doors", "Doors"],
    ],
  },
  {
    label: "Powertrain",
    fields: [
      ["engine_configuration", "Engine Config"],
      ["cylinders", "Cylinders"],
      ["displacement_l", "Displacement (L)"],
      ["fuel_type", "Fuel"],
      ["transmission_type", "Transmission"],
      ["speeds", "Speeds"],
      ["drive_type", "Drive"],
    ],
  },
  {
    label: "Chassis",
    fields: [
      ["gvwr_lbs", "GVWR"],
      ["abs", "ABS"],
      ["front_brake_type", "Front Brake"],
      ["rear_brake_type", "Rear Brake"],
      ["front_rotor_size", "Front Rotor"],
      ["rear_rotor_size", "Rear Rotor"],
      ["brake_code", "Brake Code"],
      ["brake_system_type", "Brake System"],
      ["front_spring_type", "Front Spring"],
      ["rear_spring_type", "Rear Spring"],
      ["steering_type", "Steering"],
    ],
  },
];

function VehicleSpecGrid({ vehicle }) {
  return (
    <div className="space-y-5">
      {SPEC_GROUPS.map((group) => {
        const populated = group.fields.filter(
          ([key]) =>
            vehicle[key] && vehicle[key] !== "" && vehicle[key] !== "0",
        );
        if (populated.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-txt-muted uppercase tracking-widest mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {populated.map(([key, label]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[10px] text-txt-muted">{label}</span>
                  <span
                    className={`text-sm font-medium ${
                      key === "build_key" || key === "example_build_number"
                        ? "font-mono text-accent text-xs tracking-widest"
                        : "text-txt-primary"
                    }`}
                  >
                    {vehicle[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Verify dialog ─────────────────────────────────────────────────── */
function VerifyDialog({ entry, onClose, onVerified, userId }) {
  const [verifying, setVerifying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [correctedValue, setCorrectedValue] = useState(entry.new_value ?? "");
  const [editError, setEditError] = useState(null);

  const vehicle = entry.vehicle;
  const hasCorrection =
    correctedValue.trim() !== (entry.new_value ?? "").trim() &&
    correctedValue.trim() !== "";

  const handleVerify = async () => {
    setVerifying(true);
    setEditError(null);
    try {
      await verifyVinUpdate(entry.id, {
        verifier_id: userId,
        ...(hasCorrection ? { corrected_value: correctedValue.trim() } : {}),
      });
      onVerified(entry.id, correctedValue.trim());
      onClose();
    } catch (err) {
      console.error("Verify failed", err);
      setEditError("Something went wrong. Please try again.");
      setVerifying(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle bg-bg-elevated/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-accent shrink-0" />
              <h2 className="text-base font-extrabold text-txt-primary truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
            </div>
            {(vehicle.trim || vehicle.series) && (
              <p className="text-xs text-txt-secondary">
                {[vehicle.trim, vehicle.series].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <Fingerprint className="w-3 h-3 text-accent" />
              <span className="font-mono text-[10px] text-txt-muted tracking-widest">
                {vehicle.build_key}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Change callout */}
        <div className="mx-6 mt-5 rounded-xl border border-accent/25 bg-accent/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">
              Pending Change
            </p>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-[10px] font-semibold text-txt-muted hover:text-accent transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Correct value
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditMode(false);
                  setCorrectedValue(entry.new_value ?? "");
                  setEditError(null);
                }}
                className="flex items-center gap-1 text-[10px] font-semibold text-txt-muted hover:text-txt-primary transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel edit
              </button>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-txt-muted mb-0.5">Field</p>
              <p className="text-sm font-semibold text-txt-primary">
                {formatFieldName(entry.field_name)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-txt-muted mb-0.5">Old value</p>
              <p className="text-sm font-mono text-txt-secondary line-through opacity-60">
                {formatValue(entry.old_value)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-txt-muted mb-0.5">
                {editMode ? "Corrected value" : "New value"}
              </p>
              {editMode ? (
                <input
                  autoFocus
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  className="w-full bg-bg-base border border-accent/40 rounded-lg px-2 py-1 text-sm font-mono text-accent
                             focus:outline-none focus:border-accent transition-all"
                  placeholder="Enter correct value…"
                />
              ) : (
                <p className="text-sm font-mono text-accent font-semibold">
                  {formatValue(entry.new_value)}
                </p>
              )}
            </div>
          </div>

          {/* Correction notice */}
          {editMode && hasCorrection && (
            <p className="mt-2 text-[10px] text-accent/70 flex items-center gap-1">
              <Pencil className="w-2.5 h-2.5" />
              Vehicle will be updated to "{correctedValue.trim()}" on verify.
            </p>
          )}

          {editError && (
            <p className="mt-2 text-[10px] text-danger flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" /> {editError}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-accent/15 flex items-center gap-4 text-xs text-txt-muted">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {entry.username}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{" "}
              {new Date(entry.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Vehicle specs — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[10px] font-bold text-txt-muted uppercase tracking-widest mb-4">
            Vehicle Specifications
          </p>
          <VehicleSpecGrid vehicle={vehicle} />
        </div>

        {/* Footer / actions */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-elevated/50 flex items-center justify-between gap-3">
          <p className="text-xs text-txt-muted">
            {hasCorrection
              ? "Vehicle will be patched with your corrected value, then marked verified."
              : "Confirm this change is accurate before verifying."}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-txt-secondary rounded-xl border border-border-subtle hover:border-border hover:text-txt-primary transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || (editMode && !correctedValue.trim())}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-glow-sm"
            >
              {verifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {hasCorrection ? "Correct & Verify" : "Verify"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── History row ───────────────────────────────────────────────────── */
function HistoryRow({ entry, onClick }) {
  const isTrusted = entry.is_trusted;

  return (
    <button
      onClick={() => onClick(entry)}
      className="w-full text-left section-card hover:border-accent/30 hover:shadow-glow transition-all duration-200 group animate-fade-in relative overflow-hidden"
    >
      {/* Not-trusted indicator stripe */}
      {!isTrusted && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent rounded-l-2xl" />
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5 ${
            !isTrusted
              ? "bg-accent/10 border border-accent/25"
              : "bg-emerald-500/10 border border-emerald-500/25"
          }`}
        >
          {!isTrusted ? (
            <Zap className="w-4 h-4 text-accent" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* Vehicle pill */}
              {entry.vehicle && (
                <p className="text-xs font-semibold text-txt-secondary mb-1 truncate">
                  {entry.vehicle.year} {entry.vehicle.make}{" "}
                  {entry.vehicle.model}
                  {entry.vehicle.trim ? ` · ${entry.vehicle.trim}` : ""}
                </p>
              )}
              <p className="text-sm font-bold text-txt-primary">
                {formatFieldName(entry.field_name)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isTrusted ? (
                <span className="badge bg-accent/10 border border-accent/25 text-accent text-[10px] font-bold uppercase tracking-wider">
                  Not Trusted
                </span>
              ) : (
                <span className="badge bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                  Trusted
                </span>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-txt-muted group-hover:text-accent transition-colors" />
            </div>
          </div>

          {/* Old → New */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-xs text-txt-muted line-through opacity-60">
              {formatValue(entry.old_value)}
            </span>
            <ArrowRight className="w-3 h-3 text-txt-muted shrink-0" />
            <span className="font-mono text-xs text-accent font-semibold">
              {formatValue(entry.new_value)}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-txt-muted">
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5" /> {entry.username}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {timeAgo(entry.created_at)}
            </span>
            {entry.vehicle?.build_key && (
              <span className="items-center gap-1 font-mono tracking-widest hidden sm:flex">
                <Fingerprint className="w-2.5 h-2.5" />
                {entry.vehicle.build_key}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VinUpdatesPage
═══════════════════════════════════════════════════════════════════ */
export default function HistoryPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("not-trusted"); // "all" | "not-trusted" | "trusted"
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Data ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vin-history", page, filter],
    queryFn: () =>
      getVinHistory({
        includeVehicle: true,
        page,
        pageSize: PAGE_SIZE,
        filter,
      }).then((r) => r.data?.data ?? r.data),
    refetchInterval: 60_000,
    keepPreviousData: true,
    staleTime: 30_000,
  });
  useEffect(() => {
    ["all", "trusted", "not-trusted"].forEach((f) => {
      queryClient.prefetchQuery({
        queryKey: ["vin-history", 1, f],
        queryFn: () =>
          getVinHistory({
            includeVehicle: true,
            page: 1,
            pageSize: PAGE_SIZE,
            filter: f,
          }).then((r) => r.data?.data ?? r.data),
        staleTime: 30_000,
      });
    });
  }, []);

  const raw = data?.items ?? [];
  const totalPages = data?.total_pages ?? data?.TotalPages ?? 1;
  const totalCount = data?.total_count ?? data?.TotalCount ?? 0;

  // counts come from the server now — no client-side filtering needed
  const notTrustedCount = data?.not_trusted_count ?? 0;
  const trustedCount = data?.trusted_count ?? 0;

  const entries = raw;
  const pages = totalPages;
  const allCount = notTrustedCount + trustedCount;
  const toast = useToast();

  // ── Optimistic verify ─────────────────────────────────────────────
  // Once verified, backend will stop returning the entry,
  // so we remove it from the cache entirely.
  const handleVerified = useCallback(
    (id) => {
      queryClient.setQueriesData({ queryKey: ["vin-history"] }, (old) => {
        if (!old?.items) return old;

        const removed = old.items.find((e) => e.id === id);
        if (!removed) return old; // entry not in this cache slice, leave it

        return {
          ...old,
          items: old.items.filter((e) => e.id !== id),
          total_count: Math.max(0, (old.total_count ?? 0) - 1),
          not_trusted_count: !removed.is_trusted
            ? Math.max(0, (old.not_trusted_count ?? 0) - 1)
            : old.not_trusted_count,
          trusted_count: removed.is_trusted
            ? Math.max(0, (old.trusted_count ?? 0) - 1)
            : old.trusted_count,
        };
      });
      toast("Change verified successfully.");
    },
    [queryClient, toast],
  );

  const setFilterTab = (f) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar user={user} logout={logout} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7 flex-1 w-full">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-extrabold text-txt-primary">
                VIN Update Queue
              </h1>
            </div>
            <p className="text-sm text-txt-muted mt-0.5">
              Review, correct, and verify recent field changes
            </p>
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <StatCard
              label="Not Trusted"
              value={notTrustedCount}
              icon={ShieldAlert}
              color="warn"
            />
            <StatCard
              label="Trusted"
              value={trustedCount}
              icon={ShieldCheck}
              color="success"
            />
            <StatCard
              label="Total Unverified Changes"
              value={allCount}
              icon={Activity}
              color="accent"
            />
          </div>
        )}

        {/* ── Filter tabs ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-5 bg-bg-card border border-border-subtle rounded-xl p-1 w-fit">
          {[
            {
              key: "not-trusted",
              label: "Not Trusted",
              count: notTrustedCount,
            },
            { key: "trusted", label: "Trusted", count: trustedCount },
            { key: "all", label: "All", count: allCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                filter === tab.key
                  ? "bg-bg-elevated text-txt-primary"
                  : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              {tab.label}
              {!isLoading && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    filter === tab.key
                      ? tab.key === "not-trusted" && tab.count > 0
                        ? "bg-accent/15 text-accent"
                        : "bg-bg-base text-txt-muted"
                      : "bg-transparent text-txt-muted opacity-60"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="w-10 h-10 text-danger/50 mb-3" />
            <p className="text-sm text-txt-muted mb-4">
              Failed to load VIN history
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl text-sm text-accent hover:bg-accent/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────── */}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckCircle2 className="w-12 h-12 text-txt-muted opacity-20 mb-4" />
            <p className="text-sm font-medium text-txt-muted">
              {filter === "not-trusted"
                ? "No untrusted updates — you're all caught up."
                : "No entries found."}
            </p>
          </div>
        )}

        {/* ── List ────────────────────────────────────────────────── */}
        {!isLoading && !isError && entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => (
              <HistoryRow key={entry.ID} entry={entry} onClick={setSelected} />
            ))}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-border-subtle
                         text-txt-muted hover:text-txt-primary hover:border-border transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-sm text-txt-muted">
              Page {page} of {pages}
            </span>

            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-border-subtle
                         text-txt-muted hover:text-txt-primary hover:border-border transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Dialog ──────────────────────────────────────────────────── */}
      {selected && (
        <VerifyDialog
          entry={selected}
          onClose={() => setSelected(null)}
          onVerified={handleVerified}
          userId={user?.id ?? user?.ID}
        />
      )}
    </div>
  );
}
