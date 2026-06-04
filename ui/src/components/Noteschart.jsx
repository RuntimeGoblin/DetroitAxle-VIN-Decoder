import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, MessageSquare, Hash, AlertTriangle } from "lucide-react";
import { getNotesChart } from "../api/admin";

/* ── Shared colours ─────────────────────────────────────────────── */
const NOTE_TYPES = [
  { key: "free_notes_count", label: "Free notes", color: "#4f8ef7", icon: MessageSquare },
  { key: "part_notes_count", label: "Part numbers", color: "#10b981", icon: Hash },
  { key: "listing_errors_count", label: "Listing errors", color: "#ef4444", icon: AlertTriangle },
];

/* ── Area chart tooltip ─────────────────────────────────────────── */
function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const date = new Date(label + "T12:00:00Z");
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3.5 py-2.5 shadow-xl text-xs pointer-events-none">
      <p className="text-txt-muted mb-1">
        {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <p className="text-txt-primary font-bold tabular-nums text-sm">
        {payload[0].value}{" "}
        <span className="font-normal text-txt-muted text-xs">notes</span>
      </p>
    </div>
  );
}

/* ── Notes activity area chart ──────────────────────────────────── */
const DAYS_OPTIONS = [7, 14, 30];

export function NotesAreaChart() {
  const [days, setDays] = useState(14);

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["notes-chart", days],
    queryFn: () => getNotesChart(days).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const periodTotal = chartData.reduce((s, d) => s + (d.count ?? 0), 0);

  return (
    <div className="section-card flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-bold text-txt-primary">Notes activity</p>
            <p className="text-[11px] text-txt-muted mt-0.5">Notes created per day</p>
          </div>
        </div>
        <div className="flex gap-0.5 bg-bg-elevated border border-border-subtle rounded-lg p-0.5 shrink-0">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                days === d
                  ? "bg-bg-card text-txt-primary shadow-sm border border-border-subtle"
                  : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Period total */}
      <div className="mb-3 shrink-0">
        {isLoading ? (
          <div className="h-8 w-24 bg-bg-elevated rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-txt-primary tabular-nums tracking-tight">
              {periodTotal.toLocaleString()}
            </span>
            <span className="text-sm text-txt-muted">in {days}d</span>
          </div>
        )}
      </div>

      {/* Area chart */}
      <div className="h-44">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="notesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-txt-muted,#9ca3af)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v + "T12:00:00Z");
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={days === 7 ? 0 : days === 14 ? 1 : 4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-txt-muted,#9ca3af)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={24}
              />
              <Tooltip content={<AreaTooltip />} cursor={{ stroke: "#4f8ef7", strokeWidth: 1, strokeDasharray: "4 2" }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#4f8ef7"
                strokeWidth={2}
                fill="url(#notesGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#4f8ef7", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ── Note-type donut ─────────────────────────────────────────────── */
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const type = NOTE_TYPES.find((t) => t.label === name);
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3 py-2 shadow-lg text-xs pointer-events-none">
      <p className="text-txt-muted mb-0.5">{name}</p>
      <p className="font-bold tabular-nums" style={{ color: type?.color }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function NoteTypeDonut({ stats }) {
  const pieData = NOTE_TYPES.map((t) => ({
    name: t.label,
    value: stats?.[t.key] ?? 0,
    color: t.color,
    icon: t.icon,
  })).filter((d) => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);
  const isLoading = stats == null;

  return (
    <div className="section-card">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-txt-primary">Note breakdown</p>
          <p className="text-[11px] text-txt-muted mt-0.5">Distribution by type</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-txt-muted text-sm">
          No notes yet
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative shrink-0">
            <PieChart width={120} height={120}>
              <Pie
                data={pieData}
                cx={55}
                cy={55}
                innerRadius={38}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-extrabold text-txt-primary tabular-nums leading-none">
                {total.toLocaleString()}
              </span>
              <span className="text-[9px] text-txt-muted uppercase tracking-wider mt-0.5">
                total
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            {NOTE_TYPES.map(({ key, label, color, icon: Icon }) => {
              const val = stats?.[key] ?? 0;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-txt-secondary">
                      <Icon className="w-3 h-3" style={{ color }} />
                      {label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-txt-primary tabular-nums">
                        {val.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-txt-muted tabular-nums w-6 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Default export (legacy OverviewTab import path) ────────────── */
export default NotesAreaChart;
