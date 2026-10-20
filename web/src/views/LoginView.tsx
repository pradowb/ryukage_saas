import { useState, type FormEvent } from "react";
import type { Sessao } from "../../../shared/types";
import { api, ApiError } from "../lib/api";
import { GlassCard } from "../components/ui";

export function LoginView({ onLogin }: { onLogin: (s: Sessao) => void }) {
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setErro("");
    try {
      onLogin(await api.login(String(fd.get("email")), String(fd.get("senha"))));
    } catch (err) {
      setErro(
        err instanceof ApiError && err.status === 429
          ? "Demasiadas tentativas. Aguarde alguns minutos."
          : err instanceof ApiError && err.status === 401
            ? "Email ou senha incorretos."
            : "Não foi possível entrar. Tente de novo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <GlassCard className="modal-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "linear-gradient(155deg, var(--accent-strong), var(--accent) 60%, var(--muted-2))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#faf1e9",
              fontFamily: "Lora,serif",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            R
          </div>
          <div>
            <div style={{ fontFamily: "Lora,serif", fontSize: 15.5 }}>Ryukage</div>
            <div style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--gold)", fontWeight: 600 }}>
              PULSE
            </div>
          </div>
        </div>
        <h1 style={{ fontSize: 19 }}>Entrar</h1>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          Aceda ao painel do seu negócio.
        </div>
        <form onSubmit={submit}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="username" required autoFocus />
          <label htmlFor="login-senha">Senha</label>
          <input id="login-senha" name="senha" type="password" autoComplete="current-password" required />
          {erro && (
            <div role="alert" style={{ fontSize: 12.5, color: "var(--pulse-red)", marginTop: 12 }}>
              {erro}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                color: "#fbeee7",
                cursor: "pointer",
                background: "linear-gradient(155deg, var(--accent-strong), var(--accent))",
              }}
            >
              {loading ? "A entrar…" : "Entrar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
