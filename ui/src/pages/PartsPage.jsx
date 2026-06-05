import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Package, Search, Plus, X, Save, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, CheckCircle2, Car, AlertCircle, Edit3,
  Copy,
} from "lucide-react";
import Navbar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  listParts, getPart, createPart, updatePart,
  deletePart, addRule, updateRule, deleteRule, getCompatibleVehicles, clonePart,
} from "../api/parts";
import { getCategories } from "../api/categories";

/* ── Category selector ────────────────────────────────────────────── */
// Fetches from the shared PartCategory model (same categories agents use).
// React Query caches by key so multiple instances share one request.
function CategorySelect({ value, onChange, className }) {
  const { data: raw = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const options = raw.map(c => c.name);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    >
      <option value="">— select category —</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

/* ── Permission helper ────────────────────────────────────────────── */
function canEdit(user) {
  return user?.role === "admin" || user?.role === "listing" || user?.role === "dnr";
}

/* ── Inline fit status — no floating tooltip, no overflow clipping ── */
function FitStatus({ result, notes = [] }) {
  if (result === "exact")
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 border border-success/25 text-success text-[10px] font-bold shrink-0">
        <CheckCircle2 className="w-3 h-3" />Confirmed
      </span>
    );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-warn/10 border border-warn/25 text-warn text-[10px] font-bold shrink-0">
      <AlertTriangle className="w-3 h-3" />Verify
    </span>
  );
}

