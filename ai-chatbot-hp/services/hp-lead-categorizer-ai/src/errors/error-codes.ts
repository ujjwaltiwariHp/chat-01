import { LeadErrorRegistry } from '@errors/registry.js';

/**
 * Re-exporting the local registry keeps the service aligned with the
 * monorepo error-files convention used in sibling services.
 */
export const LeadErrorCodes = LeadErrorRegistry;

export { LeadErrorRegistry };
