import type { Knex } from "knex";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Gateway DB Configuration (Owner of the 'tenants' Identity Table)
 */
const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST || "postgres",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "hp_intelligence",
    },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      tableName: "gateway_migrations",
    },
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      tableName: "gateway_migrations",
    },
  },
};

export default config;
