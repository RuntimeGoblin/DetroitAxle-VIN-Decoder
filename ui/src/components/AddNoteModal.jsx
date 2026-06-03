import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  MessageSquare,
  Hash,
  Plus,
  Loader2,
  AlertCircle,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { addNote } from "../api/notes";
import { useToast } from "../contexts/ToastContext";

function StyledSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm text-txt-primary focus:outline-none focus:border-accent transition-all pr-10"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted pointer-events-none" />
    </div>
  );
}

export default function AddNoteModal({ vin, categories, onClose }) {
  const [type, setType] = useState("free_text");
  const [freeText, setFreeText] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPartNumber, setListingPartNumber] = useState("");
  const [error, setError] = useState("");

  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (payload) => addNote(vin, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle", vin] });
      const labels = {
        free_text: "Note added",
        part_number: "Part number added",
        listing_error: "Listing error reported",
      };
      toast(labels[type] ?? "Note added", "success");
      onClose();
    },
    onError: (err) =>
      setError(err.response?.data?.error ?? "Failed to add note"),
  });

  /* Close on Escape */
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (type === "free_text") {
      if (!freeText.trim()) {
        setError("Note text is required");
        return;
      }
      mutation.mutate({ note_type: "free_text", free_text: freeText.trim() });
    } else if (type === "listing_error") {
      if (!listingDescription.trim()) {
        setError("Error description is required");
        return;
      }
      // Added validation to make the listing error part number required
      if (!listingPartNumber.trim()) {
        setError("Related part number is required");
        return;
      }
      mutation.mutate({
        note_type: "listing_error",
        free_text: listingDescription.trim(),
        part_number: listingPartNumber.trim(),
      });
    } else {
      if (!partNumber.trim()) {
        setError("Part number is required");
        return;
      }
      mutation.mutate({
        note_type: "part_number",
        part_number: partNumber.trim(),
        part_category_id: categoryId ? Number(categoryId) : undefined,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-bg-card border border-border rounded-2xl shadow-modal animate-pop">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border-subtle">
          <h3 className="font-bold text-txt-primary text-base">Add Note</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
              Note Type
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("free_text");
                  setError("");
                }}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all ${
                  type === "free_text"
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "bg-bg-elevated border-border-subtle text-txt-muted hover:border-border"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold leading-none">
                    Free Text
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5">General note</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("part_number");
                  setError("");
                }}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all ${
                  type === "part_number"
                    ? "bg-warn/10 border-warn/40 text-warn"
                    : "bg-bg-elevated border-border-subtle text-txt-muted hover:border-border"
                }`}
              >
                <Hash className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold leading-none">Part #</p>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    OEM / aftermarket
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("listing_error");
                  setError("");
                }}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all ${
                  type === "listing_error"
                    ? "bg-danger/10 border-danger/40 text-danger"
                    : "bg-bg-elevated border-border-subtle text-txt-muted hover:border-border"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold leading-none">Error</p>
                  <p className="text-[10px] opacity-60 mt-0.5">Listing issue</p>
                </div>
              </button>
            </div>
          </div>

          {/* Fields — key prop re-mounts input on type switch to re-trigger autoFocus */}
          {type === "free_text" ? (
            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
                Note Text
              </p>
              <textarea
                key="free-text-area"
                autoFocus
                value={freeText}
                onChange={(e) => {
                  setFreeText(e.target.value);
                  setError("");
                }}
                rows={4}
                placeholder="Describe your findings, observations, or instructions…"
                className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm text-txt-primary placeholder:text-txt-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15 transition-all"
              />
            </div>
          ) : type === "listing_error" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 bg-danger/5 border border-danger/15 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 text-danger mt-0.5 shrink-0" />
                <p className="text-[11px] text-danger/80 leading-relaxed">
                  Flag incorrect, missing, or conflicting information in this
                  listing. Include a part number if the error is part-specific.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
                  Error Description{" "}
                  <span className="text-danger text-[10px] normal-case font-normal tracking-normal">
                    required
                  </span>
                </p>
                <textarea
                  key="listing-error-textarea"
                  autoFocus
                  value={listingDescription}
                  onChange={(e) => {
                    setListingDescription(e.target.value);
                    setError("");
                  }}
                  rows={3}
                  placeholder="e.g. Wrong engine displacement listed, should be 2.5L not 2.0L…"
                  className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm text-txt-primary placeholder:text-txt-muted resize-none focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger/15 transition-all"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
                  Related Part #{" "}
                  <span className="text-danger text-[10px] normal-case font-normal tracking-normal">
                    required
                  </span>
                </p>

                <input
                  key="listing-error-part-input"
                  type="text"
                  value={listingPartNumber}
                  onChange={(e) => {
                    setListingPartNumber(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="e.g. 12345-67890"
                  className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm font-mono text-txt-primary placeholder:text-txt-muted placeholder:font-sans focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger/15 transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
                  Part Number
                </p>
                <input
                  key="part-number-input"
                  autoFocus
                  type="text"
                  value={partNumber}
                  onChange={(e) => {
                    setPartNumber(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="e.g. 12345-67890"
                  className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm font-mono text-txt-primary placeholder:text-txt-muted placeholder:font-sans focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15 transition-all"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
                  Category{" "}
                  <span className="normal-case font-normal tracking-normal text-txt-muted/50">
                    (optional)
                  </span>
                </p>
                <StyledSelect
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-2.5 text-xs animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-subtle rounded-xl text-sm text-txt-secondary hover:text-txt-primary hover:border-border transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`flex-1 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${
                type === "listing_error"
                  ? "bg-danger hover:opacity-90 shadow-none"
                  : "bg-accent hover:bg-accent-hover shadow-glow-sm"
              }`}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : type === "listing_error" ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {type === "free_text"
                ? "Add Note"
                : type === "listing_error"
                  ? "Report Error"
                  : "Add Part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
