import { aiBillingEvents, createBasePool, drizzle, tenants, testBaseConnection } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import * as localSchema from '@/db/schema.js';

const schema = { tenants, aiBillingEvents, ...localSchema };

export const pool = createBasePool({
  connectionString: config.DATABASE_URL || '',
  max: config.DB_MAX_CONNECTIONS,
});

export const db = drizzle(pool, { schema }) as any;

export const testConnection = () => testBaseConnection({
  execute: (statement: string) => db.execute(statement)
});
