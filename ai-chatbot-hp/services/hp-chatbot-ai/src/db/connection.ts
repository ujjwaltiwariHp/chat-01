import { drizzle } from 'drizzle-orm/node-postgres';
import { createBasePool, testBaseConnection } from '@hp-intelligence/core';
import { config } from '@config/index.js';
import * as schema from '@db/schema.js';

// Standardized DB Pool for Monorepo Logic
export const pool = createBasePool({
  connectionString: config.DATABASE_URL || '',
  max: config.DB_MAX_CONNECTIONS || 20,
});

export const db = drizzle(pool, { schema }) as any;

// Standardized DB Test logic
export const testConnection = () => testBaseConnection({
  execute: (sql: string) => db.execute(sql)
});
