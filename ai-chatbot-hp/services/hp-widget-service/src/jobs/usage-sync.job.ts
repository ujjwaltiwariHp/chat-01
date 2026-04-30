import { db } from '@/db/connection.js';
import { widgetCustomers } from '@/db/schema.js';
import { eq, lt } from 'drizzle-orm';
import { redis, logger } from '@hp-intelligence/core';

let syncInterval: NodeJS.Timeout | null = null;
let billingInterval: NodeJS.Timeout | null = null;

/**
 * Periodically scans Redis usage keys so we can observe quota state while
 * keeping usage accounting Redis-first until a dedicated reporting schema exists.
 */
export async function syncUsageToDb() {
  const lockKey = 'lock:job:usage-sync';
  const lockTimeout = 60; // 1 minute

  // 1. Distributed Lock
  const locked = await redis.set(lockKey, 'locked', 'EX', lockTimeout, 'NX');
  if (!locked) {
    logger.debug({ ns: 'jobs:usage-sync' }, 'Job already running or locked');
    return;
  }

  try {
    logger.debug({ ns: 'jobs:usage-sync' }, 'Starting usage sync job');
    
    let cursor = '0';
    let totalSynced = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'widget:usage:*', 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        for (const key of keys) {
          const usageStr = await redis.get(key);
          const usage = usageStr ? parseInt(usageStr, 10) : 0;

          totalSynced += usage;
        }
      }
    } while (cursor !== '0');

    logger.info({ ns: 'jobs:usage-sync', totalUsage: totalSynced }, 'Usage scan cycle complete');
  } catch (err: any) {
    logger.error({ ns: 'jobs:usage-sync', error: err.message }, 'Usage sync failed');
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Detects customers whose billing cycle has expired, resets their counters, 
 * and schedules the next reset date.
 */
export async function handleBillingResets() {
  const lockKey = 'lock:job:billing-reset';
  const lockTimeout = 300; // 5 minutes

  const locked = await redis.set(lockKey, 'locked', 'EX', lockTimeout, 'NX');
  if (!locked) return;

  try {
    logger.debug({ ns: 'jobs:billing-reset' }, 'Checking for billing cycle resets');
    const now = new Date();

    const expiredCustomers = await db.select()
      .from(widgetCustomers)
      .where(lt(widgetCustomers.resetDate, now));

    for (const customer of expiredCustomers) {
      const customerId = customer.id;
      const nextReset = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await redis.del(`widget:usage:${customerId}`);
      await redis.del(`widget:sessions:${customerId}`);

      await db.update(widgetCustomers)
        .set({ 
          resetDate: nextReset 
        })
        .where(eq(widgetCustomers.id, customerId));

      logger.info({ ns: 'jobs:billing-reset', customerId }, 'Billing cycle reset successful');
    }
  } catch (err: any) {
    logger.error({ ns: 'jobs:billing-reset', error: err.message }, 'Billing reset job failed');
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Job Scheduler
 */
export function startUsageJobs() {
  if (syncInterval) clearInterval(syncInterval);
  if (billingInterval) clearInterval(billingInterval);

  syncInterval = setInterval(syncUsageToDb, 5 * 60 * 1000);
  billingInterval = setInterval(handleBillingResets, 60 * 60 * 1000);

  logger.info('Background usage jobs initialized');
}

/**
 * Cleanup
 */
export function stopUsageJobs() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (billingInterval) {
    clearInterval(billingInterval);
    billingInterval = null;
  }
  logger.info('Background usage jobs stopped');
}
