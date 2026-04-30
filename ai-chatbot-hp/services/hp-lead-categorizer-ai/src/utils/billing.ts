import { db } from '@/db/connection.js';
import { leadServiceSettings } from '@/db/schema.js';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError as CoreApiError, getTenantCredits, redis } from '@hp-intelligence/core';
import { eq } from 'drizzle-orm';
import { LeadErrorMessages } from '@errors/error-messages.js';
import { config } from '@/config.js';
import { createLeadLogger } from '@/logging/logger.js';
import { ApiError } from '@/utils/api-error.js';
import { quotaExceededCounter, quotaSoftWarningCounter } from '@/utils/metrics.js';

const billingLogger = createLeadLogger('billing');

export interface DailyUsageUpdateResult {
  usage: number; // In cents
  limit: number; // In cents
  softWarningTriggered: boolean;
}

export async function checkDailyQuota(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const redisKey = `lead-intel:quota-cents:${tenantId}:${today}`;
  
  // 1. Check Redis Cache
  const cachedUsage = await redis.get(redisKey);
  if (cachedUsage) {
    const usage = parseInt(cachedUsage, 10);
    
    // Get limit from settings (cached or DB)
    const [settings] = await db.select().from(leadServiceSettings).where(eq(leadServiceSettings.tenantId, tenantId)).limit(1);
    const limit = settings?.costLimitDailyCents || 1000; // Default 1000 cents ($10)

    if (usage >= limit) {
      quotaExceededCounter.inc({ tenant_id: tenantId });
      throw new ApiError(
        'USAGE_QUOTA_EXCEEDED',
        LeadErrorMessages.billing.dailyQuotaReached,
        [],
        { tenantId, usage, limit },
      );
    }
  }
}

export async function incrementDailyUsage(tenantId: string, costUsd: number): Promise<DailyUsageUpdateResult | null> {
  const today = new Date().toISOString().slice(0, 10);
  const redisKey = `lead-intel:quota-cents:${tenantId}:${today}`;
  const costCents = Math.ceil(costUsd * 100);

  try {
    const newUsage = await redis.incrby(redisKey, costCents);
    // Set expiry to 48 hours for the quota key
    await redis.expire(redisKey, 172800); 

    const [settings] = await db.select().from(leadServiceSettings).where(eq(leadServiceSettings.tenantId, tenantId)).limit(1);
    const limit = settings?.costLimitDailyCents || 1000;

    const usageNum = parseInt(String(newUsage) || '0', 10);
    const softWarningKey = `lead-intel:quota-soft-warning-cents:${tenantId}:${today}`;
    let softWarningTriggered = false;

    if (limit > 0 && usageNum >= limit * config.LEAD_SOFT_WARNING_THRESHOLD && usageNum < limit) {
      const warningSet = await redis.set(softWarningKey, '1', 'EX', 172800, 'NX');
      softWarningTriggered = warningSet === 'OK';

      if (softWarningTriggered) {
        quotaSoftWarningCounter.inc({ tenant_id: tenantId });
        billingLogger.warn(
          { tenantId, usage: usageNum, limit, threshold: config.LEAD_SOFT_WARNING_THRESHOLD },
          'Tenant crossed the soft quota warning threshold',
        );
      }
    }

    if (usageNum >= limit) {
      quotaExceededCounter.inc({ tenant_id: tenantId });
      billingLogger.warn({ tenantId, newUsage, limit }, 'Tenant exceeded daily quota');
    }

    return {
      usage: usageNum,
      limit,
      softWarningTriggered,
    };
  } catch (error: any) {
    billingLogger.error({ error: error.message }, 'Failed to increment daily usage counter');
    return null;
  }
}

export async function costKillSwitchMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.tenantId;
  if (!tenantId) {
    return;
  }

  try {
    const credits = await getTenantCredits(request.server.db, tenantId);
    if (credits < 1) {
      throw new ApiError('AUTH_INSUFFICIENT_CREDITS', LeadErrorMessages.auth.insufficientCredits, [], { tenantId, credits });
    }

    await checkDailyQuota(tenantId);
  } catch (error: unknown) {
    if (error instanceof CoreApiError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown billing guard error';
    billingLogger.error({ tenantId, error: errorMessage }, 'Cost kill-switch failed');
    throw new ApiError('INTERNAL_SERVER_ERROR', LeadErrorMessages.billing.usageValidationFailed, [], { tenantId });
  }
}
