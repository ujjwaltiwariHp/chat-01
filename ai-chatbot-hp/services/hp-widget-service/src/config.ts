import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { logger } from '@hp-intelligence/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the monorepo root
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WIDGET_PORT: z.coerce.number().default(4010),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  WIDGET_SERVICE_SECRET: z.string().min(1),
  INTERNAL_SERVICE_TOKEN: z.string().min(1),
  CHATBOT_SERVICE_URL: z.string().url().default('http://hp-chatbot-ai:4001'),
});


const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error({ 
    msg: 'Invalid environment variables for hp-widget-service',
    issues: parsed.error.issues 
  });
  process.exit(1);
}

export const config = parsed.data;
