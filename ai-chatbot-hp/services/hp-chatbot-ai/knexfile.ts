import type { Knex } from "knex";
import { config as dotenvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the monorepo root (absolute path is safer)
dotenvConfig({ path: path.resolve(__dirname, "../../.env") });

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
      tableName: "chatbot_migrations",
    },
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      tableName: "chatbot_migrations",
    },
    pool: { min: 2, max: 10 },
  },
};

export default config;
