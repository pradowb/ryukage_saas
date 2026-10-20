import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { ItemCardapio } from "../../../shared/types";
import { api, ApiError } from "../lib/api";
import { money } from "../lib/format";
import { toast } from "../lib/toast";
import { IconSearch } from "./Icons";
import { GlassCard } from "./ui";

export function NovoItemModal({
  open,
  categorias,
  onClose,
  onCreated,
}: {
  open: boolean;
  categorias: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const cats = categorias.length ? categorias : ["Pizzas", "Bebidas", "Extras"];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    try {
      await api.criarItem({
        nome: String(fd.get("nome")),
        descricao: String(fd.get("descricao") ?? ""),
        preco: Number(fd.get("preco")),
        categoria: String(fd.get("categoria")),
      });
      onClose();
      form.reset();
      await onCreated();
      toast("Item criado.");
    } catch (err) {
      toast(
        err instanceof ApiError && err.status === 403
          ? "Só o dono pode criar itens."
          : "Não foi possível criar o item.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="modal-back"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassCard className="modal-card">
        <h3 style={{ fontSize: 16 }}>Novo item</h3>
        <form onSubmit={submit}>
          <label htmlFor="novo-nome">Nome</label>
          <input id="novo-nome" name="nome" required maxLength={120} />
          <label htmlFor="novo-descricao">Descrição</label>
          <textarea id="novo-descricao" name="descricao" maxLength={500} />
          <label htmlFor="novo-preco">Preço (€)</label>
          <input id="novo-preco" name="preco" type="number" min="0" step="0.01" required />
          <label htmlFor="novo-categoria">Categoria</label>
          <select id="novo-categoria" name="categoria">
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                border: "1px solid var(--border-strong)",
                background: "var(--bg)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 14px",
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 500,
                border: "none",
                color: "#fbeee7",
                cursor: "pointer",
                background: "linear-gradient(155deg, var(--accent-strong), var(--accent))",
              }}
            >
              {saving ? "A gravar…" : "Criar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

type SortKey = "nome" | "categoria" | "preco";

export function CardapioTable({
  items,
  podeCriar,
  onToggle,
  onRefresh,
}: {
  items: ItemCardapio[];
  podeCriar: boolean;
  onToggle: (id: number, disponivel: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "nome", dir: "asc" });
  const [novoOpen, setNovoOpen] = useState(false);

  const categorias = useMemo(
    () => Array.from(new Set(items.map((m) => m.categoria).filter(Boolean))),
    [items],
  );
  const cats = ["Todas", ...categorias];

  const rows = useMemo(() => {
    const r = items.filter(
      (m) =>
        (cat === "Todas" || m.categoria === cat) &&
        String(m.nome || "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    );
    r.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = a[sort.key],
        bv = b[sort.key];
      if (av > bv) return dir;
      if (av < bv) return -dir;
      return 0;
    });
    return r;
  }, [items, q, cat, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const th = (k: SortKey, children: ReactNode, align?: "right") => (
    <th
      onClick={() => toggleSort(k)}
      aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      style={{
        textAlign: align || "left",
        padding: "10px 14px",
        fontSize: 11,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--muted)",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children} {sort.key === k && (sort.dir === "asc" ? "↑" : "↓")}
    </th>
  );

  return (
    <>
      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Cardápio</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <IconSearch
                size={14}
                style={{ position: "absolute", left: 10, top: 9, color: "var(--muted-2)" }}
              />
              <input
                id="menu-search"
                aria-label="Procurar item"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar item…"
                style={{
                  padding: "7px 10px 7px 30px",
                  fontSize: 12.5,
                  borderRadius: 9,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  width: 180,
                  outline: "none",
                }}
              />
            </div>
            <select
              id="menu-cat"
              aria-label="Categoria"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              style={{
                padding: "7px 10px",
                fontSize: 12.5,
                borderRadius: 9,
                border: "1px solid var(--border-strong)",
                background: "var(--bg)",
                color: "var(--text)",
                outline: "none",
              }}
            >
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {podeCriar && (
              <button
                type="button"
                onClick={() => setNovoOpen(true)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 500,
                  border: "none",
                  color: "#fbeee7",
                  cursor: "pointer",
                  background: "linear-gradient(155deg, var(--accent-strong), var(--accent))",
                }}
              >
                + Novo item
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                {th("nome", "Item")}
                {th("categoria", "Categoria")}
                {th("preco", "Preço", "right")}
                <th
                  style={{
                    padding: "10px 14px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Disponível
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.nome}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 2 }}>
                      {m.descricao || ""}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--muted)" }}>
                    {m.categoria}
                  </td>
                  <td className="mono" style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600 }}>
                    {money(m.preco)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <label style={{ position: "relative", width: 38, height: 22, display: "inline-block" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(m.disponivel)}
                        onChange={() => onToggle(m.id, !m.disponivel)}
                        aria-label={`Disponibilidade de ${m.nome}`}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", margin: 0 }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 999,
                          background: m.disponivel ? "var(--success-tint)" : "var(--bg-2)",
                          border: `1px solid ${m.disponivel ? "var(--success)" : "var(--border-strong)"}`,
                          transition: "background .15s",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: m.disponivel ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: m.disponivel ? "var(--success)" : "var(--muted-2)",
                          transition: "left .15s",
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 20, fontSize: 13, color: "var(--muted-2)" }}>
                    Sem itens no cardápio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
      <NovoItemModal
        open={novoOpen}
        categorias={categorias}
        onClose={() => setNovoOpen(false)}
        onCreated={onRefresh}
      />
    </>
  );
}
