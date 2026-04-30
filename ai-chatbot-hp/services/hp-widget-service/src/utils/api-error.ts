import { ApiError as CoreApiError } from '@hp-intelligence/core';
import { WidgetErrorRegistry } from '@errors/registry.js';

/**
 * High-Standard Local ApiError for Widget-Service
 * Inherits from CoreApiError and injects the local unified registry.
 */
export class WidgetApiError extends CoreApiError {
  constructor(
    codeSlug: string = 'COMMON_UNKNOWN_ERROR',
    overrideMessage?: string,
    errors: unknown[] = [],
    meta: Record<string, any> = {}
  ) {
    // Inject the local registry (WidgetErrorRegistry) as the 5th argument.
    // This allows the Widget-Service to have its own specific errors.
    super(codeSlug, overrideMessage, errors, meta, WidgetErrorRegistry);
  }
}

// Map the generic ApiError export to WidgetApiError for local consistency
export { WidgetApiError as ApiError };
