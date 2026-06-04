import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Package,
  User,
  FileText,
  ShieldCheck,
  Layers,
  Car,
  Fingerprint,
  ArrowRight,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/NavBar";
import { getListingErrorNotes, resolveNote, deleteNote } from "../api/notes";
import { getVehicleById } from "../api/vehicles";
import { useToast } from "../contexts/ToastContext";
import StatCard from "../components/StatCard";

/* ─── Constants & Helpers ───────────────────────────────────────────── */

// Stable reference to prevent useMemo dependency thrashing
const EMPTY_ARRAY = [];

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

/* ─── Vehicle spec grid ─────────────────────────────────────────────── */
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {SPEC_GROUPS.map((group) => {
        const populated = group.fields.filter(
          ([key]) =>
            vehicle[key] && vehicle[key] !== "" && vehicle[key] !== "0",
        );
        if (populated.length === 0) return null;
        return (
          <div key={group.label} className="animate-fade-in">
            <h4 className="text-[10px] font-bold text-txt-muted uppercase tracking-widest mb-3 border-b border-border-subtle pb-1.5">
              {group.label}
            </h4>
            <div className="space-y-2.5">
              {populated.map(([key, label]) => (
                <div
                  key={key}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-txt-secondary">{label}</span>
                  <span
                    className={`font-medium text-right max-w-[60%] truncate ${
                      key === "build" || key === "example_build_number"
                        ? "font-mono badge bg-accent/10 border border-accent/25 text-accent"
                        : "text-txt-primary"
                    }`}
                    title={vehicle[key]}
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

/* ─── Note detail modal ─────────────────────────────────────────────── */
function NoteDetailModal({ note, onClose, onResolve, resolving }) {
  const [resolveText, setResolveText] = useState("");

  const {
    data: vehicleData,
    isLoading: vehicleLoading,
    isError: vehicleError,
  } = useQuery({
    queryKey: ["vehicle", note.vehicle_id],
    queryFn: () =>
      getVehicleById(note.vehicle_id).then((r) => r.data?.data ?? r.data),
    staleTime: 5 * 60_000,
  });

  const vehicle = vehicleData;

  // Use a ref so the effect never needs to re-run when onClose identity changes
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // ✅ empty deps — listener attached once, cleaned up on unmount

  const handleResolve = () => {
    if (!resolveText.trim()) return;
    onResolve(note.note_id, resolveText.trim());
  };

  const isResolveValid = resolveText.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75" />
      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[95vh] flex flex-col bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* ── Fixed Header ── */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle bg-bg-card">
          <div className="min-w-0">
            {vehicleLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                <span className="text-sm font-medium text-txt-muted">
                  Loading vehicle specs...
                </span>
              </div>
            ) : vehicleError || !vehicle ? (
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-txt-muted shrink-0" />
                <h2 className="text-lg font-extrabold text-txt-primary leading-tight">
                  Vehicle #{note.vehicle_id}
                </h2>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-extrabold text-txt-primary leading-tight truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h2>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-txt-secondary">
                  {(vehicle.trim || vehicle.series) && (
                    <span>
                      {[vehicle.trim, vehicle.series]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {vehicle.build_key && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-txt-muted tracking-widest">
                      <Fingerprint className="w-3 h-3 text-accent" />
                      {vehicle.build_key}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-colors shrink-0 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-bg-base/50">
          {/* Error Callout */}
          <div className="rounded-xl border border-warn/25 bg-warn/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-warn" />
              <h3 className="text-[10px] font-bold text-warn uppercase tracking-widest">
                Listing Error Report
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 flex flex-col">
                <span className="text-[10px] text-txt-muted uppercase tracking-wider mb-1.5 font-bold">
                  Agent Note
                </span>
                <p className="text-sm text-txt-primary bg-bg-card p-3 rounded-lg border border-border-subtle leading-relaxed shadow-sm">
                  {note.free_text || (
                    <span className="italic text-txt-muted">
                      No description provided
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {note.part_number && (
                  <div>
                    <span className="text-[10px] text-txt-muted uppercase tracking-wider mb-1.5 font-bold block">
                      Part Number
                    </span>
                    <span className="badge bg-bg-card border border-border-subtle text-txt-primary font-mono font-bold">
                      {note.part_number}
                    </span>
                  </div>
                )}
                {note.part_category && (
                  <div>
                    <span className="text-[10px] text-txt-muted uppercase tracking-wider mb-1.5 font-bold block">
                      Category
                    </span>
                    <span className="badge bg-bg-elevated border border-border-subtle text-txt-secondary">
                      {note.part_category}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-warn/20 flex flex-wrap items-center gap-4 text-xs text-txt-muted">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> {note.username}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(note.created_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5 ml-auto">
                <FileText className="w-3.5 h-3.5" /> #{note.note_id}
              </span>
            </div>
          </div>

          {/* Vehicle specs */}
          <div>
            <h3 className="text-sm font-bold text-txt-primary mb-4 flex items-center gap-2 border-b border-border-subtle pb-2">
              <Layers className="w-4 h-4 text-accent" />
              Technical Specifications
            </h3>
            {vehicleLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
              </div>
            ) : vehicleError || !vehicle ? (
              <div className="flex flex-col items-center justify-center py-10 bg-bg-card rounded-xl border border-border-subtle border-dashed">
                <AlertCircle className="w-8 h-8 text-txt-muted opacity-30 mb-3" />
                <p className="text-sm text-txt-secondary">
                  Vehicle specifications unavailable.
                </p>
              </div>
            ) : (
              <div className="section-card shadow-sm">
                <VehicleSpecGrid vehicle={vehicle} />
              </div>
            )}
          </div>
        </div>

        {/* ── Fixed Footer Action Area ── */}
        <div className="shrink-0 px-6 py-5 border-t border-border-subtle bg-bg-card">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-txt-primary uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
                Resolution Note <span className="text-warn">*</span>
              </label>
              <textarea
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                placeholder="Detail how this listing error was addressed..."
                className="w-full bg-bg-base border border-border-subtle rounded-xl p-3 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent transition-all resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-txt-secondary bg-bg-card rounded-xl border border-border-subtle hover:bg-bg-elevated hover:text-txt-primary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !isResolveValid}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-glow-sm"
              >
                {resolving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Resolving
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Resolve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Error row (Memoized to prevent heavy re-renders) ──────────────── */
// Receives flat primitives only — memo's shallow compare is now reliable.
// Handlers are created once inside the component, not re-created in the parent.
const ErrorRow = memo(function ErrorRow({
  note,
  onClick,
  onHover,
  onDelete,
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = useCallback(() => !confirming && onClick(note), [note, onClick, confirming]);
  const handleHover = useCallback(
    () => onHover(note.vehicle_id),
    [note.vehicle_id, onHover],
  );

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleHover}
      className="relative w-full text-left section-card p-4 hover:border-accent/30 hover:shadow-glow transition-all duration-200 group animate-fade-in flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
    >
      {/* Icon & Primary Info */}
      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-warn/10 border border-warn/25 group-hover:bg-warn/20 transition-colors">
          <AlertTriangle className="w-4 h-4 text-warn" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {note.part_number && (
              <span className="badge bg-bg-elevated border border-border-subtle text-txt-primary font-mono font-bold flex items-center gap-1">
                <Package className="w-3 h-3 text-txt-muted" />
                {note.part_number}
              </span>
            )}
            <span className="badge bg-warn/10 border border-warn/25 text-warn">
              Pending Error
            </span>
            <span className="text-[10px] text-txt-muted ml-1 opacity-60">
              #{note.note_id}
            </span>
          </div>
          <p className="text-sm text-txt-primary line-clamp-2 leading-relaxed">
            {note.free_text || (
              <span className="italic text-txt-muted font-normal">
                No description provided
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Meta info & Action */}
      <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-4 sm:border-l border-border-subtle shrink-0">
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1.5 text-xs text-txt-muted">
          <span className="flex items-center gap-1.5">
            <User className="w-3 h-3" />
            {note.username}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {timeAgo(note.created_at)}
          </span>
        </div>
        {!confirming ? (
          <ArrowRight className="w-4 h-4 text-txt-muted group-hover:text-accent transition-colors" />
        ) : null}
      </div>

      {/* ── Delete control ── */}
      {!confirming ? (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-txt-muted hover:text-danger hover:bg-danger/10 transition-all"
          title="Delete this error"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-bg-card border border-danger/30 rounded-xl px-2.5 py-1.5 shadow-lg z-10"
        >
          <span className="text-xs text-txt-secondary">Delete this error?</span>
          <button
            onClick={() => { onDelete(note.note_id); setConfirming(false); }}
            className="px-2 py-0.5 text-xs font-semibold bg-danger text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="p-0.5 text-txt-muted hover:text-txt-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   ListingErrorsPage
═══════════════════════════════════════════════════════════════════ */
export default function ListingErrorsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selected, setSelected] = useState(null);
  const [resolvingIds, setResolvingIds] = useState(new Set());

  // Stable callbacks
  const handleClose = useCallback(() => setSelected(null), []);

  const handleRowHover = useCallback(
    (vehicleId) => {
      queryClient.prefetchQuery({
        queryKey: ["vehicle", vehicleId],
        queryFn: () =>
          getVehicleById(vehicleId).then((r) => r.data?.data ?? r.data),
        staleTime: 5 * 60_000,
      });
    },
    [queryClient],
  );

  /* ── Data ──────────────────────────────────────────────────────── */
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listing-errors"],
    queryFn: () => getListingErrorNotes().then((r) => r.data?.data ?? r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const allItems = data?.items || EMPTY_ARRAY;

  /* ── Resolve mutation ──────────────────────────────────────────── */
  const { mutate: doResolveNote } = useMutation({
    mutationFn: ({ id, resolve_note }) =>
      resolveNote(id, { is_resolved: true, resolve_note }),
    onMutate: ({ id }) => {
      setResolvingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: (_, { id }) => {
      queryClient.setQueryData(["listing-errors"], (old) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.filter((n) => n.note_id !== id) };
      });
      toast("Error resolved successfully.");
    },
    onError: () => {
      toast("Failed to resolve. Please try again.");
    },
    onSettled: (_, __, { id }) => {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const handleResolve = useCallback(
    (id, noteText) => {
      doResolveNote({ id, resolve_note: noteText }, { onSuccess: handleClose });
    },
    [doResolveNote, handleClose],
  );

  /* ── Delete mutation ───────────────────────────────────────────── */
  const handleDelete = useCallback(
    (noteId) => {
      deleteNote(noteId)
        .then(() => {
          queryClient.setQueryData(["listing-errors"], (old) => {
            if (!old?.items) return old;
            return { ...old, items: old.items.filter((n) => n.note_id !== noteId) };
          });
          toast("Error deleted.", "info");
        })
        .catch(() => toast("Failed to delete.", "error"));
    },
    [queryClient, toast],
  );

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-bg-base flex flex-col font-sans">
      <Navbar user={user} logout={logout} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7 flex-1 w-full flex flex-col">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-extrabold text-txt-primary">
                Listing Error Queue
              </h1>
            </div>
            {!isLoading && (
              <p className="text-sm text-txt-muted mt-0.5">
                Review and resolve reported catalog errors.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh Data"
              className="p-2 rounded-xl border border-border-subtle text-txt-muted hover:text-txt-primary hover:border-border transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Pending Errors"
              value={allItems.length}
              icon={AlertTriangle}
              color="warn"
            />
            <StatCard
              label="Total Resolved"
              value={data.resolved_count || 0}
              icon={CheckCircle2}
              color="success"
            />
            <StatCard
              label="Total Listing Errors"
              value={data.total_all}
              icon={Layers}
              color="accent"
            />
          </div>
        )}

        {/* ── Loading, Error, Empty, List states omitted for brevity (they will now map over `allItems` instead of `filtered`) ── */}

        {!isLoading && !isError && allItems.length > 0 && (
          <div className="space-y-3">
            {allItems.map((note) => (
              <ErrorRow
                key={note.note_id}
                note={note}
                onClick={setSelected}
                onHover={handleRowHover}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <NoteDetailModal
          note={selected}
          onClose={handleClose}
          onResolve={handleResolve}
          resolving={resolvingIds.has(selected.note_id)}
        />
      )}
    </div>
  );
}
