import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Fingerprint,
  Search,
  X,
  ArrowRight,
  Car,
  MessageSquare,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Layers,
} from "lucide-react";
import { listVehicles } from "../api/admin";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/NavBar";

/* ── Vehicle grid card ─────────────────────────────────────────────── */
function VehicleCard({ v }) {
  const navigate = useNavigate();
  const identifier = v.build_key;

  return (
    <button
      onClick={() => identifier && navigate(`/v/${identifier}`)}
      disabled={!identifier}
      className="section-card text-left hover:border-accent/30 hover:shadow-glow transition-all duration-200 group animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-txt-muted uppercase tracking-widest truncate">
            {v.make || "—"}
          </p>
          <h3 className="text-lg font-extrabold text-txt-primary leading-tight">
            {v.year || ""} {v.model || "—"}
          </h3>
          {(v.trim || v.series) && (
            <p className="text-xs text-txt-secondary mt-0.5 truncate">
              {[v.trim, v.series].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-txt-muted group-hover:text-accent transition-colors shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {v.body_type && (
          <span className="badge bg-bg-elevated border border-border-subtle text-txt-secondary">
            {v.body_type}
          </span>
        )}
        {v.fuel_type && (
          <span className="badge bg-warn/10 border border-warn/25 text-warn">
            {v.fuel_type}
          </span>
        )}
        {v.drive_type && (
          <span className="badge bg-accent/10 border border-accent/25 text-accent">
            {v.drive_type}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <Fingerprint className="w-3 h-3 text-accent shrink-0" />
        <span className="font-mono text-[10px] text-txt-muted tracking-widest truncate">
          {v.build_key}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-1 text-xs text-txt-muted">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>
            {v.notes_count
              ? `${v.notes_count} note${v.notes_count !== 1 ? "s" : ""}`
              : "No notes"}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Vehicle table row ─────────────────────────────────────────────── */
function VehicleRow({ v }) {
  const navigate = useNavigate();
  const identifier = v.build_key;

  return (
    <tr
      onClick={() => identifier && navigate(`/v/${identifier}`)}
      className={`border-b border-border-subtle/50 transition-colors ${identifier ? "hover:bg-bg-elevated/50 cursor-pointer" : "opacity-50"}`}
    >
      <td className="px-5 py-3.5">
        <p className="text-sm font-bold text-txt-primary">
          {v.year} {v.make} {v.model}
        </p>
        {(v.trim || v.series) && (
          <p className="text-xs text-txt-muted mt-0.5">
            {[v.trim, v.series].filter(Boolean).join(" · ")}
          </p>
        )}
      </td>
      <td className="px-5 py-3.5 hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {v.body_type && (
            <span className="badge bg-bg-elevated border border-border-subtle text-txt-secondary">
              {v.body_type}
            </span>
          )}
          {v.fuel_type && (
            <span className="badge bg-warn/10 border border-warn/25 text-warn">
              {v.fuel_type}
            </span>
          )}
          {v.drive_type && (
            <span className="badge bg-accent/10 border border-accent/25 text-accent">
              {v.drive_type}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell">
        <span className="font-mono text-[11px] text-txt-muted tracking-widest">
          {v.build_key}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center hidden sm:table-cell">
        <span className="flex items-center gap-1 text-xs text-txt-muted justify-center">
          <MessageSquare className="w-3.5 h-3.5" /> {v.notes_count ?? 0}
        </span>
      </td>
      <td className="px-5 py-3.5 w-8">
        <ArrowRight className="w-4 h-4 text-txt-muted ml-auto" />
      </td>
    </tr>
  );
}

/* ── Pagination helper ─────────────────────────────────────────────── */
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, null, totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      null,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    null,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    null,
    totalPages,
  ];
}

/* ═══════════════════════════════════════════════════════════════════
   ListingsPage
═══════════════════════════════════════════════════════════════════ */
export default function ListingsPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const [commit, setCommit] = useState("");
  const [draft, setDraft] = useState("");

  const PAGE_SIZE = 20;

  // ── Data ─────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vehicles", page, commit],
    queryFn: () =>
      listVehicles(page, commit).then((r) => r.data?.data ?? r.data),
    keepPreviousData: true,
  });

  const vehicles =
    data?.items ?? data?.vehicles ?? (Array.isArray(data) ? data : []);
  const total = data?.total_count ?? data?.TotalCount ?? vehicles.length;
  const pages =
    data?.total_pages ??
    data?.TotalPages ??
    Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Search ───────────────────────────────────────────────────────
  const doSearch = useCallback(() => {
    setCommit(draft);
    setPage(1);
  }, [draft]);

  const clear = () => {
    setDraft("");
    setCommit("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar user={user} logout={logout} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7 flex-1 w-full">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-extrabold text-txt-primary">
                Vehicle Listings
              </h1>
            </div>
            {!isLoading && (
              <p className="text-sm text-txt-muted mt-0.5">
                {total.toLocaleString()} vehicle{total !== 1 ? "s" : ""}
                {commit && (
                  <span>
                    {" "}
                    matching{" "}
                    <span className="font-semibold text-txt-secondary">
                      "{commit}"
                    </span>
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Year, make, model, VIN…"
                className="bg-bg-card border border-border-subtle rounded-xl pl-9 pr-8 py-2 text-sm
                           text-txt-primary placeholder:text-txt-muted
                           focus:outline-none focus:border-accent transition-all w-52"
              />
              {draft && (
                <button
                  onClick={clear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={doSearch}
              className="px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-all shadow-glow-sm"
            >
              Search
            </button>

            {/* View toggle */}
            <div className="flex bg-bg-card border border-border-subtle rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setView("grid")}
                className={`p-1.5 rounded-lg transition-all ${view === "grid" ? "bg-bg-elevated text-txt-primary" : "text-txt-muted hover:text-txt-secondary"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded-lg transition-all ${view === "list" ? "bg-bg-elevated text-txt-primary" : "text-txt-muted hover:text-txt-secondary"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => refetch()}
              title="Refresh"
              className="p-2 rounded-xl border border-border-subtle text-txt-muted hover:text-txt-primary hover:border-border transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="w-10 h-10 text-danger/50 mb-3" />
            <p className="text-sm text-txt-muted mb-4">
              Failed to load vehicles
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl text-sm text-accent hover:bg-accent/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* ── Empty ─────────────────────────────────────────────── */}
        {!isLoading && !isError && vehicles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Car className="w-12 h-12 text-txt-muted opacity-20 mb-4" />
            <p className="text-sm font-medium text-txt-muted">
              No vehicles found
            </p>
            {commit && (
              <button
                onClick={clear}
                className="mt-3 text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear search
              </button>
            )}
          </div>
        )}

        {/* ── Grid ──────────────────────────────────────────────── */}
        {!isLoading && !isError && vehicles.length > 0 && view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.ID} v={v} />
            ))}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────── */}
        {!isLoading && !isError && vehicles.length > 0 && view === "list" && (
          <div className="section-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden md:table-cell">
                    Specs
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden lg:table-cell">
                    VIN / Key
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-txt-muted uppercase tracking-wider hidden sm:table-cell">
                    Notes
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <VehicleRow key={v.ID} v={v} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────── */}
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

            <div className="flex items-center gap-1">
              {getPageNumbers(page, pages).map((p, i) =>
                p === null ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="w-8 h-8 flex items-center justify-center text-txt-muted text-sm"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      p === page
                        ? "bg-accent text-white shadow-glow-sm"
                        : "text-txt-muted hover:text-txt-primary hover:bg-bg-elevated border border-border-subtle"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>

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
    </div>
  );
}
