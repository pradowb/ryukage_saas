import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarContexto, type Ctx } from "./helpers.js";

let ctx: Ctx;
let dono: string;
let equipe: string;
beforeAll(async () => {
  ctx = await criarContexto();
  dono = await ctx.cookie("dono@r1.pt");
  equipe = await ctx.cookie("equipe@r1.pt");
});
afterAll(() => ctx.close());

describe("cardápio", () => {
  it("lista só os itens do próprio restaurante", async () => {
    const res = await ctx.app.inject({ url: "/api/cardapio", headers: { cookie: dono } });
    expect(res.json().map((i: { nome: string }) => i.nome)).toEqual(["Calabresa"]);
  });

  it("o dono cria itens com validação", async () => {
    const invalido = await ctx.app.inject({
      method: "POST",
      url: "/api/cardapio",
      headers: { cookie: dono },
      payload: { nome: "", preco: -3, categoria: "Pizzas" },
    });
    expect(invalido.statusCode).toBe(400);
    expect(
      invalido
        .json()
        .detalhes.map((d: { campo: string }) => d.campo)
        .sort(),
    ).toEqual(["nome", "preco"]);

    const ok = await ctx.app.inject({
      method: "POST",
      url: "/api/cardapio",
      headers: { cookie: dono },
      payload: { nome: "Margherita", preco: 8.5, categoria: "Pizzas" },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ nome: "Margherita", preco: 8.5, disponivel: true, descricao: "" });
  });

  it("a equipa não cria itens nem muda preços, mas muda a disponibilidade", async () => {
    const criar = await ctx.app.inject({
      method: "POST",
      url: "/api/cardapio",
      headers: { cookie: equipe },
      payload: { nome: "X", preco: 1, categoria: "Pizzas" },
    });
    expect(criar.statusCode).toBe(403);

    const preco = await ctx.app.inject({
      method: "PATCH",
      url: `/api/cardapio/${ctx.ids.itemR1}`,
      headers: { cookie: equipe },
      payload: { preco: 0 },
    });
    expect(preco.statusCode).toBe(403);

    const disp = await ctx.app.inject({
      method: "PATCH",
      url: `/api/cardapio/${ctx.ids.itemR1}`,
      headers: { cookie: equipe },
      payload: { disponivel: false },
    });
    expect(disp.statusCode).toBe(200);
    expect(disp.json().disponivel).toBe(false);
  });

  it("não altera itens de outro restaurante", async () => {
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/cardapio/${ctx.ids.itemR2}`,
      headers: { cookie: dono },
      payload: { disponivel: false },
    });
    expect(res.statusCode).toBe(404);
  });

  it("recusa JSON malformado com 400 (e não 500)", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/cardapio",
      headers: { cookie: dono, "content-type": "application/json" },
      payload: "{oops",
    });
    expect(res.statusCode).toBe(400);
  });
});
