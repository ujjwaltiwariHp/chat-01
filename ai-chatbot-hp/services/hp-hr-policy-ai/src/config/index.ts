import { z } from 'zod';
import { validateBaseConfig, BaseConfig } from '@hp-intelligence/core';

const baseConfig = validateBaseConfig();

const serviceEnvSchema = z.object({
  SERVICE_NAME: z.string().default('hp-hr-policy-ai'),
  SESSION_SECRET: z.string().default(baseConfig.INTERNAL_SERVICE_TOKEN),
  JWT_SECRET: z.string().default(baseConfig.INTERNAL_SERVICE_TOKEN),
  HR_POLICY_PORT: z.preprocess((value: unknown) => Number(value), z.number()).default(4003),
  DB_MAX_CONNECTIONS: z.preprocess((value: unknown) => Number(value), z.number()).default(20),
  POLICY_HISTORY_LIMIT: z.preprocess((value: unknown) => Number(value), z.number()).default(8),
  POLICY_MAX_MESSAGE_LENGTH: z.preprocess((value: unknown) => Number(value), z.number()).default(2000),
  HR_POLICY_OPENAI_API_KEY: z.string().min(1).optional(),
  RAG_TOP_K: z.preprocess((value: unknown) => Number(value), z.number()).default(5),
  RAG_MIN_SCORE: z.preprocess((value: unknown) => Number(value), z.number()).default(0.35),
  RAG_CHUNK_SIZE: z.preprocess((value: unknown) => Number(value), z.number()).default(1200),
  RAG_CHUNK_OVERLAP: z.preprocess((value: unknown) => Number(value), z.number()).default(150),
  RAG_MAX_CONTEXT_CHUNKS: z.preprocess((value: unknown) => Number(value), z.number()).default(6),
  RAG_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  RAG_CHAT_MODEL: z.string().default(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
  VECTOR_DIMENSIONS: z.preprocess((value: unknown) => Number(value), z.number()).default(1536),
});

export type ServiceConfig = BaseConfig & z.infer<typeof serviceEnvSchema>;

export const config: ServiceConfig = {
  ...baseConfig,
  ...serviceEnvSchema.parse(process.env),
};
