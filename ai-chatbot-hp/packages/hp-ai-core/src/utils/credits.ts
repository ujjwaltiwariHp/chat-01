import { ApiError, AuthError } from './api-error.js';
import { logger } from '../logging/logger.js';
import { tenants } from '../db/shared-schema.js';
import { eq, sql } from 'drizzle-orm';

export interface TenantCreditReservation {
  reserved: number;
  remaining: number;
}

const normalizeCreditAmount = (amount: number): number => {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(0, Math.floor(amount));
};

const assertDb = (db: any, tenantId: string) => {
  if (!db) {
    logger.error({ ns: 'core:credits', tenantId }, 'CRITICAL: No database instance available for credit enforcement');
    throw new ApiError('DB_CONNECTION_FAILED', 'Credit system unavailable. Please try again later.');
  }
};

export const getTenantCredits = async (db: any, tenantId: string): Promise<number> => {
  assertDb(db, tenantId);

  try {
    const [tenant] = await db
      .select({ credits: (tenants as any).credits })
      .from(tenants as any)
      .where(eq((tenants as any).id, tenantId))
      .limit(1);

    if (!tenant) {
      logger.warn({ ns: 'core:credits', tenantId }, 'Tenant credit lookup failed: invalid tenant');
      throw new AuthError('Invalid tenant context', 'AUTH_INVALID');
    }

    return Number(tenant.credits ?? 0);
  } catch (error: any) {
    if (error instanceof AuthError || error instanceof ApiError) {
      throw error;
    }

    logger.error({ ns: 'core:credits', error: error.message, tenantId }, 'Critical error during tenant credit lookup');
    throw new ApiError('DB_CONNECTION_FAILED', 'Credit system unavailable. Please try again later.');
  }
};

export const reserveTenantCredits = async (
  db: any,
  tenantId: string,
  requestedAmount: number,
): Promise<TenantCreditReservation> => {
  assertDb(db, tenantId);

  const normalizedAmount = normalizeCreditAmount(requestedAmount);
  if (normalizedAmount <= 0) {
    return {
      reserved: 0,
      remaining: await getTenantCredits(db, tenantId),
    };
  }

  logger.info({ ns: 'core:credits', tenantId, requestedAmount: normalizedAmount }, 'Tenant credit reservation attempt');

  try {
    return await db.transaction(async (tx: any) => {
      const locked = await tx.execute(sql`
        SELECT credits
        FROM tenants
        WHERE id = ${tenantId}
        FOR UPDATE
      `);

      const currentRow = (locked as any)?.rows?.[0];
      if (!currentRow) {
        logger.warn({ ns: 'core:credits', tenantId }, 'Tenant credit reservation failed: invalid tenant');
        throw new AuthError('Invalid tenant context', 'AUTH_INVALID');
      }

      const currentCredits = Number(currentRow.credits ?? 0);
      const reserved = Math.min(currentCredits, normalizedAmount);
      const remaining = currentCredits - reserved;

      if (reserved > 0) {
        await tx
          .update(tenants as any)
          .set({ credits: remaining } as any)
          .where(eq((tenants as any).id, tenantId));
      }

      logger.info({
        ns: 'core:credits',
        tenantId,
        requestedAmount: normalizedAmount,
        reserved,
        remaining,
      }, 'Tenant credit reservation successful');

      return { reserved, remaining };
    });
  } catch (error: any) {
    if (error instanceof AuthError || error instanceof ApiError) {
      throw error;
    }

    logger.error({ ns: 'core:credits', error: error.message, tenantId }, 'Critical error during tenant credit reservation');
    throw new ApiError('DB_CONNECTION_FAILED', 'Credit system unavailable. Please try again later.');
  }
};

export const refundTenantCredits = async (db: any, tenantId: string, amount: number): Promise<number> => {
  assertDb(db, tenantId);

  const normalizedAmount = normalizeCreditAmount(amount);
  if (normalizedAmount <= 0) {
    return getTenantCredits(db, tenantId);
  }

  logger.info({ ns: 'core:credits', tenantId, amount: normalizedAmount }, 'Tenant credit refund attempt');

  try {
    const [updated] = await db
      .update(tenants as any)
      .set({ credits: sql`${(tenants as any).credits} + ${normalizedAmount}` } as any)
      .where(eq((tenants as any).id, tenantId))
      .returning({ credits: (tenants as any).credits });

    if (!updated) {
      logger.warn({ ns: 'core:credits', tenantId, amount: normalizedAmount }, 'Tenant credit refund failed: invalid tenant');
      throw new AuthError('Invalid tenant context', 'AUTH_INVALID');
    }

    logger.info({ ns: 'core:credits', tenantId, refunded: normalizedAmount, remaining: updated.credits }, 'Tenant credit refund successful');
    return Number(updated.credits ?? 0);
  } catch (error: any) {
    if (error instanceof AuthError || error instanceof ApiError) {
      throw error;
    }

    logger.error({ ns: 'core:credits', error: error.message, tenantId }, 'Critical error during tenant credit refund');
    throw new ApiError('DB_CONNECTION_FAILED', 'Credit system unavailable. Please try again later.');
  }
};

/**
 * Standardized Credit Management Logic (Core)
 */
export const checkAndDeductCredits = async (db: any, tenantId: string, cost: number): Promise<boolean> => {
  const normalizedCost = normalizeCreditAmount(cost);
  logger.info({ ns: 'core:credits', tenantId, cost: normalizedCost }, 'Credit deduction attempt');

  assertDb(db, tenantId);

  try {
    // High Standard: Atomic decrement with balance check in a single statement
    const [updated] = await db
      .update(tenants as any)
      .set({ credits: sql`${(tenants as any).credits} - ${normalizedCost}` } as any)
      .where(sql`${(tenants as any).id} = ${tenantId} AND ${(tenants as any).credits} >= ${normalizedCost}`)
      .returning();

    if (!updated) {
       logger.warn({ ns: 'core:credits', tenantId, cost: normalizedCost }, 'Credit deduction failed: Insufficient funds or invalid tenant');
       throw new AuthError('Insufficient AI credits to perform this action', 'AUTH_INSUFFICIENT_CREDITS');
    }

    logger.info({ ns: 'core:credits', tenantId, remaining: updated.credits }, 'Credit deduction successful');
    return true;
  } catch (error: any) {
    if (error instanceof AuthError) throw error;
    if (error instanceof ApiError) throw error;
    logger.error({ ns: 'core:credits', error: error.message, tenantId }, 'Critical error during credit deduction');
    throw new ApiError('DB_CONNECTION_FAILED', 'Credit system unavailable. Please try again later.');
  }
};
