import type { StatusPedido } from "../../../shared/types";

export type PulseTone = "red" | "yellow" | "green" | "blue";

export interface Coluna {
  key: StatusPedido;
  label: string;
  tone: PulseTone;
  next?: { label: string; status: StatusPedido; act: PulseTone };
}

export const COLUMNS: Coluna[] = [
  {
    key: "confirmado",
    label: "Confirmado",
    tone: "red",
    next: { label: "Marcar em preparo", status: "em_preparo", act: "yellow" },
  },
  {
    key: "em_preparo",
    label: "Em preparo",
    tone: "yellow",
    next: { label: "Marcar pronto", status: "pronto", act: "green" },
  },
  {
    key: "pronto",
    label: "Pronto",
    tone: "green",
    next: { label: "Marcar entregue", status: "entregue", act: "blue" },
  },
  { key: "entregue", label: "Entregue", tone: "blue" },
];

/** Formas decorativas dos sparklines dos KPIs que ainda não têm série histórica própria. */
export const SPARK = {
  faturacao: [0.3, 0.25, 0.45, 0.35, 0.55, 0.5, 0.8],
  ticket: [0.4, 0.42, 0.48, 0.5, 0.55, 0.6, 0.7],
  tempo: [0.3, 0.35, 0.3, 0.45, 0.5, 0.6, 0.75],
  semana: [0.3, 0.4, 0.35, 0.5, 0.6, 0.7, 0.8],
  cresc: [0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.65],
};
