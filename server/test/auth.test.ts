import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarContexto, SENHA, type Ctx } from "./helpers.js";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(() => ctx.close());

describe("autenticação", () => {
  it("bloqueia a API sem sessão", async () => {
    for (const url of [
      "/api/pedidos",
      "/api/cardapio",
      "/api/relatorios",
      "/api/eventos",
      "/api/auth/sessao",
    ]) {
      const res = await ctx.app.inject({ url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it("deixa o health check público", async () => {
    const res = await ctx.app.inject({ url: "/api/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("recusa senha errada e email inexistente com a mesma mensagem", async () => {
    const a = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "dono@r1.pt", senha: "errada" },
    });
    const b = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ninguem@r1.pt", senha: "errada" },
    });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json().erro).toBe(b.json().erro);
  });

  it("faz login com cookie httpOnly e devolve a sessão", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "DONO@r1.pt", senha: SENHA },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === "pulse_sessao")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(res.json()).toMatchObject({
      usuario: { email: "dono@r1.pt", papel: "dono" },
      restaurante: { nome: "La Bella" },
    });
  });

  it("invalida a sessão no logout", async () => {
    const cookie = await ctx.cookie("dono@r1.pt");
    const out = await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(out.statusCode).toBe(204);
    const depois = await ctx.app.inject({ url: "/api/auth/sessao", headers: { cookie } });
    expect(depois.statusCode).toBe(401);
  });

  it("limita tentativas de login", async () => {
    let ultimo = 0;
    for (let i = 0; i < 12; i++) {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "10.9.9.9",
        payload: { email: "dono@r1.pt", senha: "errada" },
      });
      ultimo = res.statusCode;
    }
    expect(ultimo).toBe(429);
  });

  it("recusa pedidos de outra origem (CSRF)", async () => {
    const cookie = await ctx.cookie("dono@r1.pt");
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/cardapio",
      headers: { cookie, origin: "https://site-malicioso.com", host: "localhost" },
      payload: { nome: "X", preco: 1, categoria: "Pizzas" },
    });
    expect(res.statusCode).toBe(403);
  });
});
