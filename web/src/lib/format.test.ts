import { describe, expect, it } from "vitest";
import type { Evento } from "../../../shared/types";
import { descreverEvento, fmtDelta, itemsText, money, sparkFromDias, timeAgo, tipoLabel } from "./format";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe("format", () => {
  it("formata euros em pt-PT", () => {
    expect(money(24.5).replace(/\s/g, " ")).toBe("24,50 €");
    expect(money(undefined).replace(/\s/g, " ")).toBe("0,00 €");
  });

  it("descreve há quanto tempo", () => {
    expect(timeAgo(ago(0), false, NOW)).toBe("há instantes");
    expect(timeAgo(ago(8), false, NOW)).toBe("há 8 min");
    expect(timeAgo(ago(130), false, NOW)).toBe("há 2 h");
    expect(timeAgo(ago(3000), false, NOW)).toBe("há 2 d");
    expect(timeAgo(ago(8), true, NOW)).toBe("concluído há 8 min");
  });

  it("lista itens e tipo de entrega", () => {
    expect(itemsText([{ nome: "Calabresa", qtd: 2, preco: 9 }])).toBe("2× Calabresa");
    expect(tipoLabel({ tipo_entrega: "entrega" })).toBe("Entrega");
    expect(tipoLabel({ tipo_entrega: "retirada" })).toBe("Retirada");
  });

  it("mostra variações com sinal", () => {
    expect(fmtDelta(12.4, "%")).toBe("+12.4%");
    expect(fmtDelta(-3, "%")).toBe("-3%");
    expect(fmtDelta(null, "%")).toBe("");
  });

  it("normaliza o sparkline e usa o fallback sem dados", () => {
    expect(sparkFromDias([{ valor: 10 }, { valor: 5 }, { valor: 0 }], [])).toEqual([1, 0.5, 0.08]);
    expect(sparkFromDias([], [0.1])).toEqual([0.1]);
  });

  it("traduz eventos em notificações", () => {
    const e = (
      tipo: Evento["tipo"],
      dados: Record<string, unknown>,
      usuario: string | null = null,
    ): Evento => ({
      id: 1,
      tipo,
      dados,
      usuario,
      criado_em: ago(1),
    });
    expect(descreverEvento(e("pedido.status", { pedido_id: 192, para: "pronto" }, "Ana")).corpo).toBe(
      "Pedido #0192 → Pronto por Ana.",
    );
    expect(
      descreverEvento(e("cardapio.disponibilidade", { nome: "Margherita", disponivel: false })).tone,
    ).toBe("warning");
  });
});
