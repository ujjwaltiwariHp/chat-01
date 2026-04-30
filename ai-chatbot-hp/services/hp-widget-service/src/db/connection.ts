import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '@/config.js';
import { logger } from '@hp-intelligence/core';
import * as schema from '@/db/schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const db = drizzle(pool, { schema });


// Test connection
export async function testConnection() {
  try {
    const result = await db.execute('SELECT 1');
    return result.rowCount === 1;
  } catch (error: any) {
    logger.error({ 
      msg: 'Database connection failed', 
      error: error.message 
    }, 'db.connect.error');
    return false;
  }
}
