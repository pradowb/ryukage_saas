import { describe, expect, it } from "vitest";
import { agregar, type PedidoParaRelatorio } from "./service.js";

const FUSO = "Europe/Lisbon";
// Terça, 20 out 2026, 15:00 em Lisboa (UTC+1)
const AGORA = new Date("2026-10-20T14:00:00Z");
const diasAtras = (n: number, hora = 12) => new Date(Date.UTC(2026, 9, 20 - n, hora));

const pedido = (criado_em: Date, valor_total = 10, itens = [{ nome: "Calabresa", qtd: 1, preco: 10 }]) =>
  ({ criado_em, valor_total, itens }) satisfies PedidoParaRelatorio;

describe("agregar relatórios", () => {
  it("devolve zeros sem pedidos", () => {
    const r = agregar([], FUSO, AGORA);
    expect(r.pedidos_semana).toBe(0);
    expect(r.item_mais_vendido).toBeNull();
    expect(r.pedidos_por_dia.map((d) => d.dia)).toEqual(["Qua", "Qui", "Sex", "Sáb", "Dom", "Seg", "Ter"]);
    expect(r.kpi_deltas.pedidos_pct).toBeNull();
  });

  it("calcula semana, crescimento e KPIs de hoje vs ontem", () => {
    const lista = [
      pedido(diasAtras(0), 20),
      pedido(diasAtras(0), 10),
      pedido(diasAtras(1), 15),
      pedido(diasAtras(3)),
      pedido(diasAtras(8)), // semana anterior
      pedido(diasAtras(9)),
    ];
    const r = agregar(lista, FUSO, AGORA);
    expect(r.pedidos_semana).toBe(4);
    expect(r.crescimento_pct).toBe(100);
    expect(r.pedidos_por_dia.at(-1)).toEqual({ dia: "Ter", valor: 2 });
    expect(r.hoje).toEqual({ pedidos: 2, faturacao: 30, ticket_medio: 15 });
    expect(r.kpi_deltas.pedidos_pct).toBe(100);
    expect(r.kpi_deltas.faturacao_pct).toBe(100);
  });

  it("usa o fuso do restaurante para decidir o dia", () => {
    // 23:30 UTC de dia 19 = 00:30 de dia 20 em Lisboa → conta como "hoje"
    const r = agregar([pedido(new Date("2026-10-19T23:30:00Z"))], FUSO, AGORA);
    expect(r.hoje.pedidos).toBe(1);
  });

  it("ordena os itens mais vendidos por quantidade", () => {
    const r = agregar(
      [
        pedido(diasAtras(1), 10, [{ nome: "A", qtd: 1, preco: 1 }]),
        pedido(diasAtras(1), 10, [
          { nome: "B", qtd: 3, preco: 1 },
          { nome: "A", qtd: 0, preco: 1 },
        ]),
      ],
      FUSO,
      AGORA,
    );
    expect(r.top_itens).toEqual([
      { nome: "B", pct: 75 },
      { nome: "A", pct: 25 },
    ]);
    expect(r.item_mais_vendido).toBe("B");
  });
});
