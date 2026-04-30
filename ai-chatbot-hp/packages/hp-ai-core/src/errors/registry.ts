import { HttpStatusCode } from '../utils/http-status.js';

/**
 * Standard Severity Levels for @hp-intelligence
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Unified Core Error Definition
 * This represents the "Single Source of Truth" for every technical and user-facing error concern.
 */
export interface CoreErrorEntry {
  code: number;
  statusCode: HttpStatusCode;
  severity: Severity;
  component: string;
  internalMessage: string;
  clientMessage: string;
}

/**
 * Backward compatibility alias for monorepo services
 */
export type ErrorDetail = CoreErrorEntry;

/**
 * Client-facing error detail interface.
 */
export interface ClientErrorDetail {
  clientMessage: string;
  statusCode: HttpStatusCode;
}

/**
 * Global technical error slug registry.
 * This file consolidates technical metrics (1xxx, 2xxx, etc.) 
 * with user-facing API status codes and safe messaging.
 */
export const CoreErrorRegistry = {
  // --- LLM / AI (1xxx) ---
  LLM_TIMEOUT: {
    code: 1001,
    statusCode: HttpStatusCode.GATEWAY_TIMEOUT,
    severity: 'high',
    component: 'llm',
    internalMessage: 'LLM provider timeout',
    clientMessage: 'The AI service is taking too long to respond.'
  },
  LLM_RATE_LIMIT: {
    code: 1002,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'llm',
    internalMessage: 'LLM provider rate limit exceeded',
    clientMessage: 'Too many requests to AI provider. Please wait a moment.'
  },
  LLM_INVALID_KEY: {
    code: 1003,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'critical',
    component: 'llm',
    internalMessage: 'Invalid LLM configuration or API key',
    clientMessage: 'Service configuration error. Please contact support.'
  },
  LLM_INVALID_MODEL: {
    code: 1004,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'high',
    component: 'llm',
    internalMessage: 'Requested model is unavailable',
    clientMessage: 'Requested model is currently unavailable.'
  },
  LLM_EMPTY_RESPONSE: {
    code: 1006,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'high',
    component: 'llm',
    internalMessage: 'LLM provider returned an empty response',
    clientMessage: 'Service temporarily unavailable.'
  },
  LLM_CONTENT_FILTER: {
    code: 1005,
    statusCode: HttpStatusCode.BAD_REQUEST,
    severity: 'medium',
    component: 'llm',
    internalMessage: 'LLM content filter triggered',
    clientMessage: 'Content validation failed.'
  },
  LLM_UNKNOWN: {
    code: 1999,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'high',
    component: 'llm',
    internalMessage: 'Unexpected LLM error',
    clientMessage: 'An unexpected error occurred in the AI layer.'
  },

  // --- Database (2xxx) ---
  DB_CONNECTION_FAILED: {
    code: 2001,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'critical',
    component: 'database',
    internalMessage: 'Database connection failed',
    clientMessage: 'Database service is currently unreachable.'
  },
  DB_QUERY_TIMEOUT: {
    code: 2002,
    statusCode: HttpStatusCode.GATEWAY_TIMEOUT,
    severity: 'high',
    component: 'database',
    internalMessage: 'Database query timed out',
    clientMessage: 'Request took too long to process. Please retry.'
  },
  DB_DUPLICATE_ENTRY: {
    code: 2003,
    statusCode: HttpStatusCode.CONFLICT,
    severity: 'low',
    component: 'database',
    internalMessage: 'Database unique constraint violation',
    clientMessage: 'This record already exists.'
  },
  DB_FOREIGN_KEY_VIOLATION: {
    code: 2004,
    statusCode: HttpStatusCode.BAD_REQUEST,
    severity: 'medium',
    component: 'database',
    internalMessage: 'Database integrity violation',
    clientMessage: 'The provided data references a non-existent item.'
  },
  DB_TRANSACTION_FAILED: {
    code: 2005,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'high',
    component: 'database',
    internalMessage: 'Database transaction failed',
    clientMessage: 'Wait, we could not save those changes safely. Please try again.'
  },
  DB_QUERY_FAILED: {
    code: 2006,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'high',
    component: 'database',
    internalMessage: 'Database query execution failed',
    clientMessage: 'We are having trouble accessing your data.'
  },
  DB_UNKNOWN: {
    code: 2999,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'high',
    component: 'database',
    internalMessage: 'Unexpected database error',
    clientMessage: 'A database error occurred.'
  },

  // --- Security / Auth (3xxx) ---
  IP_RATE_LIMIT_EXCEEDED: {
    code: 3001,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'security',
    internalMessage: 'Per-IP rate limit exceeded',
    clientMessage: 'Too many requests. Please wait.'
  },
  PROMPT_INJECTION_DETECTED: {
    code: 3002,
    statusCode: HttpStatusCode.BAD_REQUEST,
    severity: 'critical',
    component: 'security',
    internalMessage: 'Injection attempt detected',
    clientMessage: 'Security validation failed.'
  },
  AUTH_TOKEN_INVALID: {
    code: 3003,
    statusCode: HttpStatusCode.UNAUTHORIZED,
    severity: 'high',
    component: 'security',
    internalMessage: 'Provided token is invalid or expired',
    clientMessage: 'Unauthorized. Token is invalid or has expired.'
  },
  AUTH_MISSING: {
    code: 3005,
    statusCode: HttpStatusCode.UNAUTHORIZED,
    severity: 'high',
    component: 'security',
    internalMessage: 'Missing authentication credentials',
    clientMessage: 'Unauthorized. Authentication is required.'
  },
  AUTH_INVALID: {
    code: 3006,
    statusCode: HttpStatusCode.UNAUTHORIZED,
    severity: 'high',
    component: 'security',
    internalMessage: 'Invalid credentials provided',
    clientMessage: 'Unauthorized. Invalid authentication credentials.'
  },
  AUTH_DOMAIN_NOT_AUTHORIZED: {
    code: 3007,
    statusCode: HttpStatusCode.FORBIDDEN,
    severity: 'high',
    component: 'security',
    internalMessage: 'Origin domain is not authorized',
    clientMessage: 'Access denied. Origin not authorized.'
  },
  AUTH_INSUFFICIENT_CREDITS: {
    code: 3009,
    statusCode: HttpStatusCode.PAYMENT_REQUIRED,
    severity: 'medium',
    component: 'security',
    internalMessage: 'Tenant has insufficient AI credits',
    clientMessage: 'Insufficient credits. Please top up your balance.'
  },

  // --- Cache (4xxx) ---
  REDIS_CONNECTION_FAILED: {
    code: 4001,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'medium',
    component: 'cache',
    internalMessage: 'Redis connection failed',
    clientMessage: 'Cache service unavailable.'
  },
  CACHE_SET_FAILED: {
    code: 4003,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'low',
    component: 'cache',
    internalMessage: 'Failed to write to cache',
    clientMessage: 'Cache service error.'
  },
  CONVERSATION_NOT_FOUND: {
    code: 4004,
    statusCode: HttpStatusCode.NOT_FOUND,
    severity: 'low',
    component: 'cache',
    internalMessage: 'Conversation session not found',
    clientMessage: 'Conversation not found.'
  },
  REDIS_UNKNOWN: {
    code: 4999,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'medium',
    component: 'cache',
    internalMessage: 'Unexpected cache error',
    clientMessage: 'An unexpected cache error occurred.'
  },

  // --- Common (5xxx) ---
  COMMON_VALIDATION_ERROR: {
    code: 5001,
    statusCode: HttpStatusCode.BAD_REQUEST,
    severity: 'low',
    component: 'api',
    internalMessage: 'Request validation failed',
    clientMessage: 'The provided data is invalid.'
  },
  RESOURCE_NOT_FOUND: {
    code: 5003,
    statusCode: HttpStatusCode.NOT_FOUND,
    severity: 'low',
    component: 'api',
    internalMessage: 'Resource or route not found',
    clientMessage: 'The requested resource was not found.'
  },
  NOT_FOUND: {
    code: 5004,
    statusCode: HttpStatusCode.NOT_FOUND,
    severity: 'low',
    component: 'api',
    internalMessage: 'Not found',
    clientMessage: 'Not found.'
  },
  INTERNAL_SERVER_ERROR: {
    code: 5002,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'critical',
    component: 'api',
    internalMessage: 'Unhandled technical error',
    clientMessage: 'An internal server error occurred.'
  },
  COMMON_UNKNOWN_ERROR: {
    code: 5999,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'high',
    component: 'api',
    internalMessage: 'An unexpected error occurred',
    clientMessage: 'Something went wrong. Please try again later.'
  },
  COMMON_AUTH_ERROR: {
    code: 3008,
    statusCode: HttpStatusCode.UNAUTHORIZED,
    severity: 'high',
    component: 'api',
    internalMessage: 'Authentication or tenant context missing',
    clientMessage: 'Unauthorized. Access denied.'
  },
  USAGE_QUOTA_EXCEEDED: {
    code: 5005,
    statusCode: HttpStatusCode.FORBIDDEN,
    severity: 'medium',
    component: 'billing',
    internalMessage: 'Tenant usage quota exceeded',
    clientMessage: 'The configured usage limit for this tenant has been reached.'
  },
  QUEUE_BACKPRESSURE: {
    code: 5006,
    statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    severity: 'medium',
    component: 'queue',
    internalMessage: 'Processing queue is saturated',
    clientMessage: 'The service is temporarily busy. Please retry shortly.'
  },

  // --- Session (9xxx) ---
  SESSION_CREATE_FAILED: {
    code: 9001,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'medium',
    component: 'session',
    internalMessage: 'Failed to initialize session',
    clientMessage: 'Could not create chat session.'
  },
  SESSION_VALIDATE_FAILED: {
    code: 9002,
    statusCode: HttpStatusCode.UNAUTHORIZED,
    severity: 'medium',
    component: 'session',
    internalMessage: 'Session validation failed',
    clientMessage: 'Your session has expired. Please log in again.'
  },
  SESSION_DESTROY_FAILED: {
    code: 9003,
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    severity: 'low',
    component: 'session',
    internalMessage: 'Failed to cleanup session',
    clientMessage: 'Logout failed.'
  },
  SESSION_RATE_LIMIT_EXCEEDED: {
    code: 9004,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'session',
    internalMessage: 'Session-based rate limit reached',
    clientMessage: 'Too many requests. Please wait a moment.'
  },
  CONVERSATION_CHAT_LIMIT_EXCEEDED: {
    code: 9005,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'session',
    internalMessage: 'Conversation message limit reached',
    clientMessage: 'You have reached the maximum number of messages for this conversation.'
  },
  SESSION_DAILY_LIMIT_EXCEEDED: {
    code: 9006,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'session',
    internalMessage: 'Daily session message limit reached',
    clientMessage: 'Daily message limit. Resets in 24 hours.'
  },
  IP_DAILY_LIMIT_EXCEEDED: {
    code: 9007,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'security',
    internalMessage: 'Daily IP message limit reached',
    clientMessage: 'Daily limit reached. Resets in 24 hours.'
  },
} as const;

