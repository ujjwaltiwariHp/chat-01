import pg from 'pg';
import { logger } from '../logging/logger.js';

const { Pool } = pg;

export interface PoolConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Standardized DB Pool Generator for Monorepo Logic
 * Standardizes logging, connection monitoring, and pool metrics.
 */
export function createBasePool(config: PoolConfig) {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
  });

  const poolLogger = logger.child({ ns: 'core:db:pool' });

  pool.on('error', (err: Error) => {
    poolLogger.error({ 
      msg: 'Database pool unexpected error', 
      error: err.message 
    }, 'DB_POOL_ERROR');
  });

  pool.on('connect', () => {
    poolLogger.debug('New database client connected to pool');
  });

  return pool;
}

/**
 * Standardized DB Connection Health Check Logic
 */
export async function testBaseConnection(dbInterface: { execute: (sql: string) => Promise<any> }) {
  try {
    const start = Date.now();
    await dbInterface.execute('SELECT 1');
    const durationMs = Date.now() - start;
    
    logger.child({ ns: 'core:db:health' }).info({ 
      msg: 'Postgres health check SUCCESS', 
      durationMs 
    }, 'db.health.success');
    return true;
  } catch (error: any) {
    logger.child({ ns: 'core:db:health' }).fatal({ 
      msg: 'Postgres health check FAILED', 
      error: error.message 
    }, 'db.health.failed');
    return false;
  }
}
