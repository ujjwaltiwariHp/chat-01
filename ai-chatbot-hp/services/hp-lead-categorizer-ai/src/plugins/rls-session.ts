import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { pool, db, dbContext } from '@/db/connection.js';
import { drizzle } from 'drizzle-orm/node-postgres';

declare module 'fastify' {
  interface FastifyRequest {
    db: typeof db;
    connection: any;
  }
}

const rlsSessionModule: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request) => {
    // Acquire a dedicated connection from the pool for THIS request
    const conn = await pool.connect();
    request.connection = conn;

    // Create a request-scoped Drizzle instance
    const requestDb = drizzle(conn, { schema: (db as any)._.fullSchema });
    request.db = requestDb as any;

    if (request.tenantId) {
      // SET session variable on the dedicated connection.
      await conn.query(`SET app.current_tenant = '${request.tenantId}'`);
    } else {
      await conn.query(`SET app.current_tenant = ''`);
    }

    // Set the AsyncLocalStorage context for transparent DB access in services
    dbContext.enterWith(request.db);
  });

  fastify.addHook('onResponse', async (request) => {
    if (request.connection) {
      try {
        // Clear session variable
        await request.connection.query(`SET app.current_tenant = ''`);
      } finally {
        request.connection.release();
      }
    }
  });

  fastify.addHook('onError', async (request) => {
    if (request.connection) {
      try {
        await request.connection.query(`SET app.current_tenant = ''`);
      } finally {
        request.connection.release();
      }
    }
  });
};

export const rlsSessionPlugin = fp(rlsSessionModule);
export default rlsSessionPlugin;
