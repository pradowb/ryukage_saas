import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Pedido } from "../../../shared/types";
import { KanbanBoard } from "./KanbanBoard";

const base: Omit<Pedido, "id" | "status"> = {
  itens: [{ nome: "Calabresa", qtd: 1, preco: 9 }],
  valor_total: 9,
  endereco: "",
  tipo_entrega: "retirada",
  criado_em: new Date().toISOString(),
};
const pedidos: Pedido[] = [
  { ...base, id: 1, status: "confirmado" },
  { ...base, id: 2, status: "pronto", endereco: "Rua A", tipo_entrega: "entrega" },
  { ...base, id: 3, status: "entregue", itens: [{ nome: "Pepperoni", qtd: 2, preco: 11 }] },
];

const coluna = (status: string) => document.querySelector(`[data-status="${status}"]`) as HTMLElement;

describe("KanbanBoard", () => {
  it("coloca cada pedido na sua coluna e conta os ativos", () => {
    render(<KanbanBoard query="" pedidos={pedidos} onAdvance={vi.fn()} />);
    expect(within(coluna("confirmado")).getByText("#1")).toBeInTheDocument();
    expect(within(coluna("pronto")).getByText("Rua A")).toBeInTheDocument();
    expect(within(coluna("em_preparo")).getByText("Sem pedidos aqui.")).toBeInTheDocument();
    expect(screen.getByText(/pedidos ativos/).textContent).toContain("2 pedidos ativos");
  });

  it("não mostra botão de ação nos entregues", () => {
    render(<KanbanBoard query="" pedidos={pedidos} onAdvance={vi.fn()} />);
    expect(within(coluna("entregue")).queryByRole("button")).toBeNull();
  });

  it("avança para o status seguinte ao clicar", () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<KanbanBoard query="" pedidos={pedidos} onAdvance={onAdvance} />);
    fireEvent.click(within(coluna("confirmado")).getByRole("button", { name: "Marcar em preparo" }));
    expect(onAdvance).toHaveBeenCalledWith(1, "em_preparo");
  });

  it("filtra pela pesquisa", () => {
    render(<KanbanBoard query="pepperoni" pedidos={pedidos} onAdvance={vi.fn()} />);
    expect(screen.queryByText("#1")).toBeNull();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });
});
