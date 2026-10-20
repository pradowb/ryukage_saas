import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { pedidos, restaurantes } from "../../db/schema.js";
import { round2, toNumber } from "../../lib/money.js";
import { STATUS_PEDIDO, type ItemPedido, type Relatorios } from "../../../shared/types.js";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIA_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" do instante `d` no fuso do restaurante. */
const chaveDia = (d: Date, fuso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/** Chave do dia `n` dias antes de `chave` (aritmética de calendário, imune a mudanças de hora). */
function diaAnterior(chave: string, n: number): { chave: string; diaSemana: number } {
  const [y, m, d] = chave.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d) - n * DIA_MS);
  return { chave: utc.toISOString().slice(0, 10), diaSemana: utc.getUTCDay() };
}

const variacaoPct = (atual: number, anterior: number) =>
  anterior > 0 ? Math.round(((atual - anterior) / anterior) * 1000) / 10 : null;

export interface PedidoParaRelatorio {
  criado_em: Date;
  valor_total: number;
  itens: ItemPedido[];
}

/** Função pura: agrega os pedidos dos últimos 14 dias. Separada da consulta para ser testável. */
export function agregar(lista: PedidoParaRelatorio[], fuso: string, agora: Date): Relatorios {
  const hoje = chaveDia(agora, fuso);
  const porDia = new Map<string, PedidoParaRelatorio[]>();
  for (const p of lista) {
    const k = chaveDia(p.criado_em, fuso);
    porDia.set(k, [...(porDia.get(k) ?? []), p]);
  }
  const doDia = (n: number) => porDia.get(diaAnterior(hoje, n).chave) ?? [];

  const semana = Array.from({ length: 7 }, (_, i) => 6 - i).flatMap(doDia);
  const semanaAnterior = Array.from({ length: 7 }, (_, i) => 13 - i).flatMap(doDia);

  const pedidos_por_dia = Array.from({ length: 7 }, (_, i) => {
    const n = 6 - i;
    return { dia: DIAS_SEMANA[diaAnterior(hoje, n).diaSemana]!, valor: doDia(n).length };
  });

  const qtdPorItem = new Map<string, number>();
  for (const p of semana) {
    for (const item of p.itens) qtdPorItem.set(item.nome, (qtdPorItem.get(item.nome) ?? 0) + item.qtd);
  }
  const totalItens = [...qtdPorItem.values()].reduce((a, b) => a + b, 0);
  const top_itens = [...qtdPorItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, pct: Math.round((qtd / totalItens) * 100) }));

  const resumo = (lista: PedidoParaRelatorio[]) => {
    const faturacao = round2(lista.reduce((s, p) => s + p.valor_total, 0));
    return {
      pedidos: lista.length,
      faturacao,
      ticket_medio: lista.length ? round2(faturacao / lista.length) : 0,
    };
  };
  const hojeResumo = resumo(doDia(0));
  const ontem = resumo(doDia(1));

  return {
    pedidos_semana: semana.length,
    crescimento_pct: variacaoPct(semana.length, semanaAnterior.length) ?? 0,
    item_mais_vendido: top_itens[0]?.nome ?? null,
    pedidos_por_dia,
    top_itens,
    hoje: hojeResumo,
    kpi_deltas: {
      pedidos_pct: variacaoPct(hojeResumo.pedidos, ontem.pedidos),
      faturacao_pct: variacaoPct(hojeResumo.faturacao, ontem.faturacao),
      ticket_pct: variacaoPct(hojeResumo.ticket_medio, ontem.ticket_medio),
    },
  };
}

export async function gerar(db: Db, restauranteId: number, agora = new Date()): Promise<Relatorios> {
  const [restaurante] = await db
    .select({ fuso: restaurantes.fuso_horario })
    .from(restaurantes)
    .where(eq(restaurantes.id, restauranteId));
  const rows = await db
    .select({ criado_em: pedidos.criado_em, valor_total: pedidos.valor_total, itens: pedidos.itens })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.restaurante_id, restauranteId),
        // Só pedidos confirmados (pagos) contam — exclui rascunhos e pagamentos pendentes.
        inArray(pedidos.status, [...STATUS_PEDIDO]),
        gte(pedidos.criado_em, new Date(agora.getTime() - 15 * DIA_MS)),
      ),
    );
  return agregar(
    rows.map((r) => ({ ...r, valor_total: toNumber(r.valor_total) })),
    restaurante?.fuso ?? "Europe/Lisbon",
    agora,
  );
}
