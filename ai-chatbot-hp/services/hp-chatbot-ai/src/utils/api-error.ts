import { ApiError as CoreApiError } from '@hp-intelligence/core';
import { BotErrorRegistry } from '@errors/error-codes.js';

/**
 * Custom Chatbot-Specific Error Class
 * Resolves codes from both the local BotErrorRegistry and the Core Registry.
 */
export class BotError extends CoreApiError {
  constructor(
    codeSlug: string = 'COMMON_UNKNOWN_ERROR',
    overrideMessage?: string,
    errors: unknown[] = [],
    meta: Record<string, any> = {}
  ) {
    // Correctly injecting the local registry as the 5th argument!
    super(codeSlug, overrideMessage, errors, meta, BotErrorRegistry);
  }
}

// Map the generic ApiError export to BotError for local consistency
export { BotError as ApiError };
