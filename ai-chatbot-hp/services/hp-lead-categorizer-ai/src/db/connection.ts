import { AsyncLocalStorage } from 'node:async_hooks';
import { aiBillingEvents, createBasePool, drizzle, tenants, testBaseConnection, users } from '@hp-intelligence/core';
import { config } from '@/config.js';
import {
  icpProfiles,
  leadActivities,
  leadAnalyses,
  leadEmailDrafts,
  leads,
  leadServiceSettings,
  leadIntelligenceUsageEvents,
  routingRules,
  webhookConfigs,
} from './schema.js';

const schema = {
  tenants,
  users,
  aiBillingEvents,
  icpProfiles,
  leads,
  leadAnalyses,
  leadEmailDrafts,
  leadActivities,
  leadIntelligenceUsageEvents,
  routingRules,
  webhookConfigs,
  leadServiceSettings,
};

export const dbContext = new AsyncLocalStorage<any>();

export const pool = createBasePool({
  connectionString: config.DATABASE_URL || '',
  max: config.DB_MAX_CONNECTIONS,
});

const baseDb = drizzle(pool, { schema }) as any;

// G2 Proxy: Automatically uses request-scoped connection if available in AsyncLocalStorage
export const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const context = dbContext.getStore();
    return Reflect.get(context || target, prop, receiver);
  }
});

export const testConnection = () => testBaseConnection({
  execute: (statement: string) => db.execute(statement),
});
