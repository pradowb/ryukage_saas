import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../../app.js";
import { STATUS_PEDIDO } from "../../../shared/types.js";
import * as service from "./service.js";

const Id = z.coerce.number().int().positive();

const StatusBody = z.object({
  novo_status: z.enum(STATUS_PEDIDO),
});

const HistoricoQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export async function pedidosRoutes(app: FastifyInstance, { db }: Deps) {
  app.get("/api/pedidos", async (req) => service.listarFila(db, req.auth.restauranteId));

  app.get("/api/pedidos/historico", async (req) => {
    const { pagina, limite } = HistoricoQuery.parse(req.query);
    return service.listarHistorico(db, req.auth.restauranteId, pagina, limite);
  });

  app.patch("/api/pedidos/:id/status", async (req) => {
    const id = Id.parse((req.params as { id: string }).id);
    const { novo_status } = StatusBody.parse(req.body);
    return service.avancarStatus(db, req.auth, id, novo_status);
  });
}
