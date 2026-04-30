import { z } from 'zod';
import { config as baseConfig, BaseConfig } from '@hp-intelligence/core';

/**
 * Chatbot AI Specific Configuration
 */
const serviceEnvSchema = z.object({
  SESSION_SECRET: z.string().default(baseConfig.INTERNAL_SERVICE_TOKEN),
  JWT_SECRET: z.string().default(baseConfig.INTERNAL_SERVICE_TOKEN),
  CHATBOT_PORT: z.preprocess((val) => Number(val), z.number()).default(4001),
  
  // These are unique to the chatbot service
  CHATBOT_OPENAI_API_KEY: z.string().min(1).optional(),
  CONTEXT_WINDOW: z.preprocess((val) => Number(val), z.number()).default(128000),
  
  // Summarization
  SUMMARY_MAX_TOKENS: z.preprocess((val) => Number(val), z.number()).default(300),
  SUMMARY_TRIGGER_COUNT: z.preprocess((val) => Number(val), z.number()).default(10),

  // History Limits
  CHAT_HISTORY_LIMIT: z.preprocess((val) => Number(val), z.number()).default(20),

  // DB Pools
  DB_MAX_CONNECTIONS: z.preprocess((val) => Number(val), z.number()).default(20),

  // Contact Info (AI Logic)
  contact: z.object({
    email: z.string().default('enquiry@hangingpanda.com'),
    phone: z.string().default('+91-9311675528'),
    whatsapp: z.string().default('+91-9311675528'),
  }).default({
    email: 'enquiry@hangingpanda.com',
    phone: '+91-9311675528',
    whatsapp: '+91-9311675528',
  }),
});

export type ServiceConfig = BaseConfig & z.infer<typeof serviceEnvSchema>;

export const config: ServiceConfig = {
  ...baseConfig,
  ...serviceEnvSchema.parse(process.env),
};
