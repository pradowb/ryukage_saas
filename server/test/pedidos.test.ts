import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarContexto, type Ctx } from "./helpers.js";

let ctx: Ctx;
let cookie: string;
beforeAll(async () => {
  ctx = await criarContexto();
  cookie = await ctx.cookie("equipe@r1.pt");
});
afterAll(() => ctx.close());

const avancar = (id: number, novo_status: string, c = cookie) =>
  ctx.app.inject({
    method: "PATCH",
    url: `/api/pedidos/${id}/status`,
    headers: { cookie: c },
    payload: { novo_status },
  });

describe("pedidos", () => {
  it("só lista pedidos do próprio restaurante", async () => {
    const res = await ctx.app.inject({ url: "/api/pedidos", headers: { cookie } });
    const ids = res.json().map((p: { id: number }) => p.id);
    expect(ids).toContain(ctx.ids.pedidoR1);
    expect(ids).not.toContain(ctx.ids.pedidoR2);
  });

  it("devolve números, não strings, nos valores", async () => {
    const res = await ctx.app.inject({ url: "/api/pedidos", headers: { cookie } });
    expect(res.json()[0].valor_total).toBe(18);
  });

  it("não deixa alterar pedido de outro restaurante", async () => {
    const res = await avancar(ctx.ids.pedidoR2, "em_preparo");
    expect(res.statusCode).toBe(404);
  });

  it("valida o status enviado", async () => {
    expect((await avancar(ctx.ids.pedidoR1, "cancelado_por_magia")).statusCode).toBe(400);
  });

  it("não deixa saltar etapas", async () => {
    const res = await avancar(ctx.ids.pedidoR1, "entregue");
    expect(res.statusCode).toBe(422);
  });

  it("avança um passo de cada vez e regista o evento", async () => {
    const res = await avancar(ctx.ids.pedidoR1, "em_preparo");
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("em_preparo");

    const repetido = await avancar(ctx.ids.pedidoR1, "em_preparo");
    expect(repetido.statusCode).toBe(409);

    const eventos = (await ctx.app.inject({ url: "/api/eventos", headers: { cookie } })).json();
    expect(eventos[0]).toMatchObject({
      tipo: "pedido.status",
      usuario: "Cozinha",
      dados: { pedido_id: ctx.ids.pedidoR1, de: "confirmado", para: "em_preparo" },
    });
  });

  // Nota: o PGlite tem uma só ligação e serializa transações, por isso este teste valida o
  // resultado visível (um 200 e um 409) mas não exercita a corrida real. A proteção contra
  // a corrida — o UPDATE condicional ao status atual — só é posta à prova com Postgres real.
  it("em cliques repetidos só um ganha", async () => {
    const [a, b] = await Promise.all([
      avancar(ctx.ids.pedidoR1, "pronto"),
      avancar(ctx.ids.pedidoR1, "pronto"),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });

  it("pagina o histórico de entregues", async () => {
    await avancar(ctx.ids.pedidoR1, "entregue");
    const res = await ctx.app.inject({ url: "/api/pedidos/historico?limite=5", headers: { cookie } });
    expect(res.json()).toMatchObject({ total: 1, pagina: 1, limite: 5 });
  });
});
