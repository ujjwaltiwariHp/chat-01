import { HttpStatusCode } from './http-status.js';
import { CoreErrorRegistry, CoreErrorSlug } from '../errors/registry.js';

/**
 * Standard API Error class for the @hp-intelligence monorepo.
 * Aligns technical internal errors with user-safe responses.
 * Supports local service-level registries for extensibility.
 */
export class ApiError extends Error {
  public statusCode: HttpStatusCode;
  public success: false = false;
  public errorCode: number;
  public errorCodeSlug: string;
  public severity: string;
  public clientMessage: string;
  public errors: any[];
  public meta: Record<string, any>;
  public data: null = null;

  constructor(
    codeSlug: CoreErrorSlug | string = 'COMMON_UNKNOWN_ERROR',
    overrideMessage?: string,
    errors: any[] = [],
    meta: Record<string, any> = {},
    localRegistry?: Record<string, any>
  ) {
    // 1. Resolve Atomic Detail from Registry
    // Registry priority: Local Service Override > Core Unified Registry > Global Fallback
    const registryEntry =
      localRegistry?.[codeSlug] ||
      (CoreErrorRegistry as any)[codeSlug] ||
      CoreErrorRegistry.COMMON_UNKNOWN_ERROR;

    // 2. Technical message for developer logs (super)
    // Favor the overrideMessage, then fall back to technical internal detail
    super(overrideMessage || registryEntry.internalMessage);

    this.statusCode = registryEntry.statusCode;
    this.errorCodeSlug = codeSlug;
    this.errorCode = registryEntry.code;
    this.severity = registryEntry.severity;
    this.errors = errors;
    this.meta = meta;

    // 3. User-facing message masking
    // If dev Provided an override (e.g. from validator), use it.
    // Otherwise use the safe registry clientMessage.
    this.clientMessage = overrideMessage || registryEntry.clientMessage;

    Object.setPrototypeOf(this, ApiError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// --- Specialized Wrappers ---

export class AuthError extends ApiError {
  constructor(message?: string, slug: string = 'AUTH_INVALID') {
    super(slug, message);
  }
}

export class ValidationError extends ApiError {
  constructor(message?: string) {
    super('COMMON_VALIDATION_ERROR', message);
  }
}

export class LLMError extends ApiError {
  constructor(message?: string, slug: CoreErrorSlug = 'LLM_UNKNOWN') {
    super(slug, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message?: string) {
    super('NOT_FOUND', message);
  }
}

export class CreditError extends ApiError {
  constructor(message?: string, slug: string = 'CONVERSATION_CHAT_LIMIT_EXCEEDED') {
    super(slug, message);
  }
}
