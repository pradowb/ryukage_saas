import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { restaurantes, sessoes, usuarios } from "../../db/schema.js";
import { DUMMY_HASH, verifyPassword } from "../../lib/password.js";
import type { Papel, Sessao } from "../../../shared/types.js";

export interface Auth extends Sessao {
  restauranteId: number;
  usuarioId: number;
  papel: Papel;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function login(
  db: Db,
  email: string,
  senha: string,
  ttlMs: number,
): Promise<{ token: string; expiraEm: Date } | null> {
  const [usuario] = await db
    .select({ id: usuarios.id, senha_hash: usuarios.senha_hash })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = lower(${email})`)
    .limit(1);

  const ok = await verifyPassword(senha, usuario?.senha_hash ?? DUMMY_HASH);
  if (!usuario || !ok) return null;

  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + ttlMs);
  await db.transaction(async (tx) => {
    await tx
      .delete(sessoes)
      .where(and(eq(sessoes.usuario_id, usuario.id), lt(sessoes.expira_em, new Date())));
    await tx.insert(sessoes).values({ id: hashToken(token), usuario_id: usuario.id, expira_em: expiraEm });
  });
  return { token, expiraEm };
}

export async function autenticar(db: Db, token: string): Promise<Auth | null> {
  const [row] = await db
    .select({
      usuarioId: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      papel: usuarios.papel,
      restauranteId: restaurantes.id,
      restauranteNome: restaurantes.nome,
      cidade: restaurantes.cidade,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuario_id))
    .innerJoin(restaurantes, eq(restaurantes.id, usuarios.restaurante_id))
    .where(and(eq(sessoes.id, hashToken(token)), gt(sessoes.expira_em, new Date())))
    .limit(1);
  if (!row) return null;
  return {
    usuarioId: row.usuarioId,
    restauranteId: row.restauranteId,
    papel: row.papel,
    usuario: { id: row.usuarioId, nome: row.nome, email: row.email, papel: row.papel },
    restaurante: { id: row.restauranteId, nome: row.restauranteNome, cidade: row.cidade },
  };
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.delete(sessoes).where(eq(sessoes.id, hashToken(token)));
}
