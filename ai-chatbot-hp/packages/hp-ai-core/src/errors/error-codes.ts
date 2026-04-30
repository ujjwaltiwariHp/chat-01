import { CoreErrorRegistry, CoreErrorSlug } from './registry.js';

/**
 * Standard Severity Levels (Re-exported from Registry)
 */
export type { Severity, CoreErrorEntry, ErrorDetail } from './registry.js';

/**
 * Technical Slug Registry
 * Re-keyed for backward compatibility with existing code.
 */
export const CoreErrorCode = Object.keys(CoreErrorRegistry).reduce((acc, key) => {
  acc[key] = key;
  return acc;
}, {} as any) as Record<CoreErrorSlug, string>;

/**
 * The technical registry (Used for internal metrics mapping)
 */
export const ErrorCodes = CoreErrorRegistry;
