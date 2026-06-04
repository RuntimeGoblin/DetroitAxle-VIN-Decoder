import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  RefreshCw,
  AlertCircle,
  Car,
  Cpu,
  GitFork,
  Disc,
  Settings2,
  Layers,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  Loader2,
  Plus,
  WifiOff,
  Copy,
  ChevronsUpDown,
  ShieldCheck,
  Search,
} from "lucide-react";
import { getVehicle, updateVehicle } from "../api/vehicles";
import { copyText } from "../utils/clipboard";
import { useToast } from "../contexts/ToastContext";
import ThemeToggle from "../components/ThemeToggle";
import NotesPanel from "../components/NotesPanel";
import FieldHistoryIndicator from "../components/Fieldhistoryindicator.jsx";
import { useAuth } from "../contexts/AuthContext";

const SPEC_SECTIONS = [
  {
    id: "identity",
    label: "Identity",
    Icon: Car,
    iconCls: "text-accent",
    defaultOpen: true,
    fields: [
      { label: "Year", jsonKey: "year", col: "year" },
      { label: "Make", jsonKey: "make", col: "make" },
      { label: "Model", jsonKey: "model", col: "model" },
      { label: "Trim", jsonKey: "trim", col: "trim" },
      { label: "Series", jsonKey: "series", col: "series" },
      { label: "Body Type", jsonKey: "body_type", col: "body_type" },
      { label: "Drive Type", jsonKey: "drive_type", col: "drive_type" },
      { label: "Country", jsonKey: "country", col: "country" },
    ],
  },
  {
    id: "engine",
    label: "Engine",
    Icon: Cpu,
    iconCls: "text-amber-400",
    defaultOpen: false,
    fields: [
      { label: "Cylinders", jsonKey: "cylinders", col: "cylinders" },
      {
        label: "Displacement (L)",
        jsonKey: "displacement_l",
        col: "displacement_l",
      },
      { label: "Fuel Type", jsonKey: "fuel_type", col: "fuel_type" },
    ],
  },
  {
    id: "transmission",
    label: "Transmission",
    Icon: GitFork,
    iconCls: "text-purple-400",
    defaultOpen: false,
    fields: [
      { label: "Type", jsonKey: "transmission_type", col: "transmission_type" },
      { label: "Speeds", jsonKey: "speeds", col: "speeds" },
    ],
  },
  {
    id: "brakes",
    label: "Brakes",
    Icon: Disc,
    iconCls: "text-red-400",
    defaultOpen: false,
    fields: [
      { label: "ABS", jsonKey: "abs", col: "abs" },
      {
        label: "Front Brake Type",
        jsonKey: "front_brake_type",
        col: "front_brake_type",
      },
      {
        label: "Rear Brake Type",
        jsonKey: "rear_brake_type",
        col: "rear_brake_type",
      },
      { label: "Brake Code", jsonKey: "brake_code", col: "brake_code" },
      {
        label: "Front Rotor",
        jsonKey: "front_rotor_size",
        col: "front_rotor_size",
      },
      {
        label: "Rear Rotor",
        jsonKey: "rear_rotor_size",
        col: "rear_rotor_size",
      },
      { label: "GVWR (lbs)", jsonKey: "gvwr_lbs", col: "gvwr_lbs" },
    ],
  },
  {
    id: "suspension",
    label: "Suspension & Steering",
    Icon: Settings2,
    iconCls: "text-emerald-400",
    defaultOpen: false,
    fields: [
      {
        label: "Front Spring",
        jsonKey: "front_spring_type",
        col: "front_spring_type",
      },
      {
        label: "Rear Spring",
        jsonKey: "rear_spring_type",
        col: "rear_spring_type",
      },
      { label: "Steering", jsonKey: "steering_type", col: "steering_type" },
    ],
  },
];

/* ── Copy-to-clipboard button ───────────────────────────────────────── */
function CopyBtn({ text, label = "Copied" }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyText(text);
      setCopied(true);
      toast(`${label} copied`, "info");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy to clipboard", "error");
    }
  };

  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className="text-txt-muted hover:text-accent transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-success" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/* ── Editable spec row ──────────────────────────────────────────────── */
