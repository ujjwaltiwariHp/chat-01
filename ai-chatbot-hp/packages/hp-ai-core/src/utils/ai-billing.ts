import { eq } from 'drizzle-orm';
import { aiBillingEvents } from '../db/shared-schema.js';
import { logger } from '../logging/logger.js';
import { ApiError } from './api-error.js';

export type AIBillingStatus = 'reserved' | 'settled' | 'refunded';
export type AIRequestOutcome = 'pending' | 'succeeded' | 'failed';

export interface CreateAIBillingEventInput {
  requestId: string;
  tenantId: string;
  service: string;
  operation?: string;
  model: string;
  estimatedPromptTokens: number;
  requestedCompletionTokens: number;
  requestedTokenBudget: number;
  reservedTokens: number;
  metadata?: Record<string, unknown>;
  status?: AIBillingStatus;
  requestOutcome?: AIRequestOutcome;
  errorMessage?: string;
}

export interface FinalizeAIBillingEventInput {
  requestId: string;
  status: AIBillingStatus;
  requestOutcome: AIRequestOutcome;
  actualPromptTokens?: number;
  actualCompletionTokens?: number;
  actualTotalTokens?: number;
  refundedTokens?: number;
  additionalChargedTokens?: number;
  uncollectedTokens?: number;
  errorMessage?: string | null;
}

const billingLogger = logger.child({ ns: 'core:billing' });

export const createAIBillingEvent = async (db: any, input: CreateAIBillingEventInput) => {
  try {
    const [event] = await db
      .insert(aiBillingEvents as any)
      .values({
        requestId: input.requestId,
        tenantId: input.tenantId,
        service: input.service,
        operation: input.operation || 'invoke',
        model: input.model,
        estimatedPromptTokens: input.estimatedPromptTokens,
        requestedCompletionTokens: input.requestedCompletionTokens,
        requestedTokenBudget: input.requestedTokenBudget,
        reservedTokens: input.reservedTokens,
        metadata: input.metadata,
        status: input.status || 'reserved',
        requestOutcome: input.requestOutcome || 'pending',
        errorMessage: input.errorMessage,
      } as any)
      .returning();

    return event;
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new ApiError('DB_DUPLICATE_ENTRY', 'A billing record already exists for this request');
    }

    billingLogger.error({ error: error.message, requestId: input.requestId }, 'createAIBillingEvent.failed');
    throw new ApiError('DB_TRANSACTION_FAILED', 'Failed to create billing record');
  }
};

export const finalizeAIBillingEvent = async (db: any, input: FinalizeAIBillingEventInput) => {
  try {
    const [event] = await db
      .update(aiBillingEvents as any)
      .set({
        status: input.status,
        requestOutcome: input.requestOutcome,
        actualPromptTokens: input.actualPromptTokens ?? 0,
        actualCompletionTokens: input.actualCompletionTokens ?? 0,
        actualTotalTokens: input.actualTotalTokens ?? 0,
        refundedTokens: input.refundedTokens ?? 0,
        additionalChargedTokens: input.additionalChargedTokens ?? 0,
        uncollectedTokens: input.uncollectedTokens ?? 0,
        errorMessage: input.errorMessage ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(aiBillingEvents.requestId, input.requestId))
      .returning();

    if (!event) {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Billing record not found');
    }

    return event;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    billingLogger.error({ error: error.message, requestId: input.requestId }, 'finalizeAIBillingEvent.failed');
    throw new ApiError('DB_TRANSACTION_FAILED', 'Failed to finalize billing record');
  }
};
