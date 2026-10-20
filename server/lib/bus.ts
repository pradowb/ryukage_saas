import { EventEmitter } from "node:events";

export type Topico = "pedidos" | "cardapio";

/**
 * Barramento em memória que liga o LISTEN/NOTIFY do Postgres às ligações SSE abertas.
 * Cada restaurante só recebe avisos dos seus próprios dados.
 */
export class Bus {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  publish(restauranteId: number, topico: Topico) {
    this.emitter.emit(String(restauranteId), topico);
  }

  subscribe(restauranteId: number, fn: (topico: Topico) => void): () => void {
    const key = String(restauranteId);
    this.emitter.on(key, fn);
    return () => this.emitter.off(key, fn);
  }
}

const TABELAS: Record<string, Topico> = { pedidos: "pedidos", itens_cardapio: "cardapio" };

export function parseNotificacao(payload: string): { restauranteId: number; topico: Topico } | null {
  try {
    const data = JSON.parse(payload) as { tabela?: string; restaurante_id?: number };
    const topico = data.tabela ? TABELAS[data.tabela] : undefined;
    if (!topico || typeof data.restaurante_id !== "number") return null;
    return { restauranteId: data.restaurante_id, topico };
  } catch {
    return null;
  }
}
