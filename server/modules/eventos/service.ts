import { desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { eventos, usuarios } from "../../db/schema.js";
import type { Evento } from "../../../shared/types.js";

export async function recentes(db: Db, restauranteId: number, limite = 10): Promise<Evento[]> {
  const rows = await db
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      dados: eventos.dados,
      criado_em: eventos.criado_em,
      usuario: usuarios.nome,
    })
    .from(eventos)
    .leftJoin(usuarios, eq(usuarios.id, eventos.usuario_id))
    .where(eq(eventos.restaurante_id, restauranteId))
    .orderBy(desc(eventos.criado_em), desc(eventos.id))
    .limit(limite);
  return rows.map((r) => ({ ...r, criado_em: r.criado_em.toISOString() }));
}
