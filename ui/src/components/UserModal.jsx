import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { createUser, updateUser } from "../api/admin";
import { useToast } from "../contexts/ToastContext";

const ROLES = ["agent", "admin", "listing", "dnr"];

export default function UserModal({ user: editing, onClose }) {
  const isEdit = !!editing;
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    email: editing?.email ?? "",
    username: editing?.username ?? "",
    password: "",
    isActive: editing?.is_active ?? true,
    role: editing?.role ?? "agent",
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const f = (k) => (e) => {
    setForm((v) => ({ ...v, [k]: e.target.value }));
    setError("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateUser(editing.id, {
            email: form.email || undefined,
            username: form.username || undefined,
            is_active: form.isActive,
            role: form.role,
            password: form.password || undefined,
          })
        : createUser({
            email: form.email,
            username: form.username,
            password: form.password,
            role: form.role,
            isActive: form.isActive,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast(isEdit ? "User updated" : "User created", "success");
      onClose();
    },
    onError: (err) => setError(err.response?.data?.error ?? "Operation failed"),
  });

  const valid = isEdit ? true : form.email && form.username && form.password;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-bg-card border border-border rounded-2xl shadow-modal animate-pop overflow-hidden">
        <div
          className="h-[3px]"
          style={{
            backgroundImage: "linear-gradient(90deg,#4f8ef7,#818cf8,#a78bfa)",
          }}
        />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-txt-primary flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-accent" />
              {isEdit ? "Edit User" : "Create User"}
            </h2>
            <button
              onClick={onClose}
              className="text-txt-muted hover:text-txt-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                Email
              </p>
              <input
                type="email"
                value={form.email}
                onChange={f("email")}
                placeholder="user@example.com"
                className="input-base"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                Username
              </p>
              <input
                type="text"
                value={form.username}
                onChange={f("username")}
                placeholder="johndoe"
                className="input-base"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                Password{" "}
                {isEdit && (
                  <span className="normal-case font-normal tracking-normal text-txt-muted/50">
                    (leave blank to keep)
                  </span>
                )}
              </p>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={f("password")}
                  placeholder={isEdit ? "••••••••" : "Required"}
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Role + Active row */}
            <div className="flex gap-3 pt-1">
              {/* Role selector */}
              <div className="flex-1">
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                  Role
                </p>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={f("role")}
                    className="w-full appearance-none bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-txt-primary pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all cursor-pointer hover:border-border capitalize"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="capitalize">
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex-1">
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1">
                  Status
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2.5 hover:border-border transition-all h-[42px]">
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, isActive: e.target.checked }))
                      }
                    />
                    <div className="w-9 h-5 rounded-full transition-colors bg-bg-card border border-border-subtle peer-checked:bg-success" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-xs font-medium text-txt-secondary">
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-3 bg-danger/10 border border-danger/25 text-danger rounded-xl px-3 py-2 text-xs animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-subtle rounded-xl text-sm text-txt-secondary hover:border-border transition-all"
            >
              Cancel
            </button>
            <button
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-glow-sm flex items-center justify-center gap-2"
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
