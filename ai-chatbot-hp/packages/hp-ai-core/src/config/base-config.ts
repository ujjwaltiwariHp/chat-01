import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootstrapLogger } from '../logging/bootstrap-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenvConfig({ path: path.resolve(__dirname, '../../../../.env') });

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SERVICE_NAME: z.string().default('hp-intelligence-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  PORT: z.preprocess((val) => Number(val), z.number()).default(4000),
  INTERNAL_SERVICE_TOKEN: z.string().min(1),
  GATEWAY_SERVICE_SECRET: z.string().min(1),
  WIDGET_SERVICE_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DB_URL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  MAX_MESSAGE_TOKENS: z.preprocess((val) => Number(val), z.number()).default(1024),
  WIDGET_SITE_KEY_SECRET: z.string().optional(),
  EXPECTED_WIDGET_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  HP_BIZ_API_KEY: z.string().optional(), // Shared across Gateway/Core
  AUTH_MODE: z.enum(['multi', 'standalone']).default('multi'),
  // SMTP Configuration (P5 Magic-Link)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess((val) => Number(val || 587), z.number()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('HangingPanda Intelligence <noreply@hp-intelligence.com>'),
});

export type BaseConfig = z.infer<typeof baseEnvSchema>;

export const validateBaseConfig = (): BaseConfig => {
    const result = baseEnvSchema.safeParse(process.env);

    if (!result.success) {
      bootstrapLogger.error({ issues: result.error.issues }, 'Core configuration validation failed');
      process.exit(1);
    }

    const databaseUrl = result.data.DATABASE_URL ?? result.data.DB_URL;

    if (!databaseUrl) {
      bootstrapLogger.error({
        issues: [
          {
            path: ['DATABASE_URL'],
            message: 'Either DATABASE_URL or DB_URL is required',
          },
        ],
      }, 'Core configuration validation failed');
      process.exit(1);
    }

    return {
      ...result.data,
      DATABASE_URL: databaseUrl,
      DB_URL: databaseUrl,
    };
};

export const config = validateBaseConfig();
