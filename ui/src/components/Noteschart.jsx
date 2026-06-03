import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getNotesChart } from "../api/admin";

const DAYS_OPTIONS = [7, 14, 30];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const formatted = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3.5 py-2.5 shadow-xl text-xs pointer-events-none">
      <p className="text-txt-muted mb-1">{formatted}</p>
      <p className="text-txt-primary font-bold tabular-nums text-sm">
        {payload[0].value}
        <span className="font-normal text-txt-muted text-xs ml-1">notes</span>
      </p>
    </div>
  );
}

function TypeSplitBar({ typeSplit }) {
  const total = (typeSplit?.free_text ?? 0) + (typeSplit?.part_number ?? 0);
  if (!total) return null;
  const freePct = Math.round(((typeSplit.free_text ?? 0) / total) * 100);
  const partPct = 100 - freePct;

  return (
    <div className="flex flex-col gap-2">
      {/* Stacked bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        <div
          className="rounded-l-full transition-all duration-500"
          style={{
            width: `${freePct}%`,
            backgroundColor: "var(--color-accent, #6366f1)",
          }}
        />
        <div
          className="rounded-r-full transition-all duration-500"
          style={{ width: `${partPct}%`, backgroundColor: "#10b981" }}
        />
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-txt-muted">
          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
          Free text
          <span className="font-semibold text-txt-secondary tabular-nums ml-0.5">
            {(typeSplit.free_text ?? 0).toLocaleString()}
          </span>
          <span className="text-txt-muted/60">({freePct}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-txt-muted">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          Part #
          <span className="font-semibold text-txt-secondary tabular-nums ml-0.5">
            {(typeSplit.part_number ?? 0).toLocaleString()}
          </span>
          <span className="text-txt-muted/60">({partPct}%)</span>
        </span>
      </div>
    </div>
  );
}

export default function NotesChart({ typeSplit }) {
  const [days, setDays] = useState(14);

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["notes-chart", days],
    queryFn: () => getNotesChart(days).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const periodTotal = chartData.reduce((s, d) => s + (d.count ?? 0), 0);
  const maxVal = Math.max(...chartData.map((d) => d.count ?? 0), 1);

  return (
    <div className="section-card h-full flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <p className="text-sm font-semibold text-txt-primary">
            Notes activity
          </p>
          <p className="text-[11px] text-txt-muted mt-0.5">
            Notes created per day
          </p>
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

      {/* ── Period total ── */}
      <div className="mb-4 shrink-0">
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-8 w-20 bg-bg-elevated rounded-lg animate-pulse" />
          ) : (
            <>
              <span className="text-3xl font-bold text-txt-primary tabular-nums tracking-tight">
                {periodTotal.toLocaleString()}
              </span>
              <span className="text-sm text-txt-muted">
                notes in {days} days
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Bar chart — flex-1 so it grows to fill card ── */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barSize={days === 30 ? 7 : days === 14 ? 12 : 18}
              margin={{ top: 4, right: 2, left: -18, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-txt-muted, #9ca3af)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={days === 7 ? 0 : days === 14 ? 1 : 4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-txt-muted, #9ca3af)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={26}
                domain={[0, maxVal + Math.ceil(maxVal * 0.15)]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(99,102,241,0.06)", radius: 4 }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {chartData.map((entry, i) => {
                  const isToday = i === chartData.length - 1;
                  const intensity =
                    maxVal > 0 ? (entry.count ?? 0) / maxVal : 0;
                  return (
                    <Cell
                      key={i}
                      fill={
                        isToday
                          ? "var(--color-accent, #6366f1)"
                          : `rgba(99,102,241,${Math.max(0.12, intensity * 0.45)})`
                      }
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Type split — pinned to bottom ── */}
      {typeSplit && (
        <div className="mt-4 pt-4 border-t border-border-subtle shrink-0">
          <TypeSplitBar typeSplit={typeSplit} />
        </div>
      )}
    </div>
  );
}
