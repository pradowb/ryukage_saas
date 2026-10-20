import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createDatabase, type Database } from "../db/client.js";
import { itensCardapio, pedidos, restaurantes, usuarios } from "../db/schema.js";
import { Bus } from "../lib/bus.js";
import { hashPassword } from "../lib/password.js";

export const SENHA = "senha-de-teste-123";

export interface Ctx {
  app: FastifyInstance;
  database: Database;
  bus: Bus;
  /** IDs dos dados criados: dois restaurantes para testar o isolamento entre clientes. */
  ids: { r1: number; r2: number; pedidoR1: number; pedidoR2: number; itemR1: number; itemR2: number };
  cookie(email: string): Promise<string>;
  close(): Promise<void>;
}

export async function criarContexto(): Promise<Ctx> {
  const database = await createDatabase({}); // PGlite em memória
  await database.migrate();
  const { db } = database;
  const hash = await hashPassword(SENHA);

  // O restaurante 1 é criado pela própria migração (é o que recebe os pedidos do agente).
  const [r1] = await db
    .update(restaurantes)
    .set({ nome: "La Bella", cidade: "Matosinhos" })
    .where(eq(restaurantes.id, 1))
    .returning();
  const [r2] = await db.insert(restaurantes).values({ nome: "Outra Pizzaria", cidade: "Lisboa" }).returning();
  await db.insert(usuarios).values([
    { restaurante_id: r1!.id, nome: "Dona", email: "dono@r1.pt", papel: "dono", senha_hash: hash },
    { restaurante_id: r1!.id, nome: "Cozinha", email: "equipe@r1.pt", papel: "equipe", senha_hash: hash },
    { restaurante_id: r2!.id, nome: "Outro", email: "dono@r2.pt", papel: "dono", senha_hash: hash },
  ]);
  const [i1, i2] = await db
    .insert(itensCardapio)
    .values([
      { restaurante_id: r1!.id, nome: "Calabresa", preco: "9.00", categoria: "Pizzas" },
      { restaurante_id: r2!.id, nome: "Secreta", preco: "99.00", categoria: "Pizzas" },
    ])
    .returning();
  const item = { nome: "Calabresa", qtd: 2, preco: 9 };
  const [p1, p2] = await db
    .insert(pedidos)
    .values([
      { restaurante_id: r1!.id, itens: [item], valor_total: "18.00", tipo_entrega: "retirada" },
      {
        restaurante_id: r2!.id,
        itens: [item],
        valor_total: "18.00",
        tipo_entrega: "entrega",
        endereco: "Rua X",
      },
    ])
    .returning();

  const bus = new Bus();
  const config = { ...loadConfig({ NODE_ENV: "test" }), cookieSecure: false };
  const app = await buildApp({ db, config, bus }, { webDir: undefined });

  return {
    app,
    database,
    bus,
    ids: { r1: r1!.id, r2: r2!.id, pedidoR1: p1!.id, pedidoR2: p2!.id, itemR1: i1!.id, itemR2: i2!.id },
    async cookie(email) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, senha: SENHA },
      });
      if (res.statusCode !== 200) throw new Error(`login falhou: ${res.body}`);
      const c = res.cookies.find((c) => c.name === "pulse_sessao");
      return `pulse_sessao=${c!.value}`;
    },
    async close() {
      await app.close();
      await database.close();
    },
  };
}
