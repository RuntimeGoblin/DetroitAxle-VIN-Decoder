import { useQuery } from "@tanstack/react-query";
import { Trophy, Fingerprint, MessageSquare, Hash, Edit3 } from "lucide-react";
import { listUsers } from "../api/admin";

/* ── Stable avatar colour from first char ────────────────────────── */
const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-pink-600",
];

function avatar(username) {
  const initials = (username ?? "?")
    .split(/[._\s@-]/)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
  const color =
    AVATAR_COLORS[(username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  return { initials, color };
}

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

function Skeleton() {
  return (
    <div className="space-y-2.5">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-16 bg-bg-elevated rounded-xl animate-pulse"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

export default function AgentLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users-leaderboard"],
    queryFn: () => listUsers(1, 100).then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const ranked = (data?.items ?? [])
    .filter((u) => u.vin_usage_count > 0 || u.free_notes_count + u.part_notes_count > 0)
    .sort((a, b) => b.vin_usage_count - a.vin_usage_count)
    .slice(0, 10);

  const topCount = ranked[0]?.vin_usage_count ?? 1;

  return (
    <div className="section-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-txt-primary">
              Agent Leaderboard
            </p>
            <p className="text-[11px] text-txt-muted mt-0.5">
              Ranked by VIN lookups
            </p>
          </div>
        </div>
        {ranked.length > 0 && !isLoading && (
          <span className="text-xs text-txt-muted bg-bg-elevated border border-border-subtle rounded-lg px-2.5 py-1 tabular-nums">
            {ranked.length} active
          </span>
        )}
      </div>

      {/* Column labels */}
      {!isLoading && ranked.length > 0 && (
        <div className="flex items-center gap-3 px-3 mb-2 shrink-0">
          <div className="w-7 shrink-0" />
          <div className="w-9 shrink-0" />
          <div className="flex-1" />
          <div className="flex items-center gap-3 shrink-0 text-[10px] font-bold text-txt-muted uppercase tracking-wider">
            <span className="flex items-center gap-1 w-14 justify-end">
              <Fingerprint className="w-2.5 h-2.5" /> VIN
            </span>
            <span className="flex items-center gap-1 w-12 justify-end">
              <MessageSquare className="w-2.5 h-2.5" /> Notes
            </span>
            <span className="flex items-center gap-1 w-12 justify-end">
              <Edit3 className="w-2.5 h-2.5" /> Edits
            </span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <Skeleton />
        ) : ranked.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="w-10 h-10 text-txt-muted opacity-20 mb-3" />
            <p className="text-sm text-txt-muted">No activity yet</p>
            <p className="text-xs text-txt-muted opacity-50 mt-1">
              Agent lookups will appear here
            </p>
          </div>
        ) : (
          ranked.map((u, i) => {
            const { initials, color } = avatar(u.username);
            const pct =
              topCount > 0 ? (u.vin_usage_count / topCount) * 100 : 0;
            const barColor =
              i < 3 ? RANK_COLORS[i] : "#4f8ef7";
            const totalNotes = (u.free_notes_count ?? 0) + (u.part_notes_count ?? 0);
            const isTop3 = i < 3;

            return (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isTop3
                    ? "bg-bg-elevated/70 border border-border-subtle"
                    : "hover:bg-bg-elevated/50"
                }`}
              >
                {/* Rank */}
                <div className="w-7 text-center shrink-0">
                  {isTop3 ? (
                    <span className="text-base leading-none">
                      {MEDAL_EMOJI[i]}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-txt-muted tabular-nums">
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className={`${color} w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0`}
                >
                  {initials}
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-txt-primary truncate leading-tight">
                    {u.username}
                  </p>
                  {/* Progress bar */}
                  <div className="h-1 bg-bg-elevated rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span
                    className="w-14 text-sm font-extrabold tabular-nums"
                    style={{ color: barColor }}
                  >
                    {(u.vin_usage_count ?? 0).toLocaleString()}
                  </span>
                  <span className="w-12 text-xs font-semibold text-txt-secondary tabular-nums">
                    {totalNotes.toLocaleString()}
                  </span>
                  <span className="w-12 text-xs font-semibold text-txt-muted tabular-nums">
                    {(u.updates_count ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
