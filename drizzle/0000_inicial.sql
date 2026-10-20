-- Migração inicial — ADITIVA e IDEMPOTENTE.
--
-- Corre tanto numa base vazia (dev, testes, CI) como na base de produção, onde `pedidos` e
-- `itens_cardapio` já existem e são escritas pelo agente n8n. Sobre essas tabelas legadas
-- esta migração só ACRESCENTA (colunas em falta, chaves, índices); nunca altera nem remove
-- colunas existentes, nem valida dados antigos com CHECKs.

-- ── Tabelas novas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "restaurantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cidade" text DEFAULT '' NOT NULL,
	"fuso_horario" text DEFAULT 'Europe/Lisbon' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Restaurante "dono" dos dados que já existem (e dos que o n8n continua a inserir sem restaurante_id).
INSERT INTO "restaurantes" ("id", "nome") VALUES (1, 'Restaurante principal') ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('restaurantes', 'id'), GREATEST((SELECT max("id") FROM "restaurantes"), 1));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurante_id" integer NOT NULL REFERENCES "restaurantes"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" text DEFAULT 'equipe' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_papel_chk" CHECK ("papel" in ('dono', 'equipe'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_unq" ON "usuarios" USING btree (lower("email"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL REFERENCES "usuarios"("id") ON DELETE cascade,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eventos" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurante_id" integer NOT NULL REFERENCES "restaurantes"("id") ON DELETE cascade,
	"usuario_id" integer REFERENCES "usuarios"("id") ON DELETE set null,
	"tipo" text NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eventos_restaurante_idx" ON "eventos" USING btree ("restaurante_id","criado_em");
--> statement-breakpoint

-- ── itens_cardapio (legada) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "itens_cardapio" ("id" serial PRIMARY KEY NOT NULL);
--> statement-breakpoint
ALTER TABLE "itens_cardapio"
	ADD COLUMN IF NOT EXISTS "nome" text NOT NULL,
	ADD COLUMN IF NOT EXISTS "descricao" text DEFAULT '',
	ADD COLUMN IF NOT EXISTS "preco" numeric NOT NULL,
	ADD COLUMN IF NOT EXISTS "categoria" text NOT NULL,
	ADD COLUMN IF NOT EXISTS "disponivel" boolean DEFAULT true NOT NULL,
	ADD COLUMN IF NOT EXISTS "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	ADD COLUMN IF NOT EXISTS "restaurante_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itens_cardapio_restaurante_id_restaurantes_id_fk') THEN
		ALTER TABLE "itens_cardapio" ADD CONSTRAINT "itens_cardapio_restaurante_id_restaurantes_id_fk"
			FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE cascade;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itens_cardapio_restaurante_idx" ON "itens_cardapio" USING btree ("restaurante_id");
--> statement-breakpoint

-- ── pedidos (legada) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pedidos" ("id" serial PRIMARY KEY NOT NULL);
--> statement-breakpoint
ALTER TABLE "pedidos"
	ADD COLUMN IF NOT EXISTS "chatid" text,
	ADD COLUMN IF NOT EXISTS "itens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	ADD COLUMN IF NOT EXISTS "valor_total" numeric DEFAULT '0' NOT NULL,
	ADD COLUMN IF NOT EXISTS "endereco" text,
	ADD COLUMN IF NOT EXISTS "tipo_entrega" text,
	ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'confirmado' NOT NULL,
	ADD COLUMN IF NOT EXISTS "pagamento_ref" text,
	ADD COLUMN IF NOT EXISTS "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	ADD COLUMN IF NOT EXISTS "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	ADD COLUMN IF NOT EXISTS "restaurante_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_restaurante_id_restaurantes_id_fk') THEN
		ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_restaurante_id_restaurantes_id_fk"
			FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE cascade;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_restaurante_status_idx" ON "pedidos" USING btree ("restaurante_id","status","criado_em");
--> statement-breakpoint
-- O agente depende disto para o `on conflict (chatid) where status = 'rascunho'`.
-- Se a produção já tiver um índice equivalente com outro nome, este é só redundante.
CREATE UNIQUE INDEX IF NOT EXISTS "pedidos_rascunho_chatid_unq" ON "pedidos" USING btree ("chatid") WHERE status = 'rascunho';
