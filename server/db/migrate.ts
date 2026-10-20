import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

const config = loadConfig();
const database = await createDatabase({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
try {
  await database.migrate();
  console.log(`Migrações aplicadas (${database.driver}).`);
} finally {
  await database.close();
}
