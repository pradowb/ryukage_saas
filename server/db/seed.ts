// Popula a base com um restaurante de demonstração. Uso: `npm run db:seed` (aceita `--reset`).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDatabase, type Db } from "./client.js";
import { eventos, itensCardapio, pedidos, restaurantes, RESTAURANTE_LEGADO_ID, usuarios } from "./schema.js";
import { hashPassword } from "../lib/password.js";
import type { ItemCardapio, Pedido } from "../../shared/types.js";

interface SeedData {
  itens_cardapio: Omit<ItemCardapio, "id">[];
  pedidos: (Omit<Pedido, "criado_em" | "id"> & { id: number })[];
}

const data = JSON.parse(readFileSync(new URL("./seed-data.json", import.meta.url), "utf8")) as SeedData;

/** Minutos atrás em que cada pedido de exemplo foi criado, para o quadro parecer "vivo". */
const MINUTOS_ATRAS: Record<number, number> = { 192: 8, 193: 3, 194: 1, 190: 22, 188: 28, 185: 48, 181: 78 };

/** Gerador pseudoaleatório determinístico — o histórico sai sempre igual. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

export async function seed(
  db: Db,
  opts: { reset?: boolean; agora?: Date; log?: (msg: string) => void } = {},
) {
  const log = opts.log ?? console.log;
  const agora = opts.agora ?? new Date();
  const config = loadConfig();

  const producao = config.env === "production";
  const existente = await db.select({ id: usuarios.id }).from(usuarios).limit(1);
  if (existente.length && !opts.reset) {
    log("A base já tem contas; nada a fazer (use --reset para recriar).");
    return;
  }
  if (opts.reset) {
    if (producao) throw new Error("--reset apagaria pedidos reais; não é permitido em produção.");
    await db.delete(restaurantes); // cascata apaga o resto
  }

  const senha = (env: string) => {
    const v = process.env[env];
    if (v) return { valor: v, gerada: false };
    if (config.env === "production") throw new Error(`${env} é obrigatório em produção.`);
    return { valor: randomBytes(9).toString("base64url"), gerada: true };
  };
  const contas = [
    {
      nome: "Dono",
      email: process.env.SEED_ADMIN_EMAIL || "dono@labella.pt",
      papel: "dono" as const,
      senha: senha("SEED_ADMIN_PASSWORD"),
    },
    {
      nome: "Cozinha",
      email: process.env.SEED_EQUIPE_EMAIL || "cozinha@labella.pt",
      papel: "equipe" as const,
      senha: senha("SEED_EQUIPE_PASSWORD"),
    },
  ];

  await db.transaction(async (tx) => {
    // O restaurante 1 é o que recebe os pedidos do agente (ver RESTAURANTE_LEGADO_ID).
    const nome = process.env.SEED_RESTAURANTE_NOME || "La Bella";
    const cidade = process.env.SEED_RESTAURANTE_CIDADE || "Matosinhos";
    await tx
      .insert(restaurantes)
      .values({ id: RESTAURANTE_LEGADO_ID, nome, cidade })
      .onConflictDoUpdate({ target: restaurantes.id, set: { nome, cidade } });
    const restauranteId = RESTAURANTE_LEGADO_ID;

    for (const c of contas) {
      await tx.insert(usuarios).values({
        restaurante_id: restauranteId,
        nome: c.nome,
        email: c.email,
        papel: c.papel,
        senha_hash: await hashPassword(c.senha.valor),
      });
    }

    // Em produção o restaurante já tem cardápio e pedidos reais: só criamos as contas.
    if (producao) return;

    await tx
      .insert(itensCardapio)
      .values(
        data.itens_cardapio.map((i) => ({ ...i, restaurante_id: restauranteId, preco: i.preco.toFixed(2) })),
      );

    // Histórico de 13 dias (já entregue) para os relatórios terem o que mostrar.
    const rand = rng(42);
    const menu = data.itens_cardapio.filter((i) => i.categoria !== "Extras");
    const historico: (typeof pedidos.$inferInsert)[] = [];
    for (let dia = 13; dia >= 1; dia--) {
      const n = 14 + Math.floor(rand() * 22);
      for (let k = 0; k < n; k++) {
        const itens = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
          const m = menu[Math.floor(rand() * menu.length)]!;
          return { nome: m.nome, qtd: 1 + Math.floor(rand() * 2), preco: m.preco };
        });
        const entrega = rand() > 0.4;
        const criado = new Date(agora.getTime() - dia * 86_400_000 - Math.floor(rand() * 6 * 3_600_000));
        historico.push({
          restaurante_id: restauranteId,
          itens,
          valor_total: (itens.reduce((s, i) => s + i.qtd * i.preco, 0) + (entrega ? 2.5 : 0)).toFixed(2),
          endereco: entrega ? "Rua de Exemplo, " + (1 + Math.floor(rand() * 400)) : "",
          tipo_entrega: entrega ? "entrega" : "retirada",
          status: "entregue",
          criado_em: criado,
          atualizado_em: criado,
        });
      }
    }
    await tx.insert(pedidos).values(historico);
    // O trigger regista "pedido.novo" para cada insert; o histórico não deve aparecer nas notificações.
    await tx.delete(eventos).where(eq(eventos.restaurante_id, restauranteId));

    for (const p of data.pedidos) {
      const criado = new Date(agora.getTime() - (MINUTOS_ATRAS[p.id] ?? 0) * 60_000);
      await tx.insert(pedidos).values({
        restaurante_id: restauranteId,
        itens: p.itens,
        valor_total: p.valor_total.toFixed(2),
        endereco: p.endereco,
        tipo_entrega: p.tipo_entrega,
        status: p.status,
        criado_em: criado,
      });
    }
  });

  log("Seed concluído. Contas:");
  for (const c of contas) {
    log(
      `  ${c.papel.padEnd(6)} ${c.email}  senha: ${c.senha.gerada ? c.senha.valor + "  (gerada — guarde-a)" : "(definida no .env)"}`,
    );
  }
}

// Executado diretamente (npm run db:seed)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.ts")) {
  const config = loadConfig();
  const database = await createDatabase({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    await database.migrate();
    await seed(database.db, { reset: process.argv.includes("--reset") });
  } finally {
    await database.close();
  }
}
