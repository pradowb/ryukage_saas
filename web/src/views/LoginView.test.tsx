import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginView } from "./LoginView";

afterEach(() => vi.restoreAllMocks());

function preencherESubmeter() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.pt" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginView", () => {
  it("mostra erro com credenciais inválidas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, erro: "x" }), { status: 401 }),
    );
    render(<LoginView onLogin={vi.fn()} />);
    preencherESubmeter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou senha incorretos.");
  });

  it("avisa quando há demasiadas tentativas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 429 }));
    render(<LoginView onLogin={vi.fn()} />);
    preencherESubmeter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiadas tentativas");
  });

  it("entrega a sessão ao entrar com sucesso", async () => {
    const sessao = {
      usuario: { id: 1, nome: "A", email: "a@b.pt", papel: "dono" },
      restaurante: { id: 1, nome: "R", cidade: "" },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(sessao), { status: 200 }));
    const onLogin = vi.fn();
    render(<LoginView onLogin={onLogin} />);
    preencherESubmeter();
    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledWith(sessao));
  });
});
