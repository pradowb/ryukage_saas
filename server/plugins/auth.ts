import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Db } from "../db/client.js";
import { naoAutenticado, proibido } from "../lib/errors.js";
import { autenticar, type Auth } from "../modules/auth/service.js";
import type { Papel } from "../../shared/types.js";

export const SESSION_COOKIE = "pulse_sessao";

declare module "fastify" {
  interface FastifyRequest {
    /** Preenchido em todas as rotas /api que não sejam marcadas com `config.publica`. */
    auth: Auth;
  }
  interface FastifyContextConfig {
    publica?: boolean;
  }
}

/**
 * Autenticação por omissão: toda a rota /api exige sessão válida, exceto as marcadas
 * com `config: { publica: true }`. Assim uma rota nova nunca nasce aberta por esquecimento.
 */
export const authPlugin = fp(async (app: FastifyInstance, { db }: { db: Db }) => {
  app.decorateRequest("auth", null as unknown as Auth);

  app.addHook("preHandler", async (req) => {
    if (!req.url.startsWith("/api/") || req.routeOptions.config.publica) return;
    const token = req.cookies[SESSION_COOKIE];
    const auth = token ? await autenticar(db, token) : null;
    if (!auth) throw naoAutenticado();
    req.auth = auth;
  });
});

export function exigirPapel(req: FastifyRequest, ...papeis: Papel[]) {
  if (!papeis.includes(req.auth.papel)) throw proibido();
}
