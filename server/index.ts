import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { Bus, parseNotificacao } from "./lib/bus.js";

const config = loadConfig();

const logger =
  config.env === "development"
    ? { level: config.logLevel, transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } } }
    : { level: config.logLevel, redact: ["req.headers.cookie", 'res.headers["set-cookie"]'] };

const bus = new Bus();
const database = await createDatabase({
  url: config.databaseUrl,
  pgliteDir: config.pgliteDir,
  onError: (err) => app.log.error({ err }, "erro na ligação à base de dados"),
});

// Em dev (PGlite) migra automaticamente; com Postgres real use `npm run db:migrate`
// (ou o comando do contentor), para que alterações de schema sejam um passo explícito.
if (database.driver === "pglite") await database.migrate();

const app = await buildApp({ db: database.db, config, bus }, { logger });

const unlisten = await database.listen("pulse", (payload) => {
  const n = parseNotificacao(payload);
  if (n) bus.publish(n.restauranteId, n.topico);
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "a encerrar");
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await app.close();
    await unlisten();
    await database.close();
    clearTimeout(force);
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "erro ao encerrar");
    process.exit(1);
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.host, port: config.port });
if (database.driver === "pglite") {
  app.log.warn(`a usar PGlite em ${config.pgliteDir} — defina DATABASE_URL para usar Postgres`);
}
