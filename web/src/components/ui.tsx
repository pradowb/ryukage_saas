import type { CSSProperties, ReactNode } from "react";

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        color: `var(--${tone})`,
        background: `var(--${tone}-tint)`,
        border: `1px solid var(--${tone})33`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function GlassCard({
  className = "",
  style = {},
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={"rise " + className}
      style={{
        background: "var(--glass)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Sparkline({ points, tone = "success" }: { points: number[]; tone?: string }) {
  const w = 46,
    h = 18;
  const safe = points && points.length ? points : [0.2, 0.4, 0.3];
  const pts = safe.map((v, i) => `${(i / (safe.length - 1)) * w},${h - v * h}`).join(" ");
  const last = safe[safe.length - 1]! * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={`var(--${tone})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w} cy={last} r="2" fill={`var(--${tone})`} />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  spark,
  index,
}: {
  label: string;
  value: string;
  delta: string;
  spark: number[];
  index: number;
}) {
  const n = Number(String(delta).replace(/[^\d.-]/g, ""));
  const down = Number.isFinite(n) && n < 0;
  return (
    <GlassCard style={{ padding: 16, animationDelay: `${index * 60}ms` }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
        <div className="mono" style={{ fontSize: 21, fontWeight: 700 }}>
          {value}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: down ? "var(--pulse-red)" : "var(--success)",
            fontSize: 11.5,
            paddingBottom: 2,
          }}
        >
          {delta}
          <Sparkline points={spark} />
        </div>
      </div>
    </GlassCard>
  );
}