/* ── Vehicle row with inline notes ──────────────────────────────────── */
function VehicleRow({ v }) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-txt-primary leading-snug">
            {v.year} {v.make} {v.model}
          </p>
          {v.trim && (
            <p className="text-[10px] text-txt-muted truncate mt-0.5">{v.trim}</p>
          )}
          {v.build_key && (
            <p className="text-[10px] font-mono text-txt-muted/50 mt-0.5">{v.build_key}</p>
          )}
          {/* Matched rule note — context from the specific rule that fired */}
          {v.rule_note && (
            <p className="text-[10px] text-txt-muted/80 mt-0.5 italic">{v.rule_note}</p>
          )}
        </div>
        <FitStatus result={v.fit_result} />
      </div>
      {/* Callout verification notes — inline, never clipped */}
      {v.fit_result === "note" && v.fit_notes?.length > 0 && (
        <div className="space-y-1">
          {v.fit_notes.map((note, i) => (
            <p key={i} className="text-[10px] text-warn flex items-start gap-1.5 leading-snug">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Rule Editor — one fitment rule
══════════════════════════════════════════════════════════════════ */

// Quick-pick callout fields — includes common custom field patterns
const CALLOUT_SUGGESTIONS = [
  { field: "Lugs",             hint: "wheel lug count" },
  { field: "Production Date",  hint: "build/production date" },
  { field: "Build Date",       hint: "build/production date" },
  { field: "custom_fields.engine_chassis", hint: "e.g. Z71" },
  { field: "custom_fields.brake_package",  hint: "e.g. JE7" },
  { field: "custom_fields.brake_code",     hint: "brake code" },
  { field: "custom_fields.suspension",     hint: "suspension pkg" },
];

function CalloutRow({ co, onChange, onDelete }) {
  const inputCls = "w-full text-xs px-2.5 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-txt-primary focus:outline-none focus:border-accent transition-all";

  // Filter suggestions to ones that start with what the user has typed
  const prefix = co.field.toLowerCase();
  const shown  = CALLOUT_SUGGESTIONS
    .filter(s => s.field.toLowerCase().startsWith(prefix) && s.field !== co.field)
    .slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
        <div>
          <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">
            Field <span className="normal-case font-normal tracking-normal text-txt-muted/50">(vehicle field or custom_fields.key)</span>
          </label>
          <input value={co.field} onChange={e => onChange({ ...co, field: e.target.value })}
            placeholder="e.g. Lugs  or  custom_fields.engine_chassis"
            className={inputCls} />
          {shown.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {shown.map(s => (
                <button key={s.field} onClick={() => onChange({ ...co, field: s.field })}
                  className="text-[9px] text-accent bg-accent/8 border border-accent/20 rounded px-1.5 py-0.5 hover:bg-accent/15 transition-colors"
                  title={s.hint}>
                  {s.field}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Expected value</label>
          <input value={co.value} onChange={e => onChange({ ...co, value: e.target.value })}
            placeholder="e.g. 8  or  Z71  or  After 09/04/2012"
            className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">
            Verify message <span className="normal-case font-normal tracking-normal text-txt-muted/50">(shown to agent when field is missing)</span>
          </label>
          <input value={co.note} onChange={e => onChange({ ...co, note: e.target.value })}
            placeholder="e.g. Verify 8-lug wheels before ordering"
            className={inputCls} />
        </div>
        <button onClick={onDelete} className="mt-6 p-1.5 text-txt-muted hover:text-danger transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RuleEditor({ rule, partId, onSaved, onCancel, isNew = false }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const [form, setForm] = useState({
    year_min: rule?.year_min ?? "",
    year_max: rule?.year_max ?? "",
    make: rule?.make ?? "",
    model: rule?.model ?? "",
    trim: rule?.trim ?? "",
    cylinders: rule?.cylinders ?? "",
    displacement_l: rule?.displacement_l ?? "",
    fuel_type: rule?.fuel_type ?? "",
    drive_type: rule?.drive_type ?? "",
    body_type: rule?.body_type ?? "",
    transmission_type: rule?.transmission_type ?? "",
    note: rule?.note ?? "",
    callouts: rule?.callouts ?? [],
  });

  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        year_min: form.year_min !== "" ? Number(form.year_min) : null,
        year_max: form.year_max !== "" ? Number(form.year_max) : null,
      };
      return isNew
        ? addRule(partId, payload).then(r => r.data)
        : updateRule(partId, rule.id, payload).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part", partId] });
      toast(isNew ? "Rule added" : "Rule updated", "success");
      onSaved();
    },
    onError: err => toast(err.response?.data?.error ?? "Failed", "error"),
  });

  const addCallout = () =>
    setForm(p => ({ ...p, callouts: [...p.callouts, { field: "", value: "", note: "" }] }));
  const updateCallout = (i, co) =>
    setForm(p => { const cs = [...p.callouts]; cs[i] = co; return { ...p, callouts: cs }; });
  const removeCallout = i =>
    setForm(p => ({ ...p, callouts: p.callouts.filter((_, j) => j !== i) }));

  const inputCls = "w-full text-xs px-2.5 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-txt-primary placeholder:text-txt-muted/60 focus:outline-none focus:border-accent transition-all";

  return (
    <div className="border border-accent/20 bg-accent/5 rounded-2xl p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-accent uppercase tracking-wider">
          {isNew ? "New Fitment Rule" : "Edit Rule"}
        </p>
        {/* Fitment table column mapping — quick reference */}
        <div className="flex items-center gap-1 text-[9px] text-txt-muted/60 flex-wrap justify-end">
          <span className="font-semibold text-txt-muted">Fitment table →</span>
          <span>Year</span><span className="text-txt-muted/30">→ Year from/to</span>
          <span className="ml-1">Submodel</span><span className="text-txt-muted/30">→ Trim</span>
          <span className="ml-1">Liter</span><span className="text-txt-muted/30">→ Displacement</span>
          <span className="ml-1">Note</span><span className="text-txt-muted/30">→ Application note</span>
        </div>
      </div>

      {/* Required conditions */}
      <div>
        <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider mb-2">Required Conditions — leave blank for "any"</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Year from</label>
            <input type="number" value={form.year_min} onChange={sf("year_min")} placeholder="2013" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Year to</label>
            <input type="number" value={form.year_max} onChange={sf("year_max")} placeholder="2019" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Make</label>
            <input value={form.make} onChange={sf("make")} placeholder="Ford" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Model</label>
            <input value={form.model} onChange={sf("model")} placeholder="Explorer" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-txt-muted block mb-1">
              Trim / Submodel
              <span className="text-txt-muted/50 ml-1">— comma-separated for multiple (e.g. Base, XLT, Limited)</span>
            </label>
            <input value={form.trim} onChange={sf("trim")} placeholder="Base, XLT, Limited, Sport" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Cylinders</label>
            <input value={form.cylinders} onChange={sf("cylinders")} placeholder="8" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Displacement / Liter</label>
            <input value={form.displacement_l} onChange={sf("displacement_l")} placeholder="3.5" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Drive Type</label>
            <select value={form.drive_type} onChange={sf("drive_type")} className={inputCls + " appearance-none cursor-pointer"}>
              <option value="">Any</option>
              {["FWD","RWD","AWD","4WD"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Fuel Type</label>
            <select value={form.fuel_type} onChange={sf("fuel_type")} className={inputCls + " appearance-none cursor-pointer"}>
              <option value="">Any</option>
              {["Gasoline","Diesel","Electric","Hybrid","Flex Fuel"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Transmission</label>
            <select value={form.transmission_type} onChange={sf("transmission_type")} className={inputCls + " appearance-none cursor-pointer"}>
              <option value="">Any</option>
              {["Automatic","Manual","CVT","DCT"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">Body Type</label>
            <input value={form.body_type} onChange={sf("body_type")} placeholder="Truck, Sedan…" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-txt-muted block mb-1">
              Application note
              <span className="text-txt-muted/50 ml-1 normal-case font-normal tracking-normal">
                — shown to agents next to the part (e.g. "14.29 inch rotor" or "Built After 09/04/2012")
              </span>
            </label>
            <input value={form.note} onChange={sf("note")} placeholder="e.g. 14.29 inch (363mm) Front Rotor  or  Built After 09/04/2012" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Call-outs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">
            Call-outs
            <span className="normal-case font-normal tracking-normal ml-1 text-txt-muted/60">
              — for machine-checkable conditions (Lugs, chassis codes, custom fields).
              If the vehicle has the field and it matches → ✓ Confirmed.
              If the field is missing → ⚠ Verify shown to agent.
              For date conditions like "Built After 09/04/2012" use Application note instead.
            </span>
          </p>
          <button onClick={addCallout}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
        </div>
        {form.callouts.length === 0 ? (
          <p className="text-xs text-txt-muted/60 italic">No call-outs — part fits all matching vehicles unconditionally.</p>
        ) : (
          <div className="space-y-3">
            {form.callouts.map((co, i) => (
              <CalloutRow key={i} co={co}
                onChange={updated => updateCallout(i, updated)}
                onDelete={() => removeCallout(i)} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-2 border-t border-border-subtle/50">
        <button onClick={onCancel} className="text-sm text-txt-muted hover:text-txt-primary transition-colors">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all">
          {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isNew ? "Add Rule" : "Save Rule"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Part Editor (right panel)
══════════════════════════════════════════════════════════════════ */
function PartEditor({ partId, onClose, onSelect, canEditFlag }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const { data: part, isLoading } = useQuery({
    queryKey: ["part", partId],
    queryFn: () => getPart(partId).then(r => r.data),
    enabled: !!partId,
    staleTime: 30_000,
  });

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm]       = useState(null);
  const [addingRule, setAddingRule]   = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showVehicles, setShowVehicles] = useState(false);
  const [showClone, setShowClone]     = useState(false);

  useEffect(() => {
    if (part) setInfoForm({
      part_number: part.part_number, name: part.name,
      category: part.category ?? "", description: part.description ?? "",
      internal_note: part.internal_note ?? "",
    });
  }, [part?.id]);

  const saveMut = useMutation({
    mutationFn: () => updatePart(partId, infoForm).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["part", partId] }); qc.invalidateQueries({ queryKey: ["parts"] }); toast("Part updated", "success"); setEditingInfo(false); },
    onError: err => toast(err.response?.data?.error ?? "Update failed", "error"),
  });

  const delRuleMut = useMutation({
    mutationFn: (ruleId) => deleteRule(partId, ruleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["part", partId] }); toast("Rule deleted", "info"); },
    onError: () => toast("Delete failed", "error"),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["compatible-vehicles", partId],
    queryFn: () => getCompatibleVehicles(partId).then(r => r.data),
    enabled: !!partId && showVehicles,
    staleTime: 60_000,
  });

  if (!partId) return (
    <div className="flex flex-col flex-1 items-center justify-center text-center p-12">
      <Package className="w-16 h-16 text-accent/20 mb-4" />
      <p className="text-sm font-bold text-txt-secondary mb-1">Select a part</p>
      <p className="text-xs text-txt-muted max-w-xs">Choose from the list on the left, or create a new part.</p>
    </div>
  );

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-accent/50" /></div>;

  const sif = k => e => setInfoForm(p => ({ ...p, [k]: e.target.value }));
  const inputCls = "w-full text-sm px-3 py-2.5 bg-bg-elevated border border-border-subtle rounded-xl text-txt-primary focus:outline-none focus:border-accent transition-all";

  return (
    <div className="flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border-subtle bg-bg-surface/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-base font-extrabold text-txt-primary">{part.part_number}</p>
            {canEditFlag && !editingInfo && (
              <>
                <button onClick={() => setEditingInfo(true)} title="Edit part details"
                  className="p-1 text-txt-muted hover:text-accent transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowClone(true)} title="Clone this part (duplicate with all rules)"
                  className="p-1 text-txt-muted hover:text-accent transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <p className="text-sm text-txt-secondary mt-0.5">{part.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {part.category && <span className="text-[10px] text-accent bg-accent/10 border border-accent/20 rounded-md px-2 py-0.5">{part.category}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors shrink-0"><X className="w-4 h-4" /></button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 py-5 space-y-5">

        {/* Edit info form */}
        {editingInfo && infoForm && (
          <div className="border border-border-subtle rounded-2xl p-4 space-y-3 animate-fade-in">
            <p className="text-xs font-bold text-txt-primary">Edit Part Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Part Number *</label>
                <input value={infoForm.part_number} onChange={sif("part_number")} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Name *</label>
                <input value={infoForm.name} onChange={sif("name")} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Category</label>
                <CategorySelect
                  value={infoForm.category ?? ""}
                  onChange={v => setInfoForm(p => ({ ...p, category: v }))}
                  className={inputCls + " appearance-none cursor-pointer"}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Description</label>
              <textarea value={infoForm.description} onChange={sif("description")} rows={2} className={inputCls + " resize-none"} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block mb-1">Internal Note</label>
              <textarea value={infoForm.internal_note} onChange={sif("internal_note")} rows={2} className={inputCls + " resize-none"} placeholder="Visible to team only" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingInfo(false)} className="text-sm text-txt-muted hover:text-txt-primary transition-colors">Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl">
                {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </div>
        )}

        {/* Description / note */}
        {!editingInfo && (part.description || part.internal_note) && (
          <div className="space-y-2">
            {part.description && <p className="text-xs text-txt-secondary leading-relaxed">{part.description}</p>}
            {part.internal_note && (
              <div className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider mb-0.5">Internal Note</p>
                <p className="text-xs text-txt-secondary">{part.internal_note}</p>
              </div>
            )}
          </div>
        )}

        {/* Fitment Rules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-txt-primary">Fitment Rules
              <span className="ml-1.5 text-txt-muted font-normal text-[10px]">({part.fitment_rules?.length ?? 0})</span>
            </p>
            {canEditFlag && (
              <button onClick={() => { setAddingRule(true); setEditingRule(null); }}
                className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:text-accent/80 transition-colors">
                <Plus className="w-3.5 h-3.5" />Add Rule
              </button>
            )}
          </div>

          {addingRule && (
            <RuleEditor partId={partId} isNew onSaved={() => setAddingRule(false)} onCancel={() => setAddingRule(false)} />
          )}

          {(part.fitment_rules ?? []).length === 0 && !addingRule ? (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border-subtle rounded-xl text-center">
              <AlertCircle className="w-7 h-7 text-txt-muted/30 mb-2" />
              <p className="text-xs text-txt-muted">No fitment rules</p>
              <p className="text-[10px] text-txt-muted/60 mt-0.5">This part won't appear in any compatibility results</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(part.fitment_rules ?? []).map(rule => (
                <div key={rule.id}>
                  {editingRule === rule.id ? (
                    <RuleEditor rule={rule} partId={partId}
                      onSaved={() => setEditingRule(null)} onCancel={() => setEditingRule(null)} />
                  ) : (
                    <RuleCard rule={rule}
                      canEdit={canEditFlag}
                      onEdit={() => { setEditingRule(rule.id); setAddingRule(false); }}
                      onDelete={() => delRuleMut.mutate(rule.id)}
                      isDeleting={delRuleMut.isPending && delRuleMut.variables === rule.id} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compatible Vehicles */}
        <div className="border border-border-subtle rounded-2xl overflow-hidden">
          {/* Header — always visible, click to toggle list */}
          <button
            onClick={() => setShowVehicles(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${showVehicles ? "bg-bg-elevated/50" : "hover:bg-bg-elevated/30"}`}
          >
            <span className="flex items-center gap-2">
              <Car className="w-4 h-4 text-accent shrink-0" />
              <span className="text-sm font-bold text-txt-primary">Compatible Vehicles</span>
              {vehiclesData && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  {vehiclesData.exact_count > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-success/10 border border-success/20 text-success font-semibold">
                      {vehiclesData.exact_count} confirmed
                    </span>
                  )}
                  {vehiclesData.note_count > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-warn/10 border border-warn/20 text-warn font-semibold">
                      {vehiclesData.note_count} verify
                    </span>
                  )}
                </div>
              )}
              {vehiclesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent/50" />}
            </span>
            {showVehicles
              ? <ChevronUp className="w-4 h-4 text-txt-muted shrink-0" />
              : <ChevronDown className="w-4 h-4 text-txt-muted shrink-0" />}
          </button>

          {/* Vehicle list — no overflow-hidden on wrapper, notes are inline */}
          {showVehicles && (
            <div className="border-t border-border-subtle">
              {!vehiclesLoading && (vehiclesData?.items ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Car className="w-7 h-7 text-txt-muted/20 mb-2" />
                  <p className="text-xs text-txt-muted">No matching vehicles in database</p>
                  <p className="text-[10px] text-txt-muted/60 mt-0.5">
                    Check that the fitment rules have the right make, year range, and specs
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto overscroll-contain divide-y divide-border-subtle/50">
                  {(vehiclesData?.items ?? []).map(v => (
                    <VehicleRow key={v.id} v={v} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clone modal */}
      {showClone && part && (
        <ClonePartModal
          source={{ id: part.id, part_number: part.part_number, name: part.name, rules_count: part.fitment_rules?.length }}
          onClose={() => setShowClone(false)}
          onCreated={id => { onSelect(id); }}
        />
      )}
    </div>
  );
}

/* ── Rule card (display, not edit) ───────────────────────────────── */
function RuleCard({ rule, canEdit, onEdit, onDelete, isDeleting }) {
  const [confirm, setConfirm] = useState(false);
  const conditions = [
    rule.year_min && rule.year_max ? `${rule.year_min}–${rule.year_max}` : rule.year_min ? `${rule.year_min}+` : rule.year_max ? `≤${rule.year_max}` : null,
    rule.make, rule.model, rule.trim,
    rule.cylinders ? `${rule.cylinders}-cyl` : null,
    rule.displacement_l ? `${rule.displacement_l}L` : null,
    rule.fuel_type, rule.drive_type, rule.body_type, rule.transmission_type,
  ].filter(Boolean);

  return (
    <div className="border border-border-subtle rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {conditions.length === 0
            ? <span className="text-[10px] text-txt-muted italic">Fits all vehicles (no conditions)</span>
            : conditions.map((c, i) => (
              <span key={i} className="text-[10px] bg-bg-elevated border border-border-subtle rounded-md px-2 py-0.5 text-txt-secondary">{c}</span>
            ))
          }
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1 text-txt-muted hover:text-accent transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
            {!confirm
              ? <button onClick={() => setConfirm(true)} className="p-1 text-txt-muted hover:text-danger transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              : (
                <div className="flex items-center gap-1">
                  <button onClick={() => { onDelete(); setConfirm(false); }} disabled={isDeleting}
                    className="px-2 py-0.5 text-[10px] bg-danger text-white rounded font-semibold">Delete</button>
                  <button onClick={() => setConfirm(false)} className="p-0.5 text-txt-muted"><X className="w-3 h-3" /></button>
                </div>
              )
            }
          </div>
        )}
      </div>
      {rule.callouts?.length > 0 && (
        <div className="space-y-1">
          {rule.callouts.map((co, i) => (
            <p key={i} className="text-[10px] text-txt-muted flex items-center gap-1.5">
              <AlertTriangle className="w-2.5 h-2.5 text-warn shrink-0" />
              <span className="font-mono text-warn/80">{co.field} = {co.value}</span>
              {co.note && <span className="text-txt-muted/60">→ {co.note}</span>}
            </p>
          ))}
        </div>
      )}
      {rule.note && <p className="text-[10px] text-txt-muted italic">Note: {rule.note}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   New Part Modal
══════════════════════════════════════════════════════════════════ */
/* ── Clone Part Modal ─────────────────────────────────────────────── */
function ClonePartModal({ source, onClose, onCreated }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [form, setForm] = useState({ part_number: "", name: source.name });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => clonePart(source.id, { part_number: form.part_number.trim(), name: form.name.trim() }).then(r => r.data),
    onSuccess: part => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast(`Cloned → ${part.part_number}`, "success");
      onCreated(part.id);
      onClose();
    },
    onError: err => setError(err.response?.data?.error ?? "Clone failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-bg-card border border-border rounded-2xl shadow-2xl animate-pop overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <span className="font-bold text-txt-primary flex items-center gap-2">
            <Copy className="w-4 h-4 text-accent" />
            Clone Part
          </span>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Source info */}
          <div className="bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider mb-1">Cloning from</p>
            <p className="text-sm font-bold text-txt-primary font-mono">{source.part_number}</p>
            <p className="text-xs text-txt-secondary mt-0.5">{source.name}</p>
            <p className="text-[10px] text-txt-muted mt-1">
              {source.rules_count ?? "?"} fitment rule{source.rules_count !== 1 ? "s" : ""} will be copied
            </p>
          </div>
          {/* New part details */}
          <div>
            <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">New Part Number *</label>
            <input autoFocus value={form.part_number}
              onChange={e => setForm(v => ({ ...v, part_number: e.target.value }))}
              placeholder="e.g. R-800287x2"
              className="input-base font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">Name</label>
            <input value={form.name}
              onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className="input-base" />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/25 text-danger rounded-xl px-3 py-2 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border-subtle rounded-xl text-sm text-txt-secondary hover:border-border transition-all">Cancel</button>
          <button disabled={!form.part_number.trim() || mutation.isPending} onClick={() => mutation.mutate()}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-glow-sm flex items-center justify-center gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Clone &amp; Open
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPartModal({ onClose, onCreated }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [form, setForm] = useState({ part_number:"", name:"", category:"", description:"", internal_note:"" });
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => createPart(form).then(r => r.data),
    onSuccess: part => { qc.invalidateQueries({ queryKey: ["parts"] }); toast("Part created", "success"); onCreated(part.id); onClose(); },
    onError: err => toast(err.response?.data?.error ?? "Create failed", "error"),
  });

  const inputCls = "input-base text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-bg-card border border-border rounded-2xl shadow-2xl animate-pop overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <span className="font-bold text-txt-primary flex items-center gap-2"><Plus className="w-4 h-4 text-accent"/>New Part</span>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary"><X className="w-4 h-4"/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">Part Number *</label>
              <input value={form.part_number} onChange={sf("part_number")} placeholder="RP-55079" className={inputCls} autoFocus />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">Name *</label>
            <input value={form.name} onChange={sf("name")} placeholder="Premium Front Rotor" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">Category</label>
            <CategorySelect
              value={form.category}
              onChange={v => setForm(p => ({ ...p, category: v }))}
              className={inputCls + " appearance-none cursor-pointer"}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-txt-muted uppercase tracking-wider block mb-1">Description</label>
            <textarea value={form.description} onChange={sf("description")} rows={2} className={inputCls + " resize-none"} />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border-subtle rounded-xl text-sm text-txt-secondary hover:border-border transition-all">Cancel</button>
          <button disabled={!form.part_number||!form.name||mutation.isPending} onClick={()=>mutation.mutate()}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-glow-sm flex items-center justify-center gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
            Create Part
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Parts Page
══════════════════════════════════════════════════════════════════ */
export default function PartsPage() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const [draft, setDraft]       = useState("");
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage]         = useState(1);
  const [selectedId, setSelectedId] = useState(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });
  const [showNew, setShowNew] = useState(false);
  const canEditFlag = canEdit(user);

  const { data, isLoading } = useQuery({
    queryKey: ["parts", search, category, page],
    queryFn: () => listParts({ q: search, category, page, page_size: 25 }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Use the same PartCategory model that agents use for note categories
  const { data: rawCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const categories = rawCategories.map(c => c.name);

  const items      = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  const select = id => {
    setSelectedId(id);
    setSearchParams(id ? { id } : {});
  };

  return (
    <div className="flex flex-col bg-bg-base" style={{ height: "100dvh" }}>
      <Navbar user={user} logout={logout} />

      {/* ── Page header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-border-subtle bg-bg-surface/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Package className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-extrabold text-txt-primary">Parts Catalog</span>
          {data && <span className="text-xs text-txt-muted">{data.total_count?.toLocaleString()} parts</span>}
        </div>
        <div className="flex-1" />
        {canEditFlag && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all shadow-glow-sm">
            <Plus className="w-3.5 h-3.5" />New Part
          </button>
        )}
      </div>

      {/* ── Split panel ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[320px_1fr]">

        {/* Left: parts list */}
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-border-subtle">
          {/* Toolbar */}
          <div className="shrink-0 p-3 space-y-2 border-b border-border-subtle">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
                <input value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setSearch(draft); setPage(1); } }}
                  placeholder="Part number or name…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-bg-elevated border border-border-subtle rounded-xl placeholder:text-txt-muted focus:outline-none focus:border-accent transition-all" />
              </div>
            </div>
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="w-full text-xs bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-txt-secondary focus:outline-none focus:border-accent appearance-none cursor-pointer">
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Package className="w-10 h-10 text-txt-muted/20 mb-3" />
                <p className="text-sm font-semibold text-txt-secondary">No parts found</p>
                <p className="text-xs text-txt-muted mt-1">Try a different search</p>
              </div>
            ) : items.map(part => (
              <button key={part.id} onClick={() => select(part.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle/40 transition-all ${part.id === selectedId ? "bg-accent/10 border-l-[3px] border-l-accent pl-3.5" : "hover:bg-bg-elevated/50"}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold font-mono text-txt-primary truncate">{part.part_number}</p>
                  <p className="text-[11px] text-txt-secondary truncate">{part.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {part.category && <span className="text-[10px] text-accent bg-accent/8 rounded px-1.5 py-0.5">{part.category}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-txt-muted tabular-nums">{part.rules_count} rule{part.rules_count !== 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>

          {/* Always-visible count + pagination */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-border-subtle">
            <span className="text-[10px] text-txt-muted tabular-nums">
              {data
                ? `${Math.min((page-1)*25+1, data.total_count)}–${Math.min(page*25, data.total_count)} of ${data.total_count.toLocaleString()} parts`
                : "Loading…"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}
                  className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated disabled:opacity-30 transition-all">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <span className="text-xs text-txt-muted tabular-nums px-1">{page} / {totalPages}</span>
                <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}
                  className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated disabled:opacity-30 transition-all">
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: part editor */}
        <PartEditor partId={selectedId} onClose={() => select(null)} onSelect={select} canEditFlag={canEditFlag} />
      </div>

      {showNew && (
        <NewPartModal
          onClose={() => setShowNew(false)}
          onCreated={id => select(id)}
        />
      )}
    </div>
  );
}
