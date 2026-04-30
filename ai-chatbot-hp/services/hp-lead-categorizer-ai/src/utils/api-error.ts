import { ApiError as CoreApiError } from '@hp-intelligence/core';
import { LeadErrorRegistry } from '@errors/registry.js';

export class LeadApiError extends CoreApiError {
  constructor(
    codeSlug: string = 'COMMON_UNKNOWN_ERROR',
    overrideMessage?: string,
    errors: unknown[] = [],
    meta: Record<string, any> = {},
  ) {
    super(codeSlug, overrideMessage, errors, meta, LeadErrorRegistry);
  }
}

export { LeadApiError as ApiError };
