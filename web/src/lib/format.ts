import type { Evento, ItemPedido, Pedido } from "../../../shared/types";

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export function money(n: number | string | null | undefined): string {
  return euro.format(Number(n) || 0);
}

export function minutesSince(iso: string | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function timeAgo(iso: string | undefined, entregue = false, now = Date.now()): string {
  const m = minutesSince(iso, now);
  const label =
    m < 1
      ? "há instantes"
      : m < 60
        ? "há " + m + " min"
        : m < 1440
          ? "há " + Math.floor(m / 60) + " h"
          : "há " + Math.floor(m / 1440) + " d";
  return entregue ? "concluído " + label : label;
}

export function itemsText(itens: ItemPedido[] | string | undefined): string {
  if (typeof itens === "string") return itens;
  return (itens || []).map((item) => item.qtd + "× " + item.nome).join("\n");
}

export function tipoLabel(pedido: Pick<Pedido, "tipo_entrega">): "Entrega" | "Retirada" {
  return String(pedido.tipo_entrega || "").toLowerCase() === "entrega" ? "Entrega" : "Retirada";
}

export function fmtDelta(value: number | null | undefined, suffix: string): string {
  if (value == null) return "";
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return (n > 0 ? "+" : "") + n + suffix;
}

export function sparkFromDias(dias: { valor: number }[] | undefined, fallback: number[]): number[] {
  const vals = (dias || []).map((d) => Number(d.valor) || 0);
  if (!vals.length) return fallback;
  const max = Math.max(1, ...vals);
  return vals.map((v) => Math.max(0.08, v / max));
}

const STATUS_LABEL: Record<string, string> = {
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

export type Tone = "success" | "warning" | "info";

/** Converte um evento de auditoria numa notificação legível. */
export function descreverEvento(e: Evento): { titulo: string; corpo: string; tone: Tone } {
  const d = e.dados as Record<string, string | number | boolean>;
  const pid = "#" + String(d.pedido_id ?? "").padStart(4, "0");
  const por = e.usuario ? ` por ${e.usuario}` : "";
  switch (e.tipo) {
    case "pedido.novo":
      return {
        titulo: "Novo pedido",
        corpo: `Pedido ${pid} — ${money(d.valor_total as number)}.`,
        tone: "success",
      };
    case "pedido.status":
      return {
        titulo: "Pedido atualizado",
        corpo: `Pedido ${pid} → ${STATUS_LABEL[String(d.para)] ?? d.para}${por}.`,
        tone: "info",
      };
    case "cardapio.disponibilidade":
      return d.disponivel
        ? { titulo: "Item disponível", corpo: `${d.nome} voltou ao cardápio${por}.`, tone: "success" }
        : {
            titulo: "Item esgotado",
            corpo: `${d.nome} foi marcado como indisponível${por}.`,
            tone: "warning",
          };
    case "cardapio.criado":
      return { titulo: "Novo item", corpo: `${d.nome} foi adicionado ao cardápio${por}.`, tone: "info" };
    default:
      return { titulo: "Atividade", corpo: "", tone: "info" };
  }
}
