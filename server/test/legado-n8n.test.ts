/**
 * Simula a base de produção: tabelas criadas pelo agente n8n ANTES deste projeto, com dados.
 * Garante que as migrações correm por cima sem partir nada e que as queries do agente
 * (copiadas do workflow n8n em 2026-10-20) continuam a funcionar.
 *
 * ⚠️ O DDL legado abaixo foi deduzido das queries do n8n — não do schema real. Confirme os
 * tipos com a query em docs/verificar-schema-producao.sql antes do primeiro deploy.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createDatabase, type Database } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { Bus } from "../lib/bus.js";
import { hashPassword } from "../lib/password.js";

const CHAT = "351900000000@s.whatsapp.net";

let database: Database;
let app: FastifyInstance;
let cookie: string;
const exec = (q: ReturnType<typeof sql>) => database.db.execute(q);
const rows = async <T>(q: ReturnType<typeof sql>) => (await exec(q)).rows as T[];

/** Query do nó "montar_pedido" do agente. */
const montarPedido = (itens: unknown[], total: number, endereco: string | null, tipo: string | null) =>
  exec(sql`
    insert into pedidos (chatid, itens, valor_total, endereco, tipo_entrega, status)
    values (${CHAT}, ${JSON.stringify(itens)}::jsonb, ${total}, ${endereco}, ${tipo}, 'rascunho')
    on conflict (chatid) where status = 'rascunho'
    do update set itens = excluded.itens,
                  valor_total = excluded.valor_total,
                  endereco = coalesce(excluded.endereco, pedidos.endereco),
                  tipo_entrega = coalesce(excluded.tipo_entrega, pedidos.tipo_entrega),
                  atualizado_em = now()
    returning *`);

beforeAll(async () => {
  database = await createDatabase({});

  // Estado "antes": só as tabelas do agente, com dados.
  await exec(sql`
    create table itens_cardapio (
      id serial primary key, nome text not null, descricao text, preco numeric not null,
      categoria text not null, disponivel boolean not null default true)`);
  await exec(sql`
    create table pedidos (
      id serial primary key, chatid text, itens jsonb, valor_total numeric, endereco text,
      tipo_entrega text, status text, pagamento_ref text,
      criado_em timestamptz default now(), atualizado_em timestamptz default now())`);
  await exec(sql`create unique index pedidos_um_rascunho on pedidos (chatid) where status = 'rascunho'`);
  await exec(
    sql`insert into itens_cardapio (nome, descricao, preco, categoria) values ('Calabresa', null, 9, 'Pizzas')`,
  );
  await exec(sql`
    insert into pedidos (chatid, itens, valor_total, endereco, tipo_entrega, status) values
      ('antigo@s.whatsapp.net', '[{"nome":"Calabresa","qtd":1,"preco":9}]', 9, null, 'retirada', 'confirmado'),
      ('outro@s.whatsapp.net',  '[]', 0, null, null, 'rascunho')`);

  await database.migrate();

  await database.db.insert(usuarios).values({
    restaurante_id: 1,
    nome: "Dono",
    email: "dono@legado.pt",
    papel: "dono",
    senha_hash: await hashPassword("x"),
  });
  app = await buildApp(
    { db: database.db, config: { ...loadConfig({ NODE_ENV: "test" }), cookieSecure: false }, bus: new Bus() },
    { webDir: undefined },
  );
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "dono@legado.pt", senha: "x" },
  });
  cookie = `pulse_sessao=${res.cookies.find((c) => c.name === "pulse_sessao")!.value}`;
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const fila = async () =>
  (await app.inject({ url: "/api/pedidos", headers: { cookie } })).json() as { id: number; status: string }[];

describe("migração sobre a base legada do n8n", () => {
  it("atribui os dados existentes ao restaurante 1 sem perder nada", async () => {
    const r = await rows<{ n: number; sem_restaurante: number }>(sql`
      select count(*)::int as n, count(*) filter (where restaurante_id <> 1)::int as sem_restaurante from pedidos`);
    expect(r[0]).toEqual({ n: 2, sem_restaurante: 0 });
    const cardapio = (await app.inject({ url: "/api/cardapio", headers: { cookie } })).json();
    expect(cardapio).toEqual([expect.objectContaining({ nome: "Calabresa", descricao: "", preco: 9 })]);
  });

  it("é idempotente (pode correr de novo)", async () => {
    await expect(database.migrate()).resolves.toBeUndefined();
  });

  it("o painel mostra pedidos antigos confirmados mas não rascunhos", async () => {
    const f = await fila();
    expect(f.map((p) => p.status)).toEqual(["confirmado"]);
  });
});

describe("queries do agente continuam a funcionar", () => {
  it("montar_pedido cria e atualiza o rascunho sem restaurante_id", async () => {
    await montarPedido([{ nome: "Calabresa", qtd: 1, preco: 9 }], 9, null, null);
    const [p] = (await montarPedido([{ nome: "Calabresa", qtd: 2, preco: 9 }], 18, "Rua A", "entrega"))
      .rows as {
      id: number;
      restaurante_id: number;
      valor_total: string;
    }[];
    expect(p).toMatchObject({ restaurante_id: 1, valor_total: "18" });
    const rascunhos = await rows<{ n: number }>(
      sql`select count(*)::int as n from pedidos where chatid = ${CHAT} and status = 'rascunho'`,
    );
    expect(rascunhos[0]!.n).toBe(1);
  });

  it("rascunho não aparece no painel nem conta nos relatórios", async () => {
    expect((await fila()).length).toBe(1);
    const rel = (await app.inject({ url: "/api/relatorios", headers: { cookie } })).json();
    expect(rel.hoje.pedidos).toBe(1);
  });

  it("o pagamento MB WAY confirma o pedido, que entra no painel e nas notificações", async () => {
    await exec(sql`update pedidos set pagamento_ref = 'REF1' where chatid = ${CHAT} and status = 'rascunho'`);
    // Query do nó "atualizar pedido - confirmado"
    await exec(sql`
      update pedidos set status = 'confirmado', atualizado_em = now()
      where pagamento_ref = 'REF1' returning id, chatid, valor_total`);

    const f = await fila();
    expect(f.map((p) => p.status)).toEqual(["confirmado", "confirmado"]);

    const eventos = (await app.inject({ url: "/api/eventos", headers: { cookie } })).json();
    expect(eventos.filter((e: { tipo: string }) => e.tipo === "pedido.novo")).toHaveLength(1);
  });

  it("consultar_cardapio e inserir novo item cardapio funcionam", async () => {
    await exec(sql`
      insert into itens_cardapio (nome, descricao, preco, categoria, disponivel)
      values ('Margherita', 'Clássica', 8.5, 'Pizzas', true)
      returning id, nome, descricao, preco, categoria, disponivel`);
    const disponiveis = await rows<{ nome: string }>(sql`
      select nome, descricao, preco, categoria from itens_cardapio where disponivel = true order by categoria, nome`);
    expect(disponiveis.map((d) => d.nome)).toEqual(["Calabresa", "Margherita"]);
  });

  it("o painel continua a não aceitar transições a partir de estados do agente", async () => {
    const [rascunho] = await rows<{ id: number }>(sql`
      insert into pedidos (chatid, status) values ('x@s.whatsapp.net', 'rascunho') returning id`);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/pedidos/${rascunho!.id}/status`,
      headers: { cookie },
      payload: { novo_status: "em_preparo" },
    });
    expect(res.statusCode).toBe(422);
  });
});
