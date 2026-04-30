import pino from 'pino';

export const bootstrapLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: process.env.SERVICE_NAME || 'hp-intelligence-bootstrap',
    env: process.env.NODE_ENV || 'development',
    ns: 'config:bootstrap',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
