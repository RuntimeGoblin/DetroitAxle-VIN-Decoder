import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Plus,
  Tag,
  Search,
  X,
  Hash,
  AlertTriangle,
  SlidersHorizontal,
  CheckCircle2, // Added for resolved state icon
} from "lucide-react";
import { getCategories } from "../api/categories";
import NoteCard from "./NoteCard";
import AddNoteModal from "./AddNoteModal";
import CategoryManager from "./CategoryManager";

/* ── Type filter config ─────────────────────────────────────────────── */
const TYPE_FILTERS = [
  { key: "all", label: "All", icon: null },
  { key: "free_text", label: "Notes", icon: MessageSquare },
  { key: "part_number", label: "Parts", icon: Hash },
  { key: "listing_error", label: "Errors", icon: AlertTriangle },
];

/* Types that can have a part number / category association */
const PART_TYPES = new Set(["part_number", "listing_error"]);

export default function NotesPanel({ vehicle, vin }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((r) => r.data),
  });

  const allNotes = vehicle.notes ?? [];

  /* Counts per type */
  const counts = {
    all: allNotes.length,
    free_text: allNotes.filter((n) => n.note_type === "free_text").length,
    part_number: allNotes.filter((n) => n.note_type === "part_number").length,
    listing_error: allNotes.filter((n) => n.note_type === "listing_error")
      .length,
    unresolved_errors: allNotes.filter(
      (n) => n.note_type === "listing_error" && !n.is_resolved,
    ).length,
  };

  /* Categories that have at least one note from a part-type note */
  const activeCategories = categories.filter((cat) =>
    allNotes.some(
      (n) =>
        PART_TYPES.has(n.note_type) && n.part_category_id === cat.category_id,
    ),
  );

  /* Whether the current type filter can show categories */
  const categoryFilterVisible =
    typeFilter === "all" ||
    typeFilter === "part_number" ||
    typeFilter === "listing_error";

  /* Apply type filter */
  let visible =
    typeFilter === "all"
      ? allNotes
      : allNotes.filter((n) => n.note_type === typeFilter);

  /* Apply category filter — only meaningful when part types are shown */
  if (categoryFilter !== null && categoryFilterVisible) {
    visible = visible.filter((n) => n.part_category_id === categoryFilter);
  }

  /* Apply text search */
  if (search.trim()) {
    const q = search.toLowerCase();
    visible = visible.filter((n) => {
      const body = (n.free_text ?? n.part_number ?? "").toLowerCase();
      const category = (n.part_category_id?.name ?? "").toLowerCase();
      const author = (n.username ?? "").toLowerCase();
      return body.includes(q) || category.includes(q) || author.includes(q);
    });
  }

  /* Sort newest first */
  visible = visible
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const hasActiveFilters =
    typeFilter !== "all" || categoryFilter !== null || search.trim();

  const handleTypeFilter = (key) => {
    setTypeFilter(key);
    /* Clear category filter when switching to a type that can't show categories */
    if (!["all", "part_number", "listing_error"].includes(key)) {
      setCategoryFilter(null);
    }
  };

  const clearAllFilters = () => {
    setTypeFilter("all");
    setCategoryFilter(null);
    setSearch("");
  };

  /* N key shortcut → open AddNoteModal */
  useEffect(() => {
    const handler = (e) => {
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName?.toUpperCase(),
        )
      ) {
        setShowAddNote(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="section-card flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="section-title">
          <MessageSquare className="w-4 h-4 text-accent" />
          Notes
          {counts.all > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
              {counts.all}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowCategories((v) => !v)}
            title="Manage categories"
            className={`p-1.5 rounded-lg transition-all ${
              showCategories
                ? "bg-accent/15 text-accent"
                : "text-txt-muted hover:text-txt-primary hover:bg-bg-elevated"
            }`}
          >
            <Tag className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddNote(true)}
            title="Add note (N)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-all shadow-glow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Note
            <span className="hidden sm:inline text-white/40 text-[10px] font-mono ml-0.5">
              N
            </span>
          </button>
        </div>
      </div>

      {/* ── Category manager ────────────────────────────────────── */}
      {showCategories && (
        <div className="animate-fade-in">
          <CategoryManager categories={categories} allNotes={allNotes} />
        </div>
      )}

      {/* ── Filters block ───────────────────────────────────────── */}
      {counts.all > 0 && (
        <div className="flex flex-col gap-3">
          {/* Type filter tabs */}
          <div className="flex gap-1 bg-bg-elevated rounded-xl p-1">
            {TYPE_FILTERS.map(({ key, label, icon: Icon }) => {
              const count = counts[key];
              const active = typeFilter === key;

              /* Hide types with 0 notes (except "all") */
              if (key !== "all" && count === 0) return null;

              /* Dynamic styling for listing errors based on IsResolved */
              const isError = key === "listing_error";
              const hasUnresolved = counts.unresolved_errors > 0;

              return (
                <button
                  key={key}
                  onClick={() => handleTypeFilter(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${
                    active
                      ? "bg-bg-card text-txt-primary shadow-sm border border-border-subtle"
                      : "text-txt-muted hover:text-txt-secondary"
                  }`}
                >
                  {/* Swap icon if all errors are resolved */}
                  {isError && !hasUnresolved ? (
                    <CheckCircle2
                      className={`w-3 h-3 ${active ? "text-success" : ""}`}
                    />
                  ) : (
                    Icon && (
                      <Icon
                        className={`w-3 h-3 ${
                          active
                            ? isError
                              ? "text-danger"
                              : key === "part_number"
                                ? "text-warn"
                                : "text-accent"
                            : isError && hasUnresolved
                              ? "text-danger/50" // Subtle hint that errors exist even when tab inactive
                              : ""
                        }`}
                      />
                    )
                  )}
                  {label}
                  <span
                    className={`tabular-nums text-[10px] ${
                      active
                        ? isError
                          ? hasUnresolved
                            ? "text-danger"
                            : "text-success"
                          : key === "part_number"
                            ? "text-warn"
                            : "text-accent"
                        : "text-txt-muted/50"
                    }`}
                  >
                    {isError && hasUnresolved
                      ? `${counts.unresolved_errors}/${count}`
                      : count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Category chips */}
          {categoryFilterVisible && activeCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 animate-fade-in">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`badge border transition-all text-xs ${
                  categoryFilter === null
                    ? "bg-accent/15 border-accent/30 text-accent"
                    : "border-border-subtle text-txt-muted hover:border-border hover:text-txt-secondary"
                }`}
              >
                All categories
              </button>
              {activeCategories.map((cat) => {
                const count = (
                  typeFilter === "all"
                    ? allNotes
                    : allNotes.filter((n) => n.note_type === typeFilter)
                ).filter(
                  (n) =>
                    PART_TYPES.has(n.note_type) &&
                    n.part_category_id === cat.category_id,
                ).length;

                if (count === 0) return null;

                return (
                  <button
                    key={cat.category_id}
                    onClick={() =>
                      setCategoryFilter(
                        categoryFilter === cat.category_id
                          ? null
                          : cat.category_id,
                      )
                    }
                    className={`badge border transition-all text-xs ${
                      categoryFilter === cat.category_id
                        ? "bg-accent/15 border-accent/30 text-accent"
                        : "border-border-subtle text-txt-muted hover:border-border hover:text-txt-secondary"
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {cat.name}
                    <span className="opacity-50 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, parts, authors…"
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg pl-8 pr-8 py-2 text-xs
                         text-txt-primary placeholder:text-txt-muted
                         focus:outline-none focus:border-accent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active filter summary pill */}
          {hasActiveFilters && visible.length > 0 && (
            <div className="flex items-center justify-between animate-fade-in">
              <p className="text-[11px] text-txt-muted">
                Showing{" "}
                <span className="font-semibold text-txt-secondary">
                  {visible.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-txt-secondary">
                  {counts.all}
                </span>{" "}
                notes
              </p>
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-[11px] text-txt-muted hover:text-accent transition-colors"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Notes list ──────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5 text-txt-muted opacity-40" />
          </div>
          <p className="text-sm font-medium text-txt-muted">
            {search.trim()
              ? `No results for "${search}"`
              : categoryFilter !== null
                ? "No notes in this category"
                : typeFilter === "free_text"
                  ? "No notes yet"
                  : typeFilter === "part_number"
                    ? "No part numbers yet"
                    : typeFilter === "listing_error"
                      ? "No listing errors reported"
                      : "No notes yet"}
          </p>
          <p className="text-xs text-txt-muted opacity-50 mt-1">
            Document findings, part numbers, and observations
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearAllFilters}
              className="mt-3 text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all filters
            </button>
          ) : (
            <button
              onClick={() => setShowAddNote(true)}
              className="mt-4 text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add first note
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((note) => (
            <NoteCard
              key={note.note_id}
              note={note}
              vin={vin}
              categories={categories}
            />
          ))}
        </div>
      )}

      {showAddNote && (
        <AddNoteModal
          vin={vin}
          categories={categories}
          onClose={() => setShowAddNote(false)}
        />
      )}
    </div>
  );
}
