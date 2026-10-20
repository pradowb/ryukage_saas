import { useCallback, useEffect, useRef, useState } from "react";
import type { Evento, ItemCardapio, Pedido, Relatorios } from "../../../shared/types";
import { api } from "../lib/api";
import { toast } from "../lib/toast";

/** Rede de segurança caso o SSE caia sem o browser reparar (proxies que cortam ligações longas). */
const POLL_FALLBACK_MS = 30_000;
/** Agrupa rajadas de avisos (ex.: vários pedidos a mudar de uma vez) num só refetch. */
const DEBOUNCE_MS = 250;

export function usePulseData() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [menu, setMenu] = useState<ItemCardapio[]>([]);
  const [relatorios, setRelatorios] = useState<Relatorios | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [online, setOnline] = useState(true);
  const [, setTick] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadPedidos = useCallback(() => api.pedidos().then(setPedidos), []);
  const loadCardapio = useCallback(() => api.cardapio().then(setMenu), []);
  const loadRelatorios = useCallback(() => api.relatorios().then(setRelatorios), []);
  const loadEventos = useCallback(() => api.eventos().then(setEventos), []);

  useEffect(() => {
    let cancelled = false;
    const pending = timers.current;
    const guard = (p: Promise<unknown>) =>
      p.then(() => !cancelled && setOnline(true)).catch(() => !cancelled && setOnline(false));
    const debounced = (key: string, fn: () => Promise<unknown>) => {
      clearTimeout(pending[key]);
      pending[key] = setTimeout(() => void guard(fn()), DEBOUNCE_MS);
    };

    Promise.all([loadPedidos(), loadCardapio(), loadRelatorios(), loadEventos()])
      .then(() => !cancelled && setOnline(true))
      .catch(() => {
        if (cancelled) return;
        setOnline(false);
        toast("Sem ligação ao servidor.");
      });

    const es = new EventSource("/api/eventos/stream");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.addEventListener("pedidos", () => {
      debounced("pedidos", () => Promise.all([loadPedidos(), loadRelatorios(), loadEventos()]));
    });
    es.addEventListener("cardapio", () => {
      debounced("cardapio", () => Promise.all([loadCardapio(), loadEventos()]));
    });

    const poll = setInterval(() => void guard(loadPedidos()), POLL_FALLBACK_MS);
    const times = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      cancelled = true;
      es.close();
      clearInterval(poll);
      clearInterval(times);
      Object.values(pending).forEach(clearTimeout);
    };
  }, [loadPedidos, loadCardapio, loadRelatorios, loadEventos]);

  return { pedidos, menu, setMenu, relatorios, eventos, online, setOnline, loadPedidos, loadCardapio };
}
