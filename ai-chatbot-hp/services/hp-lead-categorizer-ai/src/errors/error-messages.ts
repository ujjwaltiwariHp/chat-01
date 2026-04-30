export const LeadErrorMessages = {
  auth: {
    apiKeyHeaderRequired: 'X-API-Key header is required',
    invalidApiKey: 'Invalid API key',
    tenantContextRequired: 'Tenant context is required',
    chatbotInternalOnly: 'Chatbot ingestion is restricted to internal service calls',
    internalChatbotTenantRequired: 'Internal chatbot ingestion requires tenant context',
    insufficientCredits: 'Insufficient credits',
  },
  ai: {
    authenticationRequired: 'Authentication required for AI operations',
    validationFailed: (details: string) => `AI returned data that failed validation: ${details}`,
  },
  billing: {
    dailyQuotaReached: 'Daily cost limit reached for this tenant',
    usageValidationFailed: 'Unable to validate tenant usage limits',
    queueBackpressure: 'Lead processing is temporarily saturated. Please retry shortly.',
  },
  validation: {
    leadRequiresEmailOrPhone: 'Lead must have either an email or a phone number',
    invalidEmailFormat: (email: string) => `Invalid email format: ${email}`,
    invalidMailDomain: (domain: string) => `Email domain ${domain} does not have valid mail records`,
    spamGuardRejectedField: (field: string) => `Lead rejected by spam guard (${field})`,
    spamGuardSubmissionTooFast: 'Lead rejected by spam guard (submission too fast)',
    chatbotTranscriptRequired: 'Chatbot ingestion requires a transcript array',
    duplicateIdempotencyKey: 'Duplicate request detected via X-Idempotency-Key',
    lowQualityLeadRejected: 'Lead submission rejected (minimum quality criteria not met)',
    blockedWebhookDestination: 'SSRF: Blocked internal webhook destination',
  },
  notFound: {
    lead: (leadId: string) => `Lead with ID ${leadId} not found`,
    analysis: (analysisId: string) => `Analysis with ID ${analysisId} not found`,
    routingRule: (ruleId: string) => `Routing rule ${ruleId} not found`,
    teamMember: (userId: string) => `Team member ${userId} not found`,
    assignedUserTenantMismatch: 'Assigned user does not belong to this tenant',
    routingRuleAssigneeTenantMismatch: 'Routing rule assignee does not belong to this tenant',
    slackWebhookNotConfigured: 'Slack webhook is not configured for this tenant',
  },
  integration: {
    slackWebhookFailed: (status: number) => `Slack webhook returned ${status}`,
    outboundWebhookFailed: (status: number) => `Outbound webhook returned ${status}`,
  },
} as const;

export const ERROR_MESSAGES = LeadErrorMessages;

export type LeadErrorMessagesShape = typeof LeadErrorMessages;
