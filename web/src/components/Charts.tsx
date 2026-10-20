import { useState } from "react";
import type { Relatorios } from "../../../shared/types";

export function BarChart({ dias }: { dias: Relatorios["pedidos_por_dia"] | undefined }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = dias && dias.length ? dias : [{ dia: "—", valor: 0 }];
  const w = 320,
    h = 150,
    max = Math.max(1, ...data.map((d) => Number(d.valor) || 0)) * 1.1;
  const barW = 24,
    gap = (w - 40) / data.length;
  const peakVal = Math.max(0, ...data.map((d) => Number(d.valor) || 0));
  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label="Pedidos por dia, últimos 7 dias"
      >
        <line x1="28" y1="118" x2="312" y2="118" stroke="var(--border)" strokeWidth="1" />
        <line x1="28" y1="64" x2="312" y2="64" stroke="var(--border)" strokeDasharray="2 4" />
        {data.map((d, i) => {
          const val = Number(d.valor) || 0;
          const bh = (val / max) * 96;
          const x = 40 + i * gap;
          const y = 118 - bh;
          const peak = val === peakVal && peakVal > 0;
          return (
            <g
              key={(d.dia || i) + "-" + i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${d.dia}: ${val} pedidos`}</title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(bh, 0)}
                rx="3"
                fill={peak ? "var(--gold)" : hover === i ? "var(--accent-strong)" : "var(--accent)"}
              />
              <text
                x={x + barW / 2}
                y="132"
                fontSize="9"
                textAnchor="middle"
                fill="var(--muted-2)"
                fontFamily="JetBrains Mono, monospace"
              >
                {d.dia}
              </text>
              {hover === i && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize="10"
                  textAnchor="middle"
                  fill="var(--text)"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TopItems({ itens }: { itens: Relatorios["top_itens"] | undefined }) {
  const list = itens || [];
  if (!list.length) return <div style={{ fontSize: 13, color: "var(--muted-2)" }}>Sem dados ainda.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map((t) => (
        <div
          key={t.nome}
          style={{ display: "grid", gridTemplateColumns: "96px 1fr 40px", alignItems: "center", gap: 10 }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t.nome}
          </span>
          <span
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--bg-2)",
              display: "block",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                borderRadius: 999,
                width: `${t.pct}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-strong))",
              }}
            />
          </span>
          <span className="mono" style={{ fontSize: 12, textAlign: "right", color: "var(--muted)" }}>
            {t.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
