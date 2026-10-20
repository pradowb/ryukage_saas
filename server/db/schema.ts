import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ItemPedido, Papel, StatusPedido, TipoEntrega, TipoEvento } from "../../shared/types.js";

const criadoEm = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();

export const restaurantes = pgTable("restaurantes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cidade: text("cidade").notNull().default(""),
  fuso_horario: text("fuso_horario").notNull().default("Europe/Lisbon"),
  criado_em: criadoEm(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    restaurante_id: integer("restaurante_id")
      .notNull()
      .references(() => restaurantes.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    senha_hash: text("senha_hash").notNull(),
    papel: text("papel").$type<Papel>().notNull().default("equipe"),
    criado_em: criadoEm(),
  },
  (t) => [
    uniqueIndex("usuarios_email_unq").on(sql`lower(${t.email})`),
    check("usuarios_papel_chk", sql`${t.papel} in ('dono', 'equipe')`),
  ],
);

export const sessoes = pgTable(
  "sessoes",
  {
    /** sha256 do token enviado no cookie — o token em claro nunca é guardado. */
    id: text("id").primaryKey(),
    usuario_id: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    expira_em: timestamp("expira_em", { withTimezone: true }).notNull(),
    criado_em: criadoEm(),
  },
  (t) => [index("sessoes_usuario_idx").on(t.usuario_id)],
);

/**
 * As tabelas `itens_cardapio` e `pedidos` já existem em produção e são escritas pelo agente n8n,
 * que não conhece `restaurante_id`. Por isso:
 *  - `restaurante_id` tem default 1 (o restaurante original) até o n8n passar a enviá-lo;
 *  - colunas que o agente preenche aos poucos (rascunho) são opcionais;
 *  - não há CHECK em `status`: o agente usa estados próprios (ex.: 'rascunho') antes de 'confirmado'.
 *    O painel só lê os estados de STATUS_PEDIDO e a API valida as transições.
 * Ver drizzle/0000_inicial.sql — a migração é aditiva e idempotente sobre as tabelas legadas.
 */
export const RESTAURANTE_LEGADO_ID = 1;

export const itensCardapio = pgTable(
  "itens_cardapio",
  {
    id: serial("id").primaryKey(),
    restaurante_id: integer("restaurante_id")
      .notNull()
      .default(RESTAURANTE_LEGADO_ID)
      .references(() => restaurantes.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    descricao: text("descricao").default(""),
    preco: numeric("preco").notNull(),
    categoria: text("categoria").notNull(),
    disponivel: boolean("disponivel").notNull().default(true),
    criado_em: criadoEm(),
  },
  (t) => [index("itens_cardapio_restaurante_idx").on(t.restaurante_id)],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    restaurante_id: integer("restaurante_id")
      .notNull()
      .default(RESTAURANTE_LEGADO_ID)
      .references(() => restaurantes.id, { onDelete: "cascade" }),
    /** JID do WhatsApp do cliente; identifica o rascunho em curso. */
    chatid: text("chatid"),
    itens: jsonb("itens").$type<ItemPedido[]>().notNull().default([]),
    valor_total: numeric("valor_total").notNull().default("0"),
    endereco: text("endereco"),
    tipo_entrega: text("tipo_entrega").$type<TipoEntrega>(),
    /** Estados do agente ('rascunho', …) + os do painel (STATUS_PEDIDO). */
    status: text("status").$type<StatusPedido | (string & {})>().notNull().default("confirmado"),
    /** Referência do pagamento MB WAY. */
    pagamento_ref: text("pagamento_ref"),
    criado_em: criadoEm(),
    atualizado_em: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pedidos_restaurante_status_idx").on(t.restaurante_id, t.status, t.criado_em),
    // Usado pelo `on conflict (chatid) where status = 'rascunho'` do agente.
    uniqueIndex("pedidos_rascunho_chatid_unq")
      .on(t.chatid)
      .where(sql`status = 'rascunho'`),
  ],
);

/** Registo de auditoria: quem fez o quê e quando. Também alimenta as notificações. */
export const eventos = pgTable(
  "eventos",
  {
    id: serial("id").primaryKey(),
    restaurante_id: integer("restaurante_id")
      .notNull()
      .references(() => restaurantes.id, { onDelete: "cascade" }),
    usuario_id: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    tipo: text("tipo").$type<TipoEvento>().notNull(),
    dados: jsonb("dados").$type<Record<string, unknown>>().notNull().default({}),
    criado_em: criadoEm(),
  },
  (t) => [index("eventos_restaurante_idx").on(t.restaurante_id, t.criado_em)],
);
