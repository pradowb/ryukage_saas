import type { FastifyInstance } from "fastify";
import type { Deps } from "../../app.js";
import * as service from "./service.js";

const KEEPALIVE_MS = 25_000;

export async function eventosRoutes(app: FastifyInstance, { db, bus }: Deps) {
  app.get("/api/eventos", async (req) => service.recentes(db, req.auth.restauranteId));

  /**
   * Server-Sent Events: o painel recebe "pedidos" ou "cardapio" sempre que algo muda
   * e volta a pedir os dados. Mais leve que polling e funciona atrás de proxies HTTP.
   */
  app.get("/api/eventos/stream", (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n");

    const unsubscribe = bus.subscribe(req.auth.restauranteId, (topico) => {
      res.write(`event: ${topico}\ndata: {}\n\n`);
    });
    const keepalive = setInterval(() => res.write(": ping\n\n"), KEEPALIVE_MS);

    req.raw.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });
}
