import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

const BARS = [
  { key: "total_free_notes", label: "Free notes", color: "#6366f1" },
  { key: "total_part_notes", label: "Part notes", color: "#10b981" },
  { key: "total_vin_usage", label: "VIN lookups", color: "#f59e0b" },
  { key: "total_updates", label: "Field edits", color: "#8b5cf6" },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const bar = BARS.find((b) => b.label === label);
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="text-txt-muted mb-1 font-medium">{label}</p>
      <p className="font-bold tabular-nums" style={{ color: bar?.color }}>
        {payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

function MiniStat({ label, color, value, max }) {
  const pct =
    max > 0 ? Math.max(Math.round((value / max) * 100), value > 0 ? 4 : 0) : 0;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-bg-elevated/50 border border-border-subtle">
      <div>
        <p className="text-base font-bold text-txt-primary tabular-nums leading-none">
          {value != null ? (
            value.toLocaleString()
          ) : (
            <span className="opacity-30">—</span>
          )}
        </p>
        <p className="text-[11px] text-txt-muted mt-1 leading-tight truncate">
          {label}
        </p>
      </div>
      {/* Horizontal progress bar */}
      <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function UsageBreakdown({ data }) {
  const chartData = BARS.map((b) => ({
    label: b.label,
    value: data?.[b.key] ?? 0,
    color: b.color,
  }));

  const maxValue = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="section-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-txt-primary leading-none">
            Usage breakdown
          </p>
          <p className="text-[11px] text-txt-muted mt-1">
            Cumulative totals across all users
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {BARS.map(({ key, label, color }) => (
          <MiniStat
            key={key}
            label={label}
            color={color}
            value={data?.[key] ?? (data ? 0 : null)}
            max={maxValue}
          />
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-xl bg-bg-elevated/40 border border-border-subtle px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            barSize={48}
            margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-txt-muted, #9ca3af)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-txt-muted, #9ca3af)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
