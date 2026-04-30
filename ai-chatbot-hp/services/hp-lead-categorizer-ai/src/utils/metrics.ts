import client from 'prom-client';

// Shared counters from core can be utilized here if imported, 
// but we define service-specific metrics for HP Lead Intelligence.

export const leadsIngestedCounter = new client.Counter({
  name: 'lead_intelligence_ingested_total',
  help: 'Total leads ingested by source',
  labelNames: ['source'],
});

export const leadNormalizationCounter = new client.Counter({
  name: 'lead_intelligence_normalization_total',
  help: 'Total normalization attempts',
  labelNames: ['status'], // success, fail
});

export const leadAnalysisCounter = new client.Counter({
  name: 'lead_intelligence_analysis_total',
  help: 'Total analysis attempts',
  labelNames: ['tier', 'status'],
});

export const leadAnalysisFallbackCounter = new client.Counter({
  name: 'lead_intelligence_analysis_fallback_total',
  help: 'Total number of analysis fallbacks triggered',
});

export const leadClassificationCounter = new client.Counter({
  name: 'lead_intelligence_classification_total',
  help: 'Distribution of lead classifications',
  labelNames: ['classification'],
});

export const aiTokensCounter = new client.Counter({
  name: 'lead_intelligence_tokens_total',
  help: 'Total AI tokens used',
  labelNames: ['model', 'type'], // prompt, completion
});

export const aiCostCounter = new client.Counter({
  name: 'lead_intelligence_cost_usd_total',
  help: 'Estimated cost in USD',
});

export const aiCircuitBreakerCounter = new client.Counter({
  name: 'lead_intelligence_ai_circuit_breaker_total',
  help: 'Total times the AI circuit breaker was triggered or opened',
  labelNames: ['event'], // open, halfOpen, close, failure
});

export const webhookDeliveryCounter = new client.Counter({
  name: 'lead_intelligence_webhook_delivery_total',
  help: 'Total outbound webhook deliveries',
  labelNames: ['event', 'status'], // success, fail
});

export const slackNotificationCounter = new client.Counter({
  name: 'lead_intelligence_slack_notification_total',
  help: 'Total Slack notifications sent',
  labelNames: ['status'], // success, fail
});

export const leadDecayCounter = new client.Counter({
  name: 'lead_intelligence_decay_total',
  help: 'Total lead decay events',
  labelNames: ['from', 'to'],
});

export const routingAssignmentCounter = new client.Counter({
  name: 'lead_intelligence_routing_assignment_total',
  help: 'Total leads assigned via routing rules',
  labelNames: ['rule_id', 'assignee'],
});

export const manualAssignmentCounter = new client.Counter({
  name: 'lead_intelligence_manual_assignment_total',
  help: 'Total manual lead assignments',
});

export const leadGateRejectedCounter = new client.Counter({
  name: 'lead_intelligence_gate_rejected_total',
  help: 'Total leads rejected by hard gates',
  labelNames: ['gate'], // validation, deal-breaker, spam-guard
});

export const rlsViolationCounter = new client.Counter({
  name: 'lead_intelligence_rls_violation_total',
  help: 'Total potential RLS violations detected at service level',
  labelNames: ['tenant_id'],
});

export const quotaExceededCounter = new client.Counter({
  name: 'lead_intelligence_quota_exceeded_total',
  help: 'Total times daily quota was exceeded',
  labelNames: ['tenant_id'],
});

export const quotaSoftWarningCounter = new client.Counter({
  name: 'lead_intelligence_quota_soft_warning_total',
  help: 'Total times tenants crossed the soft quota warning threshold',
  labelNames: ['tenant_id'],
});

export const queueBackpressureCounter = new client.Counter({
  name: 'lead_intelligence_queue_backpressure_total',
  help: 'Total times requests were rejected due to queue saturation',
  labelNames: ['queue_name'],
});

export const idempotencyHitCounter = new client.Counter({
  name: 'lead_intelligence_idempotency_hit_total',
  help: 'Total idempotency key cache hits',
});

export const apiErrorsCounter = new client.Counter({
  name: 'lead_intelligence_api_errors_total',
  help: 'Total API errors by status code',
  labelNames: ['code'],
});
