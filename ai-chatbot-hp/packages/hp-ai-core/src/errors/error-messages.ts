import { CoreErrorRegistry } from './registry.js';

/**
 * Global registry for client-safe error messaging.
 * Optimized proxy that points to the Unified Registry.
 */
export const ClientErrorMessages = CoreErrorRegistry;

export type { ClientErrorDetail } from './registry.js';
