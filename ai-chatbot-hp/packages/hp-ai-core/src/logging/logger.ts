import pino, { type Logger } from 'pino';
import { config } from '../config/base-config.js';

const DEFAULT_REDACTION_CENSOR = '[REDACTED_PII]';

export const DEFAULT_LOG_REDACTION_PATHS = [
  'email',
  'emailAddress',
  'phone',
  'phoneNumber',
  '*.email',
  '*.emailAddress',
  '*.phone',
  '*.phoneNumber',
];

const mergeRedactionPaths = (additionalPaths: string[] = []) => {
  return Array.from(new Set([
    ...DEFAULT_LOG_REDACTION_PATHS,
    ...additionalPaths,
  ]));
};

/**
 * Base Pino Logger Configuration
 * We use a single root instance and create children for namespaces.
 */
const rootLogger = pino({
  level: config.LOG_LEVEL || 'info',
  transport: config.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: config.SERVICE_NAME,
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Creates a namespaced child logger.
 * Example: createLogger("chatbot:llm")
 */
export const createLogger = (namespace: string): Logger => {
  return rootLogger.child({
    ns: namespace,
  });
};

export const createRedactedLogger = (
  namespace: string,
  options: {
    additionalPaths?: string[];
    censor?: string;
  } = {},
): Logger => {
  return rootLogger.child(
    {
      ns: namespace,
    },
    {
      redact: {
        paths: mergeRedactionPaths(options.additionalPaths),
        censor: options.censor || DEFAULT_REDACTION_CENSOR,
        remove: false,
      },
    },
  );
};

/**
 * Default internal core logger
 */
export const logger = createLogger('core');

export type { Logger };
