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
  PORT: z.coerce.number().default(4000),
  INTERNAL_SERVICE_TOKEN: z.string().min(1),
  GATEWAY_SERVICE_SECRET: z.string().min(1),
  HP_BIZ_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1), // Gateway now needs DB for Magic-Link
  JWT_SECRET: z.string().min(1),
  DASHBOARD_URL: z.string().default('http://localhost:3000/dashboard'),
  CHATBOT_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  LEAD_CATEGORIZER_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  HR_POLICY_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  SLACKBOT_SERVICE_URL: z.string().url().default('http://localhost:4006'),
  // SMTP for @hp-intelligence/core mail utility
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error({ 
    msg: 'Invalid environment variables for hp-intelligence-gateway',
    issues: parsed.error.issues 
  });
  process.exit(1);
}

export const config = parsed.data;
