import type { FastifyInstance } from "fastify";
import type { Deps } from "../../app.js";
import * as service from "./service.js";

export async function relatoriosRoutes(app: FastifyInstance, { db }: Deps) {
  app.get("/api/relatorios", async (req) => service.gerar(db, req.auth.restauranteId));
}
