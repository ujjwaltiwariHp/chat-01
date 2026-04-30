// Barrel export for @hp-intelligence/core

// Auth
export * from './auth/multi-mode-auth.js';
export * from './auth/gateway-auth.js';
export * from './auth/session-cookie-auth.js';
export * from './auth/service-request-signing.js';
export * from './auth/standalone-auth.js';
export * from './auth/widget-auth.js';
export { default as multiModeAuthPlugin } from './auth/multi-mode-auth.js';

// Types
export * from './types/auth.js';
export * from './types/conversation.js';
export * from './types/llm.js';
export * from './types/widget.js';

// LLM
export * from './llm/openai.js';

// Logging
export { logger, createLogger, createRedactedLogger, DEFAULT_LOG_REDACTION_PATHS } from './logging/logger.js';
export type { Logger } from './logging/logger.js';

// Utils
export * from './utils/api-response.js';
export * from './utils/http-status.js';
export * from './errors/error-codes.js';
export * from './errors/error-messages.js';
export { ClientErrorMessages as ERROR_MESSAGES } from './errors/error-messages.js';
export * from './utils/api-error.js';
export * from './utils/circuit-breaker.js';
export * from './utils/token-counter.js';
export * from './utils/secret-manager.js';
export * from './utils/encryption.js';
export * from './utils/mail.js';
export * from './utils/regex.js';
export * from './utils/redis-client.js';
export * from './utils/llm-validator.js';
export * from './utils/redactor.js';
export * from './cache/semantic-cache.js';
export { safeCompare } from './utils/safe-compare.js';
export * from './utils/credits.js';
export * from './utils/ai-billing.js';

// Plugins
export { default as healthPlugin } from './plugins/health.js';
export { default as metricsPlugin, tokenCounter, aiErrorCounter, widgetConversationCounter } from './plugins/metrics.js';
export { coreSecurityGuardHook as contentGuardHook, contentGuardPlugin } from './plugins/content-guard.js';
export * from './plugins/rate-limiter.js';
export { default as requestContextPlugin } from './plugins/request-context.js';
export { default as rateLimiterPlugin } from './plugins/rate-limiter.js';
export { errorHandler, errorHandlerPlugin } from './plugins/error-handler.js';

// Config
export * from './config/base-config.js';

// DB
export * from './db/base-connection.js';
export * from './db/shared-schema.js';
export * from 'drizzle-orm';
export * from 'drizzle-orm/node-postgres';
