import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import { AppError } from "./lib/errors.js";
import type { Bus } from "./lib/bus.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/routes.js";
import { pedidosRoutes } from "./modules/pedidos/routes.js";
import { cardapioRoutes } from "./modules/cardapio/routes.js";
import { relatoriosRoutes } from "./modules/relatorios/routes.js";
import { eventosRoutes } from "./modules/eventos/routes.js";
import type { ErroApi } from "../shared/types.js";

export interface Deps {
  db: Db;
  config: Config;
  bus: Bus;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(
  deps: Deps,
  opts: { logger?: FastifyServerOptions["logger"]; webDir?: string } = {},
) {
  const { config } = deps;
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
  });

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.cookieSecure ? [] : null,
      },
    },
  });
  await app.register(rateLimit, { global: false });

  // Proteção CSRF: pedidos que alteram dados têm de vir da própria origem e em JSON.
  // (O cookie de sessão já é SameSite=Lax; isto fecha o resto.)
  app.addHook("onRequest", async (req, reply) => {
    if (!MUTATING.has(req.method) || !req.url.startsWith("/api/")) return;
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) {
      return reply.code(403).send({ ok: false, erro: "Origem não permitida." } satisfies ErroApi);
    }
  });

  await app.register(authPlugin, { db: deps.db });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        ok: false,
        erro: "Dados inválidos.",
        detalhes: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
      } satisfies ErroApi);
    }
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ ok: false, erro: err.message } satisfies ErroApi);
    }
    // Erros do próprio Fastify com código 4xx (JSON malformado, corpo grande demais, rate limit…)
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ ok: false, erro: err.message } satisfies ErroApi);
    }
    req.log.error({ err }, "erro não tratado");
    return reply.code(500).send({ ok: false, erro: "Erro interno." } satisfies ErroApi);
  });

  app.get("/api/health", { config: { publica: true } }, async (_req, reply) => {
    try {
      await deps.db.execute(sql`select 1`);
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false, erro: "Base de dados indisponível." } satisfies ErroApi);
    }
  });

  await app.register(async (api) => {
    await authRoutes(api, deps);
    await pedidosRoutes(api, deps);
    await cardapioRoutes(api, deps);
    await relatoriosRoutes(api, deps);
    await eventosRoutes(api, deps);
  });

  // Em produção a API também serve o painel compilado (dist/web), com fallback SPA.
  const webDir = opts.webDir ?? defaultWebDir();
  if (webDir) {
    await app.register(fastifyStatic, { root: webDir, wildcard: false });
  }
  app.setNotFoundHandler((req, reply) => {
    if (webDir && req.method === "GET" && !req.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ ok: false, erro: "Rota não encontrada." } satisfies ErroApi);
  });

  return app;
}

function defaultWebDir(): string | undefined {
  // A partir do build: dist/server → dist/web. A partir do código-fonte: server → dist/web.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const compilado = path.basename(path.dirname(here)) === "dist";
  const dir = path.resolve(here, compilado ? "../web" : "../dist/web");
  return existsSync(path.join(dir, "index.html")) ? dir : undefined;
}
