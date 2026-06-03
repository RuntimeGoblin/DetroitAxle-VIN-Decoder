import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Edit3, Trash2, Check, X, Loader2 } from "lucide-react";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from "../api/categories";
import { useToast } from "../contexts/ToastContext";

export default function CategoriesTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((r) => r.data),
  });

  const addMut = useMutation({
    mutationFn: () => addCategory(newName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category created", "success");
      setNewName("");
    },
    onError: (e) => toast(e.response?.data?.error ?? "Create failed", "error"),
  });

  const editMut = useMutation({
    mutationFn: (id) => updateCategory(id, editName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category renamed", "success");
      setEditingId(null);
    },
    onError: (e) => toast(e.response?.data?.error ?? "Rename failed", "error"),
  });

  const delMut = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category deleted", "info");
      setConfirmDel(null);
    },
    onError: (e) =>
      toast(
        e.response?.data?.error ?? "Delete failed — may have linked notes",
        "error",
      ),
  });

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && newName.trim() && addMut.mutate()
          }
          placeholder="New category name…"
          className="input-base flex-1"
        />
        <button
          onClick={() => addMut.mutate()}
          disabled={!newName.trim() || addMut.isPending}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all shadow-glow-sm flex items-center gap-1.5"
        >
          {addMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add
        </button>
      </div>

      <div className="section-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-sm text-txt-muted py-10">
            No categories yet
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle/50">
            {categories.map((cat) => (
              <li
                key={cat.category_id}
                className="flex items-center gap-3 px-5 py-3 group hover:bg-bg-elevated/40 transition-colors"
              >
                <Tag className="w-3.5 h-3.5 text-txt-muted shrink-0" />
                {editingId === cat.category_id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") editMut.mutate(cat.category_id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-bg-elevated border border-accent/30 rounded-lg px-3 py-1.5 text-sm text-txt-primary focus:outline-none focus:border-accent transition-all"
                    />
                    <button
                      onClick={() => editMut.mutate(cat.category_id)}
                      disabled={editMut.isPending}
                      className="text-success hover:opacity-75 transition-opacity"
                    >
                      {editMut.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-txt-muted hover:text-txt-secondary transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-txt-primary">
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditName(cat.name);
                          setEditingId(cat.category_id);
                        }}
                        className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDel === cat.category_id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => delMut.mutate(cat.category_id)}
                            disabled={delMut.isPending}
                            className="px-2 py-1 text-[11px] bg-danger text-white rounded-lg hover:opacity-85 flex items-center gap-1"
                          >
                            {delMut.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="text-txt-muted hover:text-txt-secondary transition-colors p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(cat.category_id)}
                          className="p-1.5 rounded-lg text-txt-muted hover:text-danger hover:bg-danger/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
