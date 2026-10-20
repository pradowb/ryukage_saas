import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { parseNotificacao, type Topico } from "../lib/bus.js";
import { criarContexto, type Ctx } from "./helpers.js";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(() => ctx.close());

describe("tempo real (LISTEN/NOTIFY → bus)", () => {
  it("um INSERT feito diretamente na base (ex.: pelo n8n) chega ao restaurante certo", async () => {
    const recebidos: { r: number; t: Topico }[] = [];
    const unlisten = await ctx.database.listen("pulse", (payload) => {
      const n = parseNotificacao(payload);
      if (n) ctx.bus.publish(n.restauranteId, n.topico);
    });
    const off = ctx.bus.subscribe(ctx.ids.r1, (t) => recebidos.push({ r: ctx.ids.r1, t }));

    await ctx.database.db.execute(sql`
      insert into pedidos (restaurante_id, itens, valor_total, tipo_entrega)
      values (${ctx.ids.r1}, '[]'::jsonb, 10, 'retirada')`);
    await ctx.database.db.execute(sql`
      insert into pedidos (restaurante_id, itens, valor_total, tipo_entrega)
      values (${ctx.ids.r2}, '[]'::jsonb, 10, 'retirada')`);
    await new Promise((r) => setTimeout(r, 100));

    expect(recebidos).toEqual([{ r: ctx.ids.r1, t: "pedidos" }]);
    off();
    await unlisten();
  });

  it("pedidos inseridos fora da API aparecem nas notificações", async () => {
    const cookie = await ctx.cookie("dono@r1.pt");
    const eventos = (await ctx.app.inject({ url: "/api/eventos", headers: { cookie } })).json();
    expect(eventos.some((e: { tipo: string }) => e.tipo === "pedido.novo")).toBe(true);
  });

  it("ignora payloads desconhecidos", () => {
    expect(parseNotificacao("lixo")).toBeNull();
    expect(parseNotificacao(JSON.stringify({ tabela: "usuarios", restaurante_id: 1 }))).toBeNull();
  });
});
