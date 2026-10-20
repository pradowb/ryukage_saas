import { useCallback, useRef, useState } from "react";
import type { Sessao, StatusPedido } from "../../../shared/types";
import { api, ApiError } from "../lib/api";
import { SPARK } from "../lib/constants";
import { descreverEvento, fmtDelta, minutesSince, money, sparkFromDias, timeAgo } from "../lib/format";
import { toast } from "../lib/toast";
import { usePulseData } from "../hooks/usePulseData";
import { useClickOutside } from "../hooks/useClickOutside";
import { useTheme } from "../hooks/useTheme";
import {
  IconBell,
  IconBook,
  IconChart,
  IconChevronDown,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconStore,
  IconSun,
  type IconComponent,
} from "../components/Icons";
import { GlassCard, KpiCard } from "../components/ui";
import { KanbanBoard } from "../components/KanbanBoard";
import { CardapioTable } from "../components/Cardapio";
import { BarChart, TopItems } from "../components/Charts";

type ViewKey = "pedidos" | "cardapio" | "relatorios" | "definicoes";

const NAV: { key: ViewKey; label: string; icon: IconComponent; sub: string }[] = [
  {
    key: "pedidos",
    label: "Pedidos",
    icon: IconReceipt,
    sub: "Acompanhe o fluxo de pedidos em tempo real, do pagamento à entrega.",
  },
  {
    key: "cardapio",
    label: "Cardápio",
    icon: IconBook,
    sub: "Edite itens, preços e disponibilidade — o agente usa isto ao atender.",
  },
  { key: "relatorios", label: "Relatórios", icon: IconChart, sub: "O desempenho do seu negócio, resumido." },
  {
    key: "definicoes",
    label: "Definições",
    icon: IconSettings,
    sub: "Configure como o Ryukage Pulse representa o seu negócio.",
  },
];

const VISTO_KEY = "ryukage-pulse-notif-visto";
const lerVisto = () => {
  try {
    return Number(localStorage.getItem(VISTO_KEY)) || 0;
  } catch {
    return 0;
  }
};

