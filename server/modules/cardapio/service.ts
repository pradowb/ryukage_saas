import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { eventos, itensCardapio } from "../../db/schema.js";
import { naoEncontrado } from "../../lib/errors.js";
import { toNumber } from "../../lib/money.js";
import type { ItemCardapio, NovoItemCardapio } from "../../../shared/types.js";

type ItemRow = typeof itensCardapio.$inferSelect;
type Ctx = { restauranteId: number; usuarioId: number };

export const toItem = (r: ItemRow): ItemCardapio => ({
  id: r.id,
  nome: r.nome,
  descricao: r.descricao ?? "",
  preco: toNumber(r.preco),
  categoria: r.categoria,
  disponivel: r.disponivel,
});

export async function listar(db: Db, restauranteId: number): Promise<ItemCardapio[]> {
  const rows = await db
    .select()
    .from(itensCardapio)
    .where(eq(itensCardapio.restaurante_id, restauranteId))
    .orderBy(asc(itensCardapio.categoria), asc(itensCardapio.nome));
  return rows.map(toItem);
}

export async function criar(db: Db, ctx: Ctx, input: NovoItemCardapio): Promise<ItemCardapio> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(itensCardapio)
      .values({
        restaurante_id: ctx.restauranteId,
        nome: input.nome,
        descricao: input.descricao ?? "",
        preco: input.preco.toFixed(2),
        categoria: input.categoria,
      })
      .returning();
    await tx.insert(eventos).values({
      restaurante_id: ctx.restauranteId,
      usuario_id: ctx.usuarioId,
      tipo: "cardapio.criado",
      dados: { item_id: row!.id, nome: row!.nome },
    });
    return toItem(row!);
  });
}

export type AlteracaoItem = Partial<NovoItemCardapio & { disponivel: boolean }>;

export async function atualizar(db: Db, ctx: Ctx, id: number, input: AlteracaoItem): Promise<ItemCardapio> {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select({ disponivel: itensCardapio.disponivel })
      .from(itensCardapio)
      .where(and(eq(itensCardapio.id, id), eq(itensCardapio.restaurante_id, ctx.restauranteId)));
    if (!antes) throw naoEncontrado("Item não encontrado.");

    const [row] = await tx
      .update(itensCardapio)
      .set({ ...input, preco: input.preco?.toFixed(2) })
      .where(and(eq(itensCardapio.id, id), eq(itensCardapio.restaurante_id, ctx.restauranteId)))
      .returning();

    if (input.disponivel !== undefined && input.disponivel !== antes.disponivel) {
      await tx.insert(eventos).values({
        restaurante_id: ctx.restauranteId,
        usuario_id: ctx.usuarioId,
        tipo: "cardapio.disponibilidade",
        dados: { item_id: id, nome: row!.nome, disponivel: input.disponivel },
      });
    }
    return toItem(row!);
  });
}
