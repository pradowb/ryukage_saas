-- Tempo real: qualquer alteração em pedidos ou no cardápio — feita pela API ou
-- diretamente na base (ex.: o agente n8n) — emite um NOTIFY no canal "pulse".
-- O servidor escuta-o e empurra o aviso aos painéis via SSE.
CREATE OR REPLACE FUNCTION pulse_notificar() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pulse',
    json_build_object('tabela', TG_TABLE_NAME, 'restaurante_id', COALESCE(NEW.restaurante_id, OLD.restaurante_id))::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS pedidos_notificar ON pedidos;
--> statement-breakpoint
CREATE TRIGGER pedidos_notificar
  AFTER INSERT OR UPDATE OR DELETE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pulse_notificar();
--> statement-breakpoint
DROP TRIGGER IF EXISTS itens_cardapio_notificar ON itens_cardapio;
--> statement-breakpoint
CREATE TRIGGER itens_cardapio_notificar
  AFTER INSERT OR UPDATE OR DELETE ON itens_cardapio
  FOR EACH ROW EXECUTE FUNCTION pulse_notificar();
--> statement-breakpoint
-- "Novo pedido" para o painel = pedido que chegou a 'confirmado' (pago), não o rascunho
-- que o agente vai montando durante a conversa. Funciona quer o pedido seja inserido já
-- confirmado, quer passe de rascunho/aguardando pagamento para confirmado (webhook MB WAY).
CREATE OR REPLACE FUNCTION pulse_registar_pedido_novo() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'confirmado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmado') THEN
    INSERT INTO eventos (restaurante_id, tipo, dados)
    VALUES (NEW.restaurante_id, 'pedido.novo', json_build_object('pedido_id', NEW.id, 'valor_total', NEW.valor_total));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS pedidos_registar_novo ON pedidos;
--> statement-breakpoint
CREATE TRIGGER pedidos_registar_novo
  AFTER INSERT OR UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pulse_registar_pedido_novo();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pulse_tocar_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS pedidos_atualizado_em ON pedidos;
--> statement-breakpoint
CREATE TRIGGER pedidos_atualizado_em
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pulse_tocar_atualizado_em();