export type CoreErrorRegistryType = typeof CoreErrorRegistry;
export type CoreErrorSlug = keyof CoreErrorRegistryType;

/**
 * Standard technical slugs.
 * as const ensures that strings are treated as literals for type safety.
 */
export const CoreErrorCode = {
  // LLM (1xxx)
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT',
  LLM_INVALID_KEY: 'LLM_INVALID_KEY',
  LLM_INVALID_MODEL: 'LLM_INVALID_MODEL',
  LLM_CONTENT_FILTER: 'LLM_CONTENT_FILTER',
  LLM_UNKNOWN: 'LLM_UNKNOWN',

  // Database (2xxx)
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  DB_DUPLICATE_ENTRY: 'DB_DUPLICATE_ENTRY',
  DB_FOREIGN_KEY_VIOLATION: 'DB_FOREIGN_KEY_VIOLATION',
  DB_TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_UNKNOWN: 'DB_UNKNOWN',

  // Security / Auth (3xxx)
  IP_RATE_LIMIT_EXCEEDED: 'IP_RATE_LIMIT_EXCEEDED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  AUTH_MISSING: 'AUTH_MISSING',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_DOMAIN_NOT_AUTHORIZED: 'AUTH_DOMAIN_NOT_AUTHORIZED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_INSUFFICIENT_CREDITS: 'AUTH_INSUFFICIENT_CREDITS',

  // Cache (4xxx)
  REDIS_CONNECTION_FAILED: 'REDIS_CONNECTION_FAILED',
  CACHE_SET_FAILED: 'CACHE_SET_FAILED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  REDIS_UNKNOWN: 'REDIS_UNKNOWN',

  // Common / API (5xxx)
  COMMON_VALIDATION_ERROR: 'COMMON_VALIDATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  COMMON_UNKNOWN_ERROR: 'COMMON_UNKNOWN_ERROR',
  COMMON_AUTH_ERROR: 'COMMON_AUTH_ERROR',
  USAGE_QUOTA_EXCEEDED: 'USAGE_QUOTA_EXCEEDED',
  QUEUE_BACKPRESSURE: 'QUEUE_BACKPRESSURE',

  // Session / Limits (9xxx)
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  SESSION_VALIDATE_FAILED: 'SESSION_VALIDATE_FAILED',
  SESSION_DESTROY_FAILED: 'SESSION_DESTROY_FAILED',
  SESSION_RATE_LIMIT_EXCEEDED: 'SESSION_RATE_LIMIT_EXCEEDED',
  CONVERSATION_CHAT_LIMIT_EXCEEDED: 'CONVERSATION_CHAT_LIMIT_EXCEEDED',
  SESSION_DAILY_LIMIT_EXCEEDED: 'SESSION_DAILY_LIMIT_EXCEEDED',
  IP_DAILY_LIMIT_EXCEEDED: 'IP_DAILY_LIMIT_EXCEEDED',
} as const;
