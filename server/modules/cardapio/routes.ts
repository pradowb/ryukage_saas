import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../../app.js";
import { exigirPapel } from "../../plugins/auth.js";
import * as service from "./service.js";

const Id = z.coerce.number().int().positive();

const ItemBody = z.object({
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().trim().max(500).optional(),
  preco: z.number().finite().min(0).max(10_000),
  categoria: z.string().trim().min(1).max(60),
});

const AlteracaoBody = ItemBody.partial()
  .extend({ disponivel: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Nada para alterar.");

export async function cardapioRoutes(app: FastifyInstance, { db }: Deps) {
  app.get("/api/cardapio", async (req) => service.listar(db, req.auth.restauranteId));

  app.post("/api/cardapio", async (req, reply) => {
    exigirPapel(req, "dono");
    const item = await service.criar(db, req.auth, ItemBody.parse(req.body));
    return reply.code(201).send(item);
  });

  app.patch("/api/cardapio/:id", async (req) => {
    const id = Id.parse((req.params as { id: string }).id);
    const body = AlteracaoBody.parse(req.body);
    // A equipa só pode ligar/desligar a disponibilidade; preços e nomes são do dono.
    const soDisponibilidade = Object.keys(body).every((k) => k === "disponivel");
    if (!soDisponibilidade) exigirPapel(req, "dono");
    return service.atualizar(db, req.auth, id, body);
  });
}
