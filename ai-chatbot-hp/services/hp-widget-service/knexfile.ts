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
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      tableName: "widget_service_migrations",
    },
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      tableName: "widget_service_migrations",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;
