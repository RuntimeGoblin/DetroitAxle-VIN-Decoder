const colorMap = {
  warn: "bg-warn/10    border-warn/25    text-warn",
  success: "bg-success/10 border-success/25 text-success",
  info: "bg-info/10    border-info/25    text-info",
  accent: "bg-accent/10  border-accent/25  text-accent",
  muted: "bg-bg-elevated border-border-subtle text-txt-muted",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "muted",
}) {
  const iconClass = colorMap[color] ?? colorMap.muted;

  return (
    <div className="section-card flex items-center gap-4 p-5 hover:border-accent/30 hover:shadow-glow transition-all duration-200">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${iconClass}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-extrabold text-txt-primary leading-tight mb-0.5">
          {value}
        </p>
        <p className="text-[10px] font-bold text-txt-muted uppercase tracking-widest">
          {label}
        </p>
      </div>
    </div>
  );
}
