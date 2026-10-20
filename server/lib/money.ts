/** O Postgres devolve `numeric` como string; convertemos na fronteira da camada de dados. */
export const toNumber = (v: string | number | null | undefined): number => Number(v ?? 0);

/** Arredonda a 2 casas para evitar 0.1 + 0.2 = 0.30000000000000004 nos totais. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
