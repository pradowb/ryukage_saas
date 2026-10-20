import { and, count, desc, asc, eq, gte, inArray, ne, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { eventos, pedidos } from "../../db/schema.js";
import { conflito, naoEncontrado, AppError } from "../../lib/errors.js";
import { toNumber } from "../../lib/money.js";
import {
  PROXIMO_STATUS,
  STATUS_PEDIDO,
  type Pagina,
  type Pedido,
  type StatusPedido,
} from "../../../shared/types.js";

type PedidoRow = typeof pedidos.$inferSelect;

export const toPedido = (r: PedidoRow): Pedido => ({
  id: r.id,
  itens: r.itens,
  valor_total: toNumber(r.valor_total),
  endereco: r.endereco ?? "",
  tipo_entrega: r.tipo_entrega ?? "retirada",
  status: r.status as StatusPedido,
  criado_em: r.criado_em.toISOString(),
});

/** Quanto tempo um pedido entregue continua visível no quadro. */
const JANELA_ENTREGUES_MS = 12 * 60 * 60 * 1000;

/**
 * Fila do quadro: pedidos em curso + entregues nas últimas 12 h. Só entram os estados do
 * painel — rascunhos e pedidos à espera de pagamento do agente ficam de fora.
 */
export async function listarFila(db: Db, restauranteId: number, agora = new Date()): Promise<Pedido[]> {
  const rows = await db
    .select()
    .from(pedidos)
    .where(
      and(
        eq(pedidos.restaurante_id, restauranteId),
        inArray(pedidos.status, [...STATUS_PEDIDO]),
        or(
          ne(pedidos.status, "entregue"),
          gte(pedidos.atualizado_em, new Date(agora.getTime() - JANELA_ENTREGUES_MS)),
        ),
      ),
    )
    .orderBy(asc(pedidos.criado_em))
    .limit(500);
  return rows.map(toPedido);
}

export async function listarHistorico(
  db: Db,
  restauranteId: number,
  pagina: number,
  limite: number,
): Promise<Pagina<Pedido>> {
  const where = and(eq(pedidos.restaurante_id, restauranteId), eq(pedidos.status, "entregue"));
  const [rows, [totais]] = await Promise.all([
    db
      .select()
      .from(pedidos)
      .where(where)
      .orderBy(desc(pedidos.criado_em))
      .limit(limite)
      .offset((pagina - 1) * limite),
    db.select({ total: count() }).from(pedidos).where(where),
  ]);
  return { itens: rows.map(toPedido), total: totais?.total ?? 0, pagina, limite };
}

/**
 * Avança o status respeitando a máquina de estados (um passo de cada vez).
 * O UPDATE é condicional ao status atual, por isso dois cliques simultâneos
 * (ex.: dois tablets na cozinha) não fazem o pedido saltar dois passos.
 */
export async function avancarStatus(
  db: Db,
  ctx: { restauranteId: number; usuarioId: number },
  id: number,
  novoStatus: StatusPedido,
): Promise<Pedido> {
  return db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: pedidos.status })
      .from(pedidos)
      .where(and(eq(pedidos.id, id), eq(pedidos.restaurante_id, ctx.restauranteId)));
    if (!atual) throw naoEncontrado("Pedido não encontrado.");

    if (PROXIMO_STATUS[atual.status as StatusPedido] !== novoStatus) {
      if (atual.status === novoStatus) throw conflito("O pedido já está neste estado.");
      throw new AppError(422, `Transição inválida: ${atual.status} → ${novoStatus}.`);
    }

    const [atualizado] = await tx
      .update(pedidos)
      .set({ status: novoStatus })
      .where(
        and(
          eq(pedidos.id, id),
          eq(pedidos.restaurante_id, ctx.restauranteId),
          eq(pedidos.status, atual.status),
        ),
      )
      .returning();
    if (!atualizado) throw conflito("O pedido foi alterado por outra pessoa. Atualize e tente de novo.");

    await tx.insert(eventos).values({
      restaurante_id: ctx.restauranteId,
      usuario_id: ctx.usuarioId,
      tipo: "pedido.status",
      dados: { pedido_id: id, de: atual.status, para: novoStatus },
    });
    return toPedido(atualizado);
  });
}
