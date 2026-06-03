import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  Shield,
  Search,
  ChevronDown,
} from "lucide-react";
import { listUsers, deleteUser, updateUser } from "../api/admin";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import UserModal from "./UserModal";

const ROLE_OPTIONS = ["all", "admin", "agent"];
const STATUS_OPTIONS = ["all", "active", "inactive"];
const TRUSTED_OPTIONS = ["all", "trusted", "untrusted"];

export default function UsersTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const [modal, setModal] = useState(null);
  const [confirming, setConfirming] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trustedFilter, setTrustedFilter] = useState("all");

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers().then((r) => r.data),
  });
  const users = usersData?.items ?? [];

  const delMut = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast("User deleted", "info");
      setConfirming(null);
    },
    onError: (err) =>
      toast(err.response?.data?.error ?? "Delete failed", "error"),
  });

  const trustMut = useMutation({
    mutationFn: ({ id, isTrusted }) => updateUser(id, { is_trusted: isTrusted }),
    onSuccess: (_, { isTrusted }) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast(isTrusted ? "User marked as trusted" : "Trust revoked", "info");
    },
    onError: (err) =>
      toast(err.response?.data?.error ?? "Update failed", "error"),
  });

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matches =
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !u.is_active) return false;
        if (statusFilter === "inactive" && u.is_active) return false;
      }
      if (trustedFilter !== "all") {
        if (trustedFilter === "trusted" && !u.is_trusted) return false;
        if (trustedFilter === "untrusted" && u.is_trusted) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter, trustedFilter]);

  const hasActiveFilters =
    search ||
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    trustedFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setTrustedFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-txt-muted">
          {filtered.length} of {usersData?.total_count ?? users.length} user
          {(usersData?.total_count ?? users.length) !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-all shadow-glow-sm"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-bg-elevated border border-border-subtle rounded-xl text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <FilterSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_OPTIONS}
          label="Role"
        />

        {/* Status filter */}
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          label="Status"
        />

        {/* Trusted filter */}
        <FilterSelect
          value={trustedFilter}
          onChange={setTrustedFilter}
          options={TRUSTED_OPTIONS}
          label="Trust"
        />

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-xs text-txt-muted hover:text-txt-primary border border-border-subtle rounded-xl transition-all hover:bg-bg-elevated"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="section-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-txt-muted gap-2">
            <Search className="w-6 h-6 opacity-40" />
            <p className="text-sm">No users match your filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-accent hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden md:table-cell">
                  Email
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden sm:table-cell">
                  Role
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden lg:table-cell">
                  Trusted
                </th>
                <th className="w-28 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-bg-elevated/40 transition-colors"
                >
                  {/* User */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-violet-600">
                        {u.username?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-txt-primary">
                          {u.username}
                        </p>
                        {/* Show trusted badge inline on small screens */}
                        {u.is_trusted && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider lg:hidden">
                            <ShieldCheck className="w-2.5 h-2.5" /> Trusted
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3.5 text-txt-secondary hidden md:table-cell">
                    {u.email}
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="badge border bg-bg-elevated border-border-subtle text-txt-secondary capitalize">
                      {u.role ?? "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span
                      className={`badge border ${
                        u.is_active
                          ? "bg-success/10 border-success/25 text-success"
                          : "bg-danger/10 border-danger/25 text-danger"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Trusted */}
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {u.is_trusted ? (
                      <span className="inline-flex items-center gap-1 badge border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                        <ShieldCheck className="w-3 h-3" /> Trusted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 badge border bg-bg-elevated border-border-subtle text-txt-muted">
                        <Shield className="w-3 h-3" /> Not trusted
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Trust toggle */}
                      <button
                        onClick={() =>
                          trustMut.mutate({ id: u.id, isTrusted: !u.is_trusted })
                        }
                        disabled={trustMut.isPending}
                        title={u.is_trusted ? "Revoke trust" : "Mark as trusted"}
                        className={`p-1.5 rounded-lg transition-all ${
                          u.is_trusted
                            ? "text-emerald-400 hover:text-txt-muted hover:bg-bg-elevated"
                            : "text-txt-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {trustMut.isPending &&
                        trustMut.variables?.id === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => setModal(u)}
                        className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      {me?.id !== u.id &&
                        (confirming === u.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => delMut.mutate(u.id)}
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
                              onClick={() => setConfirming(null)}
                              className="p-1 text-txt-muted hover:text-txt-secondary transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirming(u.id)}
                            className="p-1.5 rounded-lg text-txt-muted hover:text-danger hover:bg-danger/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// Reusable filter select dropdown
function FilterSelect({ value, onChange, options, label }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-7 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          value !== "all"
            ? "bg-accent/10 border-accent/30 text-accent"
            : "bg-bg-elevated border-border-subtle text-txt-secondary hover:border-border-subtle/80"
        }`}
      >
        <option value="all">{label}: All</option>
        {options
          .filter((o) => o !== "all")
          .map((o) => (
            <option key={o} value={o} className="capitalize">
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </option>
          ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-txt-muted pointer-events-none" />
    </div>
  );
}
