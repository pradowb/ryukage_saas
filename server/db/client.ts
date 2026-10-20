import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema.js";

/**
 * As duas drivers expõem a mesma API do Drizzle; tipamos tudo como node-postgres
 * para que os serviços não tenham de saber qual está em uso.
 */
export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  db: Db;
  driver: "postgres" | "pglite";
  migrate(): Promise<void>;
  /** Subscreve um canal LISTEN/NOTIFY. Devolve a função para cancelar. */
  listen(channel: string, onPayload: (payload: string) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

// Funciona tanto a partir do código-fonte (server/db) como do build (dist/server/db).
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = [path.resolve(here, "../../drizzle"), path.resolve(here, "../../../drizzle")].find(
  (dir) => existsSync(path.join(dir, "meta", "_journal.json")),
) as string;

export interface DatabaseOptions {
  /** URL do Postgres. Sem ela usa PGlite (Postgres embutido) — só para dev e testes. */
  url?: string;
  /** Pasta do PGlite; `undefined` = em memória. */
  pgliteDir?: string;
  onError?: (err: unknown) => void;
}

export async function createDatabase(opts: DatabaseOptions): Promise<Database> {
  return opts.url ? createPostgres(opts.url, opts.onError) : createPglite(opts.pgliteDir);
}

async function createPostgres(url: string, onError?: (err: unknown) => void): Promise<Database> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on("error", (err) => onError?.(err));
  const db = drizzlePg(pool, { schema });
  const listeners = new Set<pg.Client>();

  return {
    db,
    driver: "postgres",
    migrate: () => migratePg(db, { migrationsFolder }),
    async listen(channel, onPayload) {
      let client: pg.Client | null = null;
      let stopped = false;
      let retry: NodeJS.Timeout | undefined;

      // Ligação dedicada para LISTEN, com reconexão automática se cair.
      const connect = async () => {
        const c = new pg.Client({ connectionString: url });
        c.on("notification", (msg) => {
          if (msg.channel === channel && msg.payload) onPayload(msg.payload);
        });
        c.on("error", (err) => {
          onError?.(err);
          listeners.delete(c);
          c.end().catch(() => {});
          if (!stopped) retry = setTimeout(() => void connect().catch(onError), 2000);
        });
        await c.connect();
        await c.query(`LISTEN ${pg.escapeIdentifier(channel)}`);
        client = c;
        listeners.add(c);
      };
      await connect();

      return async () => {
        stopped = true;
        clearTimeout(retry);
        if (client) {
          listeners.delete(client);
          await client.end().catch(() => {});
        }
      };
    },
    async close() {
      await Promise.all([...listeners].map((c) => c.end().catch(() => {})));
      await pool.end();
    },
  };
}

async function createPglite(dir?: string): Promise<Database> {
  if (dir) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return {
    db,
    driver: "pglite",
    migrate: () => migratePglite(db as never, { migrationsFolder }),
    async listen(channel, onPayload) {
      return client.listen(channel, onPayload);
    },
    close: () => client.close(),
  };
}
