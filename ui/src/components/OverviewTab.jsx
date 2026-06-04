import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Users,
  MessageSquare,
  Activity,
  Fingerprint,
  Hash,
  TrendingUp,
} from "lucide-react";
import { getStats } from "../api/admin";
import { NotesAreaChart, NoteTypeDonut } from "./Noteschart";
import AgentLeaderboard from "./AgentLeaderboard";
import ActivityFeed from "./Activityfeed";

/* ── VIN Lookups hero card ───────────────────────────────────────── */
function VinHeroCard({ value }) {
  return (
    <div className="relative col-span-1 sm:col-span-2 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5">
      {/* Glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint className="w-4 h-4 text-amber-500" />
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
            Total VIN Lookups
          </span>
        </div>
        {value != null ? (
          <p className="text-5xl font-extrabold text-txt-primary tabular-nums leading-none tracking-tight">
            {value.toLocaleString()}
          </p>
        ) : (
          <div className="h-12 w-32 bg-amber-500/10 rounded-xl animate-pulse" />
        )}
        <p className="text-xs text-txt-muted mt-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-amber-500/60" />
          The primary driver of every agent interaction
        </p>
      </div>
    </div>
  );
}

/* ── Secondary stat card ─────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="section-card flex flex-col justify-between gap-3 p-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: bg }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        {value != null ? (
          <p
            className="text-2xl font-extrabold tabular-nums leading-tight"
            style={{ color }}
          >
            {value.toLocaleString()}
          </p>
        ) : (
          <div className="h-7 w-16 bg-bg-elevated rounded-lg animate-pulse" />
        )}
        <p className="text-[11px] font-semibold text-txt-muted uppercase tracking-wider mt-1">
          {label}
        </p>
      </div>
    </div>
  );
}

/* ── Full-width global totals strip ─────────────────────────────── */
function GlobalTotalsStrip({ data }) {
  const items = [
    { label: "Field edits", value: data?.total_updates, color: "#8b5cf6" },
    { label: "Free notes", value: data?.total_free_notes, color: "#4f8ef7" },
    { label: "Part numbers", value: data?.total_part_notes, color: "#10b981" },
    { label: "Categories", value: data?.categories_count, color: "#f59e0b" },
    { label: "Active users", value: data?.user_count, color: "#94a3b8" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          className="bg-bg-elevated/50 border border-border-subtle rounded-xl px-4 py-3"
        >
          {value != null ? (
            <p
              className="text-lg font-extrabold tabular-nums leading-tight"
              style={{ color }}
            >
              {value.toLocaleString()}
            </p>
          ) : (
            <div className="h-5 w-12 bg-bg-elevated rounded animate-pulse" />
          )}
          <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider mt-1">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   OverviewTab
═══════════════════════════════════════════════════════════════════ */
export default function OverviewTab() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats().then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-5">
      {/* ── Row 1: Hero + 2 secondary stats ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <VinHeroCard value={data?.total_vin_usage} />
        <StatCard
          label="Vehicles Decoded"
          value={data?.vehicles_count}
          icon={Car}
          color="#10b981"
          bg="rgba(16,185,129,0.12)"
        />
        <StatCard
          label="Notes Today"
          value={data?.notes_today_count}
          icon={Activity}
          color="#f59e0b"
          bg="rgba(245,158,11,0.12)"
        />
      </div>

      {/* ── Row 2: Global totals strip ───────────────────────────── */}
      <GlobalTotalsStrip data={data} />

      {/* ── Row 3: Leaderboard + Charts ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        {/* Left: Leaderboard */}
        <AgentLeaderboard />

        {/* Right: Area chart + Donut */}
        <div className="flex flex-col gap-5">
          <NotesAreaChart />
          <NoteTypeDonut stats={data} />
        </div>
      </div>

      {/* ── Row 4: Activity feed ─────────────────────────────────── */}
      <ActivityFeed />
    </div>
  );
}
