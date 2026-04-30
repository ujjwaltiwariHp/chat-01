import { ApiError as CoreApiError } from '@hp-intelligence/core';
import { GatewayErrorRegistry } from '@errors/registry.js';

/**
 * High-Standard Local ApiError for Gateway
 * Inherits from CoreApiError and injects the local unified registry.
 */
export class GatewayApiError extends CoreApiError {
  constructor(
    codeSlug: string = 'COMMON_UNKNOWN_ERROR',
    overrideMessage?: string,
    errors: unknown[] = [],
    meta: Record<string, any> = {}
  ) {
    // Inject the local registry (GatewayErrorRegistry) as the 5th argument.
    // This allows the Gateway to have its own specific errors.
    super(codeSlug, overrideMessage, errors, meta, GatewayErrorRegistry);
  }
}

// Map the generic ApiError export to GatewayApiError for local consistency
export { GatewayApiError as ApiError };