export function Painel({ sessao, onLogout }: { sessao: Sessao; onLogout: () => void }) {
  const [active, setActive] = useState<ViewKey>("pedidos");
  const [dark, setDark] = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visto, setVisto] = useState(lerVisto);
  const { pedidos, menu, setMenu, relatorios, eventos, online, setOnline, loadPedidos, loadCardapio } =
    usePulseData();
  const notifRef = useRef<HTMLDivElement>(null),
    profileRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    notifRef,
    useCallback(() => setNotifOpen(false), []),
  );
  useClickOutside(
    profileRef,
    useCallback(() => setProfileOpen(false), []),
  );

  const podeCriar = sessao.usuario.papel === "dono";
  const naoLidas = eventos.length > 0 && eventos[0]!.id > visto;

  function abrirNotificacoes() {
    setNotifOpen((o) => !o);
    if (eventos[0]) {
      setVisto(eventos[0].id);
      try {
        localStorage.setItem(VISTO_KEY, String(eventos[0].id));
      } catch {
        /* ignorar */
      }
    }
  }

  async function avancarStatus(id: number, novo_status: StatusPedido) {
    try {
      await api.avancarStatus(id, novo_status);
      await loadPedidos();
      setOnline(true);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 422)) {
        toast(err.message);
        await loadPedidos().catch(() => {});
        return;
      }
      setOnline(false);
      toast("Não foi possível avançar o pedido.");
    }
  }

  async function toggleDisponivel(id: number, disponivel: boolean) {
    const prev = menu;
    setMenu((list) => list.map((m) => (m.id === id ? { ...m, disponivel } : m)));
    try {
      await api.alterarItem(id, { disponivel });
    } catch {
      setMenu(prev);
      toast("Não foi possível gravar a disponibilidade.");
    }
  }

  async function sair() {
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  }

  const view = NAV.find((n) => n.key === active)!;
  const hoje = relatorios?.hoje;
  const deltas = relatorios?.kpi_deltas;
  const emCurso = pedidos.filter((p) => p.status === "em_preparo" || p.status === "pronto");
  const tempo = emCurso.length
    ? Math.round(emCurso.reduce((sum, p) => sum + minutesSince(p.criado_em), 0) / emCurso.length)
    : 0;
  const sparkDias = sparkFromDias(relatorios?.pedidos_por_dia, SPARK.semana);
  const cresc = Number(relatorios?.crescimento_pct);
  const crescLabel = Number.isFinite(cresc) ? (cresc > 0 ? "+" : "") + cresc.toFixed(1) + "%" : "0,0%";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div className={"nav-backdrop" + (navOpen ? " show" : "")} onClick={() => setNavOpen(false)} />
      <aside
        className={"sidebar-desktop" + (navOpen ? " nav-open" : "")}
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 32px" }}>
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
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ key, label, icon: I }) => (
            <button
              key={key}
              aria-current={active === key ? "page" : undefined}
              onClick={() => {
                setActive(key);
                setNavOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid transparent",
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: 500,
                textAlign: "left",
                background: active === key ? "var(--accent-tint)" : "transparent",
                color: active === key ? "var(--accent-strong)" : "var(--muted)",
              }}
            >
              <I size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: "9px 11px",
              borderRadius: 10,
              background: "var(--glass)",
              border: "1px solid var(--border)",
              fontSize: 12.5,
            }}
          >
            <div style={{ fontWeight: 600 }}>{sessao.restaurante.nome}</div>
            <div style={{ color: "var(--muted-2)", fontSize: 11 }}>{sessao.restaurante.cidade}</div>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted-2)" }}
          >
            <span
              className={"pulse-dot" + (online ? "" : " off")}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: online ? "var(--success)" : "var(--pulse-red)",
              }}
            />
            {online ? "Sistema operacional" : "Sem ligação"}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 26px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "color-mix(in srgb, var(--bg) 88%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              className="hamburger-btn"
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Abrir navegação"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: "1px solid var(--border-strong)",
                background: "var(--glass)",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text)",
                flex: "none",
              }}
            >
              <IconMenu size={16} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 19 }}>{view.label}</h1>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{view.sub}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {active === "pedidos" && (
              <div className="topbar-search" style={{ position: "relative" }}>
                <IconSearch
                  size={14}
                  style={{ position: "absolute", left: 10, top: 10, color: "var(--muted-2)" }}
                />
                <input
                  id="topbar-search"
                  aria-label="Procurar pedido ou item"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Procurar pedido ou item…"
                  style={{
                    padding: "8px 10px 8px 30px",
                    fontSize: 12.5,
                    borderRadius: 9,
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    width: 200,
                    outline: "none",
                  }}
                />
              </div>
            )}
            <button
              onClick={() => setDark((d) => !d)}
              aria-label="Alternar tema"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: "1px solid var(--border-strong)",
                background: "var(--glass)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text)",
              }}
            >
              {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>

            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={abrirNotificacoes}
                aria-label="Notificações"
                aria-expanded={notifOpen}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid var(--border-strong)",
                  background: "var(--glass)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  position: "relative",
                  color: "var(--text)",
                }}
              >
                <IconBell size={16} />
                {naoLidas && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 7,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                )}
              </button>
              {notifOpen && (
                <div
                  className="rise"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 42,
                    width: 300,
                    background: "var(--glass-strong)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 14,
                    boxShadow: "var(--shadow)",
                    padding: 8,
                    zIndex: 20,
                  }}
                >
                  {eventos.length === 0 && (
                    <div style={{ padding: 10, fontSize: 12.5, color: "var(--muted-2)" }}>
                      Sem notificações.
                    </div>
                  )}
                  {eventos.slice(0, 6).map((e) => {
                    const n = descreverEvento(e);
                    return (
                      <div key={e.id} style={{ display: "flex", gap: 9, padding: 10 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            marginTop: 5,
                            flex: "none",
                            background: `var(--${n.tone})`,
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{n.titulo}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{n.corpo}</div>
                          <div
                            className="mono"
                            style={{ fontSize: 10.5, color: "var(--muted-2)", marginTop: 3 }}
                          >
                            {timeAgo(e.criado_em)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={profileRef} style={{ position: "relative" }}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px 4px 4px",
                  borderRadius: 999,
                  border: "1px solid var(--border-strong)",
                  background: "var(--glass)",
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "linear-gradient(155deg, var(--accent-strong), var(--gold))",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconStore size={14} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{sessao.restaurante.nome}</span>
                <IconChevronDown size={13} />
              </button>
              {profileOpen && (
                <div
                  className="rise"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 42,
                    width: 190,
                    background: "var(--glass-strong)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 14,
                    boxShadow: "var(--shadow)",
                    padding: 6,
                    zIndex: 20,
                    fontSize: 13,
                  }}
                >
                  <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--muted)" }}>
                    {sessao.usuario.nome} · {sessao.usuario.email}
                  </div>
                  <button
                    onClick={() => {
                      setActive("definicoes");
                      setProfileOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text)",
                      borderRadius: 8,
                      textAlign: "left",
                    }}
                  >
                    <IconSettings size={14} />
                    Definições
                  </button>
                  <button
                    onClick={sair}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text)",
                      borderRadius: 8,
                      textAlign: "left",
                    }}
                  >
                    <IconLogOut size={14} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div
          style={{
            padding: "24px 26px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -40,
              left: "6%",
              width: 340,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, var(--accent) 0%, transparent 70%)",
              opacity: 0.1,
              filter: "blur(30px)",
              pointerEvents: "none",
            }}
          />

          {active === "pedidos" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 1 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <KpiCard
                  index={0}
                  label="Pedidos hoje"
                  value={String(hoje?.pedidos ?? 0)}
                  delta={fmtDelta(deltas?.pedidos_pct, "%")}
                  spark={sparkDias}
                />
                <KpiCard
                  index={1}
                  label="Faturação hoje"
                  value={money(hoje?.faturacao)}
                  delta={fmtDelta(deltas?.faturacao_pct, "%")}
                  spark={SPARK.faturacao}
                />
                <KpiCard
                  index={2}
                  label="Ticket médio"
                  value={money(hoje?.ticket_medio)}
                  delta={fmtDelta(deltas?.ticket_pct, "%")}
                  spark={SPARK.ticket}
                />
                <KpiCard index={3} label="Tempo médio" value={tempo + " min"} delta="" spark={SPARK.tempo} />
              </div>
              <KanbanBoard query={search} pedidos={pedidos} onAdvance={avancarStatus} />
            </div>
          )}

          {active === "cardapio" && (
            <div style={{ position: "relative", zIndex: 1 }}>
              <CardapioTable
                items={menu}
                podeCriar={podeCriar}
                onToggle={toggleDisponivel}
                onRefresh={loadCardapio}
              />
            </div>
          )}

          {active === "relatorios" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <KpiCard
                  index={0}
                  label="Pedidos esta semana"
                  value={String(relatorios?.pedidos_semana || 0)}
                  delta=""
                  spark={sparkDias}
                />
                <KpiCard
                  index={1}
                  label="Crescimento semanal"
                  value={crescLabel}
                  delta=""
                  spark={SPARK.cresc}
                />
                <GlassCard style={{ padding: 16 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Item mais vendido</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8, fontFamily: "Lora,serif" }}>
                    {relatorios?.item_mais_vendido || "—"}
                  </div>
                </GlassCard>
              </div>
              <div
                className="chart-grid"
                style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}
              >
                <GlassCard style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                    Pedidos por dia — últimos 7 dias
                  </h3>
                  <BarChart dias={relatorios?.pedidos_por_dia} />
                </GlassCard>
                <GlassCard style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Itens mais vendidos</h3>
                  <TopItems itens={relatorios?.top_itens} />
                </GlassCard>
              </div>
            </div>
          )}

          {active === "definicoes" && (
            <GlassCard style={{ padding: 20, position: "relative", zIndex: 1, maxWidth: 560 }}>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>Definições do negócio</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                Aqui ficam o nome do negócio, horário de funcionamento, tom de voz do agente e a ligação ao
                número de WhatsApp — tudo o que o agente de IA usa para atender em seu nome. Esta secção é uma
                pré-visualização do que está por vir.
              </p>
            </GlassCard>
          )}
        </div>
      </main>
    </div>
  );
}
