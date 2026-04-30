import { BotErrorRegistry } from '@errors/registry.js';

/**
 * Re-exporting unified registry for Metrics/Logging.
 */
export const BotErrorCodes = BotErrorRegistry;

// Legacy support if needed
export { BotErrorRegistry };
