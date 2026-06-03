import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Edit3, Check, X, Loader2 } from "lucide-react";
import { addCategory, updateCategory, deleteCategory } from "../api/categories";
import { useToast } from "../contexts/ToastContext";

function CategoryRow({ cat, noteCount }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.Name);
  const [confirming, setConfirming] = useState(false);

  const qc = useQueryClient();
  const toast = useToast();

  const updateMut = useMutation({
    mutationFn: () => updateCategory(cat.ID, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditing(false);
      toast("Category renamed", "success");
    },
    onError: (err) =>
      toast(err.response?.data?.error ?? "Rename failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCategory(cat.ID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category deleted", "info");
    },
    onError: (err) => {
      toast(
        err.response?.data?.error ??
          "Delete failed — category may still have notes",
        "error",
      );
      setConfirming(false);
    },
  });

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-bg-elevated border border-accent/30 rounded-lg px-3 py-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateMut.mutate();
            if (e.key === "Escape") {
              setEditing(false);
              setName(cat.Name);
            }
          }}
          className="flex-1 bg-transparent text-sm text-txt-primary focus:outline-none"
        />
        <button
          onClick={() => updateMut.mutate()}
          disabled={updateMut.isPending || !name.trim()}
          className="text-success hover:opacity-75 transition-opacity"
        >
          {updateMut.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setName(cat.Name);
          }}
          className="text-txt-muted hover:text-txt-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 group hover:border-border transition-all">
      <div className="flex items-center gap-2 min-w-0">
        <Tag className="w-3.5 h-3.5 text-txt-muted shrink-0" />
        <span className="text-sm text-txt-primary truncate">{cat.Name}</span>
        {noteCount > 0 && (
          <span className="text-[10px] text-txt-muted tabular-nums opacity-60">
            ({noteCount})
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        {confirming ? (
          <>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="px-2 py-0.5 text-[11px] bg-danger text-white rounded-md hover:opacity-85 transition-opacity flex items-center gap-1"
            >
              {deleteMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Delete"
              )}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-0.5 text-[11px] border border-border-subtle rounded-md text-txt-muted hover:text-txt-primary transition-colors ml-1"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setName(cat.Name);
                setEditing(true);
              }}
              className="p-1 text-txt-muted hover:text-txt-primary rounded transition-colors"
              title="Rename"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="p-1 text-txt-muted hover:text-danger rounded transition-colors"
              title="Delete"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CategoryManager({ categories, allNotes = [] }) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState("");

  const qc = useQueryClient();
  const toast = useToast();

  /* Count notes per category */
  const noteCounts = Object.fromEntries(
    categories.map((cat) => [
      cat.ID,
      allNotes.filter(
        (n) => n.NoteType === "part_number" && n.PartCategoryID === cat.ID,
      ).length,
    ]),
  );

  const addMut = useMutation({
    mutationFn: () => addCategory(newName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category created", "success");
      setNewName("");
      setShowAdd(false);
      setAddError("");
    },
    onError: (err) =>
      setAddError(err.response?.data?.error ?? "Failed to create"),
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addMut.mutate();
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest flex items-center gap-1.5">
          <Tag className="w-3 h-3" />
          Part Categories
        </span>
        <button
          onClick={() => {
            setShowAdd((v) => !v);
            setAddError("");
          }}
          className={`text-xs font-medium flex items-center gap-1 transition-colors ${
            showAdd ? "text-txt-muted" : "text-accent hover:text-accent-hover"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-3 animate-fade-in space-y-1.5">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError("");
              }}
              placeholder="Category name…"
              className="flex-1 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent transition-all"
            />
            <button
              type="submit"
              disabled={addMut.isPending || !newName.trim()}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
            >
              {addMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </button>
          </div>
          {addError && <p className="text-xs text-danger">{addError}</p>}
        </form>
      )}

      {categories.length === 0 ? (
        <p className="text-xs text-txt-muted text-center py-4 opacity-60">
          No categories yet
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.ID}
              cat={cat}
              noteCount={noteCounts[cat.ID] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
