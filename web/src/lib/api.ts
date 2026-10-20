import type {
  Evento,
  ItemCardapio,
  NovoItemCardapio,
  Pedido,
  Relatorios,
  Sessao,
  StatusPedido,
} from "../../../shared/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Chamado sempre que a API responde 401 — a App volta ao ecrã de login. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && !url.endsWith("/auth/login")) onUnauthorized();
    throw new ApiError(res.status, data?.erro ?? `Erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  login: (email: string, senha: string) => request<Sessao>("POST", "/api/auth/login", { email, senha }),
  logout: () => request<void>("POST", "/api/auth/logout"),
  sessao: () => request<Sessao>("GET", "/api/auth/sessao"),

  pedidos: () => request<Pedido[]>("GET", "/api/pedidos"),
  avancarStatus: (id: number, novo_status: StatusPedido) =>
    request<Pedido>("PATCH", `/api/pedidos/${id}/status`, { novo_status }),

  cardapio: () => request<ItemCardapio[]>("GET", "/api/cardapio"),
  criarItem: (item: NovoItemCardapio) => request<ItemCardapio>("POST", "/api/cardapio", item),
  alterarItem: (id: number, dados: Partial<ItemCardapio>) =>
    request<ItemCardapio>("PATCH", `/api/cardapio/${id}`, dados),

  relatorios: () => request<Relatorios>("GET", "/api/relatorios"),
  eventos: () => request<Evento[]>("GET", "/api/eventos"),
};
