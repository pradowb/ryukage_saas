import { useState } from "react";
import type { Pedido, StatusPedido } from "../../../shared/types";
import { COLUMNS, type Coluna } from "../lib/constants";
import { itemsText, money, timeAgo, tipoLabel } from "../lib/format";
import { Badge } from "./ui";

type OnAdvance = (id: number, status: StatusPedido) => Promise<void>;

export function OrderCard({
  pedido,
  tone,
  next,
  onAdvance,
}: {
  pedido: Pedido;
  tone: string;
  next?: Coluna["next"];
  onAdvance: OnAdvance;
}) {
  const [busy, setBusy] = useState(false);
  const linhas = itemsText(pedido.itens);
  const tipo = tipoLabel(pedido);
  async function advance(status: StatusPedido) {
    setBusy(true);
    try {
      await onAdvance(pedido.id, status);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={"order-card tone-" + tone}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span className="mono" style={{ color: "var(--muted)" }}>
          #{pedido.id}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted-2)" }}>
          {timeAgo(pedido.criado_em, pedido.status === "entregue")}
        </span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, margin: "8px 0", whiteSpace: "pre-line" }}>
        {linhas ? linhas.split("\n").map((l, i) => <div key={i}>{l}</div>) : "—"}
      </div>
      {pedido.endereco ? (
        <div style={{ fontSize: 11, color: "var(--muted-2)", marginBottom: 6 }}>{pedido.endereco}</div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
          {money(pedido.valor_total)}
        </span>
        <Badge tone={tipo === "Entrega" ? "gold" : "info"}>{tipo}</Badge>
      </div>
      {next && (
        <button
          className={"order-act act-" + next.act}
          type="button"
          disabled={busy}
          onClick={() => advance(next.status)}
        >
          {next.label}
        </button>
      )}
    </article>
  );
}

export function KanbanBoard({
  query,
  pedidos,
  onAdvance,
}: {
  query: string;
  pedidos: Pedido[];
  onAdvance: OnAdvance;
}) {
  const q = query.trim().toLowerCase();
  const matches = (p: Pedido) => {
    if (!q) return true;
    const text = String(p.id) + " " + itemsText(p.itens) + " " + (p.endereco || "");
    return text.toLowerCase().includes(q);
  };
  const grouped = Object.fromEntries(COLUMNS.map((c) => [c.key, [] as Pedido[]])) as Record<
    StatusPedido,
    Pedido[]
  >;
  pedidos.forEach((p) => {
    if (grouped[p.status]) grouped[p.status].push(p);
  });
  const totalAtivos = pedidos.filter((p) => p.status !== "entregue").length;
  const prontos = grouped.pronto.length;
  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 16 }}>Fila de hoje</h2>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          <b style={{ color: "var(--text)" }}>{totalAtivos}</b> pedidos ativos ·{" "}
          <b style={{ color: "var(--text)" }}>{prontos}</b> pronto para entrega
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {COLUMNS.map((c) => (
          <span
            key={c.key}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--pulse-${c.tone})` }}
            />
            {c.label}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "268px",
          gap: 14,
          overflowX: "auto",
          paddingBottom: 6,
        }}
      >
        {COLUMNS.map((c) => {
          const items = grouped[c.key].filter(matches);
          return (
            <div
              key={c.key}
              data-status={c.key}
              style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}
            >
              <div style={{ height: 2, borderRadius: 2, background: `var(--pulse-${c.tone})` }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    background: "var(--bg-2)",
                    borderRadius: 999,
                    padding: "1px 8px",
                    marginLeft: "auto",
                  }}
                >
                  {items.length}
                </span>
              </div>
              {items.map((p) => (
                <OrderCard key={p.id} pedido={p} tone={c.tone} next={c.next} onAdvance={onAdvance} />
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted-2)", padding: "8px 4px" }}>
                  Sem pedidos aqui.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
