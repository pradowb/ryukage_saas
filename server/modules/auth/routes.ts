import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../../app.js";
import { naoAutenticado } from "../../lib/errors.js";
import { SESSION_COOKIE } from "../../plugins/auth.js";
import type { Sessao } from "../../../shared/types.js";
import * as auth from "./service.js";

const LoginBody = z.object({
  email: z.string().trim().email().max(200),
  senha: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance, { db, config }: Deps) {
  app.post(
    "/api/auth/login",
    {
      config: {
        publica: true,
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      const { email, senha } = LoginBody.parse(req.body);
      const result = await auth.login(db, email, senha, config.sessionTtlMs);
      if (!result) throw naoAutenticado("Email ou senha incorretos.");

      const sessao = await auth.autenticar(db, result.token);
      reply.setCookie(SESSION_COOKIE, result.token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.cookieSecure,
        expires: result.expiraEm,
      });
      return toSessao(sessao!);
    },
  );

  app.post("/api/auth/logout", { config: { publica: true } }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await auth.logout(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/auth/sessao", async (req) => toSessao(req.auth));
}

const toSessao = (a: auth.Auth): Sessao => ({ usuario: a.usuario, restaurante: a.restaurante });
