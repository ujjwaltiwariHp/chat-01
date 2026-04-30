import { ErrorDetail, HttpStatusCode } from '@hp-intelligence/core';
import { LeadErrorMessages } from '@errors/error-messages.js';

/**
 * Lead-service local registry.
 * This can override core defaults and is the right place for future
 * service-specific error slugs if we add them.
 */
export const LeadErrorRegistry: Record<string, ErrorDetail> = {
  QUEUE_BACKPRESSURE: {
    code: 5006,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'medium',
    component: 'queue',
    internalMessage: LeadErrorMessages.billing.queueBackpressure,
    clientMessage: LeadErrorMessages.billing.queueBackpressure,
  },
  USAGE_QUOTA_EXCEEDED: {
    code: 5005,
    statusCode: HttpStatusCode.FORBIDDEN,
    severity: 'medium',
    component: 'billing',
    internalMessage: LeadErrorMessages.billing.dailyQuotaReached,
    clientMessage: LeadErrorMessages.billing.dailyQuotaReached,
  },
};