function SpecRow({ label, value, col, vin, history }) {
  const { user } = useAuth();
  const isTrusted = history.some(
    (h) => h.field_name === col && h.is_trusted === true,
  );
  const isVerified = history.some(
    (h) => h.field_name === col && h.is_verified === true,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (v) => updateVehicle(vin, { [col]: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle", vin] });
      setEditing(false);
      toast(`${label} updated`, "success");
    },
    onError: (err) => {
      toast(err.response?.data?.error ?? `Failed to update ${label}`, "error");
    },
  });

  const display =
    value !== null && value !== undefined && value !== "" && value !== 0
      ? String(value)
      : null;

  const openEdit = () => {
    setDraft(display ?? "");
    setEditing(true);
  };
  const save = () => {
    if (draft.trim() === (display ?? "")) {
      setEditing(false);
      return;
    }
    mutation.mutate(draft.trim());
  };

  if (editing) {
    return (
      <div className="spec-row">
        <span className="spec-label">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="bg-bg-elevated border border-accent/40 rounded-lg px-2.5 py-1 text-sm text-txt-primary w-36 focus:outline-none focus:border-accent transition-all"
          />
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="text-success hover:opacity-75 transition-opacity"
          >
            {mutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-txt-muted hover:text-txt-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="spec-row group">
      <span className="spec-label">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`spec-value ${display ? "" : "opacity-30"}`}>
          {display ?? "—"}
        </span>

        <FieldHistoryIndicator fieldName={col} history={history} vin={vin} />
        {/* Show edit button only when neither verified nor trusted */}

        {isVerified && (
          <span
            title="This value has been verified and locked"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md
              bg-success/10 border border-success/25 text-success text-[10px] font-semibold"
          >
            <ShieldCheck className="w-3 h-3" />
            Verified
          </span>
        )}

        {isTrusted && (
          <span
            title="This source has been marked as trusted"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md
              bg-sky-500/10 border border-sky-500/25 text-sky-500 text-[10px] font-semibold"
          >
            <ShieldCheck className="w-3 h-3" />
            Trusted
          </span>
        )}
        {!isVerified && (
          <button
            onClick={openEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-muted hover:text-accent"
            title={`Edit ${label}`}
          >
            <Edit3 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Collapsible spec section with completeness badge ───────────────── */
function SpecSection({ section, vehicle, vin, expandAll }) {
  const [open, setOpen] = useState(section.defaultOpen);
  const { Icon, iconCls, label, fields } = section;

  /* Sync with expand-all control */
  useEffect(() => {
    if (expandAll !== null) setOpen(expandAll);
  }, [expandAll]);

  const filled = fields.filter(({ jsonKey }) => {
    const v = vehicle[jsonKey];
    return v !== null && v !== undefined && v !== "" && v !== 0;
  }).length;
  const allFilled = filled === fields.length;

  return (
    <div className="section-card animate-fade-in">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="section-title">
          <Icon className={`w-4 h-4 ${iconCls}`} />
          {label}
          {/* Completeness badge */}
          <span
            className={`ml-1.5 text-[10px] font-mono tabular-nums ${allFilled ? "text-success/60" : "text-txt-muted/40"}`}
          >
            {filled}/{fields.length}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-txt-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-txt-muted" />
        )}
      </button>
      {open && (
        <div className="mt-3">
          {fields.map(({ label: lbl, jsonKey, col }) => (
            <SpecRow
              key={col}
              label={lbl}
              value={vehicle[jsonKey]}
              col={col}
              vin={vin}
              history={vehicle.history ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Custom fields section ──────────────────────────────────────────── */
function CustomFieldsSection({ customFields, vin }) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const qc = useQueryClient();
  const toast = useToast();

  const entries = Object.entries(customFields ?? {});

  const addMut = useMutation({
    mutationFn: () =>
      updateVehicle(vin, {
        custom_fields: {
          ...(customFields ?? {}),
          [newKey.trim()]: newVal.trim(),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle", vin] });
      toast("Custom field added", "success");
      setNewKey("");
      setNewVal("");
      setShowAdd(false);
    },
    onError: (err) =>
      toast(err.response?.data?.error ?? "Failed to add field", "error"),
  });

  const removeField = async (key) => {
    try {
      const updated = { ...(customFields ?? {}) };
      delete updated[key];
      await updateVehicle(vin, { custom_fields: updated });
      qc.invalidateQueries({ queryKey: ["vehicle", vin] });
      toast("Field removed", "info");
    } catch (err) {
      toast(err.response?.data?.error ?? "Failed to remove field", "error");
    }
  };

  return (
    <div className="section-card animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <span className="section-title">
            <Layers className="w-4 h-4 text-cyan-400" />
            Custom Fields
            <span className="ml-1.5 text-[10px] font-mono text-txt-muted/40 tabular-nums">
              ({entries.length})
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAdd((v) => !v);
              if (!open) setOpen(true);
            }}
            className="p-1.5 rounded-lg text-txt-muted hover:text-accent hover:bg-bg-elevated transition-all"
            title="Add custom field"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1 text-txt-muted"
          >
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          {showAdd && (
            <div className="flex gap-2 mb-3 animate-fade-in">
              <input
                autoFocus
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Field name"
                className="flex-1 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent transition-all"
              />
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  newKey.trim() &&
                  newVal.trim() &&
                  addMut.mutate()
                }
                placeholder="Value"
                className="flex-1 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent transition-all"
              />
              <button
                onClick={() => addMut.mutate()}
                disabled={!newKey.trim() || !newVal.trim() || addMut.isPending}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
              >
                {addMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-txt-muted hover:text-txt-secondary transition-colors p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {entries.length === 0 ? (
            <p className="text-xs text-txt-muted text-center py-4 opacity-50">
              No custom fields — click <span className="font-mono">+</span> to
              add one
            </p>
          ) : (
            entries.map(([k, v]) => (
              <div key={k} className="spec-row group">
                <span className="spec-label capitalize">
                  {k.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="spec-value">{String(v)}</span>
                  <button
                    onClick={() => removeField(k)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-muted hover:text-danger"
                    title={`Remove ${k}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Record metadata strip ──────────────────────────────────────────── */
function RecordMeta({ createdAt, updatedAt }) {
  const fmt = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  return (
    <div className="section-card animate-fade-in mt-3">
      <span className="section-title mb-3">
        <Layers className="w-4 h-4 text-txt-muted/60" />
        Record
      </span>
      <div className="mt-3">
        <div className="spec-row">
          <span className="spec-label">Created</span>
          <span className="spec-value font-mono text-xs">{fmt(createdAt)}</span>
        </div>
        <div className="spec-row">
          <span className="spec-label">Last Updated</span>
          <span className="spec-value font-mono text-xs">{fmt(updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Hero badge pills ───────────────────────────────────────────────── */
function HeroBadge({ label, variant = "default" }) {
  if (!label) return null;
  const styles = {
    default: "bg-bg-elevated border-border-subtle text-txt-secondary",
    fuel: "bg-amber-400/10 border-warn/25 text-warn",
    drive: "bg-accent/10 border-accent/25 text-accent",
  };
  return <span className={`badge border ${styles[variant]}`}>{label}</span>;
}

/* ── Quick VIN lookup — lives in the header ─────────────────────────── */
function QuickVinSearch() {
  const [raw, setRaw] = useState("");
  const navigate = useNavigate();
  const isReady = raw.length === 17;

  const go = () => {
    if (!isReady) return;
    navigate(`/v/${raw}`);
    setRaw("");
  };

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-txt-muted/60 pointer-events-none" />
        <input
          value={raw}
          onChange={(e) =>
            setRaw(
              e.target.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase()
                .slice(0, 17),
            )
          }
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Quick VIN lookup…"
          className={`w-36 lg:w-44 bg-bg-elevated border rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono
                      text-txt-primary placeholder:font-sans placeholder:text-txt-muted/50
                      focus:outline-none transition-all
                      ${isReady ? "border-accent" : "border-border-subtle focus:border-accent/50"}`}
        />
      </div>
      <button
        onClick={go}
        disabled={!isReady}
        title="Go to VIN"
        className="p-1.5 rounded-lg bg-accent/10 text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/20 transition-all"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   VehiclePage
══════════════════════════════════════════════════════════════════════ */
export default function VehiclePage() {
  const { vin } = useParams();
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };
  /* null = use section defaults, true = all open, false = all closed */
  const [expandAll, setExpandAll] = useState(null);

  const {
    data: vehicle,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["vehicle", vin],
    queryFn: () => getVehicle(vin).then((r) => r.data),
    enabled: !!vin,
    refetchOnWindowFocus: false,
    retry: false,
  });

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-txt-secondary text-sm font-medium">
            Decoding VIN…
          </p>
          <p className="font-mono text-xs text-txt-muted mt-1.5 tracking-widest">
            {vin}
          </p>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────── */
  if (isError) {
    const errMsg =
      error?.response?.data?.error ??
      error?.message ??
      "An unexpected error occurred";
    const isNetwork = !error?.response;
    return (
      <div className="min-h-screen bg-bg-base flex flex-col">
        <header className="border-b border-border-subtle px-6 h-14 flex items-center">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-txt-muted hover:text-txt-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-bg-card border border-danger/20 rounded-2xl p-8 shadow-card text-center">
              <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto mb-5">
                {isNetwork ? (
                  <WifiOff className="w-8 h-8 text-danger/80" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-danger/80" />
                )}
              </div>
              <h2 className="text-xl font-bold text-txt-primary mb-2">
                Decode Failed
              </h2>
              <div className="inline-flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-1.5 mb-4">
                <Fingerprint className="w-3.5 h-3.5 text-accent" />
                <span className="font-mono text-xs text-txt-muted tracking-widest">
                  {vin}
                </span>
              </div>
              <div className="bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 mb-6 text-left">
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                  {isNetwork ? "Network Error" : "Server Error"}
                </p>
                <p className="text-sm text-txt-secondary leading-relaxed">
                  {errMsg}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bg-elevated border border-border-subtle rounded-xl text-sm text-txt-primary hover:border-border transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Go back
                </button>
                <button
                  onClick={() => refetch()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/10 border border-accent/30 rounded-xl text-sm text-accent hover:bg-accent/20 transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-bg-base/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-txt-muted hover:text-txt-primary text-sm transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-4 w-px bg-border-subtle" />
          <Fingerprint className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-mono text-xs text-txt-muted tracking-widest hidden md:block">
            {vehicle.example_build_number}
          </span>
          <CopyBtn text={vin} label="VIN" />
          <div className="flex-1 min-w-0 ml-1">
            <p className="text-sm font-semibold text-txt-primary truncate">
              {title}
            </p>
          </div>
          <QuickVinSearch />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7">
        {/* Hero */}
        <div className="mb-7 animate-slide-up">
          <p className="text-xs font-semibold text-txt-muted uppercase tracking-widest mb-1">
            {vehicle.make}
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-txt-primary leading-none">
            {vehicle.year}&nbsp;
            <span className="text-txt-secondary font-bold">
              {vehicle.model}
            </span>
          </h1>
          {(vehicle.trim || vehicle.series) && (
            <p className="mt-2 text-txt-secondary">
              {[vehicle.trim, vehicle.series].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <HeroBadge label={vehicle.body_type} />
            {vehicle.doors && <HeroBadge label={`${vehicle.doors}-door`} />}
            <HeroBadge label={vehicle.fuel_type} variant="fuel" />
            <HeroBadge label={vehicle.drive_type} variant="drive" />
            {vehicle.cylinders > 0 && (
              <HeroBadge label={`${vehicle.cylinders}-cyl`} />
            )}
            {vehicle.displacement_l > 0 && (
              <HeroBadge label={`${vehicle.displacement_l}L`} />
            )}
          </div>
          {/* VIN chip with copy */}
          <div className="mt-4 inline-flex items-center gap-2 bg-bg-card border border-border-subtle rounded-lg px-3 py-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-accent" />
            <span className="font-mono text-xs text-txt-muted tracking-widest">
              {vin}
            </span>
            <CopyBtn text={vin} label="VIN" />
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          {/* ── Specs column ───────────────────────────────────── */}
          <div>
            {/* Expand / Collapse all bar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest">
                Specifications
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpandAll(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-txt-muted hover:text-txt-primary rounded-lg hover:bg-bg-elevated transition-all"
                >
                  <ChevronsUpDown className="w-3 h-3" />
                  Expand all
                </button>
                <span className="text-border opacity-60 select-none">·</span>
                <button
                  onClick={() => setExpandAll(false)}
                  className="px-2 py-1 text-xs text-txt-muted hover:text-txt-primary rounded-lg hover:bg-bg-elevated transition-all"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {SPEC_SECTIONS.map((section) => (
                <SpecSection
                  key={section.id}
                  section={section}
                  vehicle={vehicle}
                  vin={vin}
                  expandAll={expandAll}
                />
              ))}
              <CustomFieldsSection
                customFields={vehicle.custom_fields}
                vin={vin}
              />
            </div>
          </div>

          {/* Notes column */}
          <div className="xl:sticky xl:top-[3.75rem] xl:self-start xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto pb-4">
            <NotesPanel vehicle={vehicle} vin={vin} />
          </div>
        </div>
      </div>
    </div>
  );
}
