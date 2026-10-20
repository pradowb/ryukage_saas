import { useEffect, useState } from "react";
import type { Sessao } from "../../shared/types";
import { api, setUnauthorizedHandler } from "./lib/api";
import { toast } from "./lib/toast";
import { useTheme } from "./hooks/useTheme";
import { LoginView } from "./views/LoginView";
import { Painel } from "./views/Painel";

type Estado = { fase: "a-verificar" } | { fase: "anonimo" } | { fase: "autenticado"; sessao: Sessao };

export function App() {
  const [estado, setEstado] = useState<Estado>({ fase: "a-verificar" });
  useTheme(); // aplica o tema guardado também no ecrã de login

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setEstado((e) => {
        if (e.fase === "autenticado") toast("A sessão expirou. Entre de novo.");
        return { fase: "anonimo" };
      });
    });
    api
      .sessao()
      .then((sessao) => setEstado({ fase: "autenticado", sessao }))
      .catch(() => setEstado({ fase: "anonimo" }));
  }, []);

  if (estado.fase === "a-verificar") return null;
  if (estado.fase === "anonimo") {
    return <LoginView onLogin={(sessao) => setEstado({ fase: "autenticado", sessao })} />;
  }
  return <Painel sessao={estado.sessao} onLogout={() => setEstado({ fase: "anonimo" })} />;
}
