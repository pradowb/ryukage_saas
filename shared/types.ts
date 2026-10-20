// Contratos partilhados entre a API (server/) e o painel (web/).

export const STATUS_PEDIDO = ["confirmado", "em_preparo", "pronto", "entregue"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Transições permitidas: cada pedido só avança um passo de cada vez. */
export const PROXIMO_STATUS: Record<StatusPedido, StatusPedido | null> = {
  confirmado: "em_preparo",
  em_preparo: "pronto",
  pronto: "entregue",
  entregue: null,
};

export const TIPOS_ENTREGA = ["entrega", "retirada"] as const;
export type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

export const PAPEIS = ["dono", "equipe"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface ItemPedido {
  nome: string;
  qtd: number;
  preco: number;
}

export interface Pedido {
  id: number;
  itens: ItemPedido[];
  valor_total: number;
  endereco: string;
  tipo_entrega: TipoEntrega;
  status: StatusPedido;
  criado_em: string;
}

export interface ItemCardapio {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  disponivel: boolean;
}

export interface NovoItemCardapio {
  nome: string;
  descricao?: string;
  preco: number;
  categoria: string;
}

export interface Relatorios {
  pedidos_semana: number;
  crescimento_pct: number;
  item_mais_vendido: string | null;
  pedidos_por_dia: { dia: string; valor: number }[];
  top_itens: { nome: string; pct: number }[];
  hoje: { pedidos: number; faturacao: number; ticket_medio: number };
  kpi_deltas: { pedidos_pct: number | null; faturacao_pct: number | null; ticket_pct: number | null };
}

export interface Sessao {
  usuario: { id: number; nome: string; email: string; papel: Papel };
  restaurante: { id: number; nome: string; cidade: string };
}

export type TipoEvento = "pedido.novo" | "pedido.status" | "cardapio.criado" | "cardapio.disponibilidade";

export interface Evento {
  id: number;
  tipo: TipoEvento;
  dados: Record<string, unknown>;
  usuario: string | null;
  criado_em: string;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ErroApi {
  ok: false;
  erro: string;
  detalhes?: unknown;
}
