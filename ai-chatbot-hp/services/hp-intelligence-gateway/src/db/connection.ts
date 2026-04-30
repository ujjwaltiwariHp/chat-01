import { drizzle } from 'drizzle-orm/node-postgres';
import { createBasePool, testBaseConnection, tenants, users, magicLinkTokens } from '@hp-intelligence/core';
import { config } from '@/config.js';

// Namespace for Drizzle
const schema = { tenants, users, magicLinkTokens };

// Standardized DB Pool for Gateway Logic
export const pool = createBasePool({
  connectionString: config.DATABASE_URL || '',
  max: 20,
});

export const db = drizzle(pool, { schema }) as any;

// Standardized DB Test logic
export const testConnection = () => testBaseConnection({
  execute: (sql: string) => db.execute(sql)
});
