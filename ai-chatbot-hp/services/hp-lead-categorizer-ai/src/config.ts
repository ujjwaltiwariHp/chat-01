import { z } from "zod";
import { validateBaseConfig, BaseConfig } from "@hp-intelligence/core";

const baseConfig = validateBaseConfig();

const leadIntelligenceEnvSchema = z.object({
  SERVICE_NAME: z.string().default("hp-lead-intelligence"),
  CATEGORIZER_PORT: z
    .preprocess((val) => Number(val), z.number())
    .default(4002),
  DB_MAX_CONNECTIONS: z
    .preprocess((val) => Number(val), z.number())
    .default(20),
  LEAD_API_VERSION: z.string().default("v1"),
  LEAD_API_SUNSET_AT: z.string().optional(),
  LEAD_INTELLIGENCE_PREFIX: z.string().default("/lead-intelligence"),
  LEAD_IDEMPOTENCY_TTL_SECONDS: z
    .preprocess((val) => Number(val), z.number())
    .default(60 * 60 * 24),
  LEAD_QUEUE_PREFIX: z.string().default("hp:lead-intelligence"),
  LEAD_QUEUE_BACKPRESSURE_THRESHOLD: z
    .preprocess((val) => Number(val), z.number())
    .default(500),
  LEAD_SERVICE_OPENAI_API_KEY: z.string().min(1).optional(),
  LEAD_NORMALIZATION_MODEL: z
    .string()
    .default(process.env.OPENAI_MODEL || "gpt-4o-mini"),
  LEAD_BASIC_ANALYSIS_MODEL: z.string().default("gpt-4o-mini"),
  LEAD_DEEP_ANALYSIS_MODEL: z.string().default("gpt-4o"),
  LEAD_DRAFT_MODEL: z.string().default("gpt-4o-mini"),
  LEAD_JUDGE_MODEL: z.string().default("gpt-4o-mini"),
  LEAD_EVAL_MODEL: z.string().default("gpt-4o"),
  LEAD_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  LEAD_SEMANTIC_CACHE_THRESHOLD: z
    .preprocess((val) => Number(val), z.number())
    .default(0.96),
  LEAD_MAX_INPUT_CHARS: z
    .preprocess((val) => Number(val), z.number())
    .default(20000),
  LEAD_MAX_COMPLETION_TOKENS: z
    .preprocess((val) => Number(val), z.number())
    .default(8000),
  LEAD_NORMALIZATION_MAX_TOKENS: z
    .preprocess((val) => Number(val), z.number())
    .default(4000),
  LEAD_BASIC_ANALYSIS_MAX_TOKENS: z
    .preprocess((val) => Number(val), z.number())
    .default(4000),
  LEAD_DEEP_ANALYSIS_MAX_TOKENS: z
    .preprocess((val) => Number(val), z.number())
    .default(8000),
  LEAD_DRAFT_MAX_TOKENS: z
    .preprocess((val) => Number(val), z.number())
    .default(2000),
  LEAD_SLACK_TIMEOUT_MS: z
    .preprocess((val) => Number(val), z.number())
    .default(10000),
  LEAD_WEBHOOK_TIMEOUT_MS: z
    .preprocess((val) => Number(val), z.number())
    .default(10000),
  LEAD_SOFT_WARNING_THRESHOLD: z
    .preprocess((val) => Number(val), z.number().min(0).max(1))
    .default(0.8),
  LEAD_DECAY_HOT_DAYS: z
    .preprocess((val) => Number(val), z.number())
    .default(3),
  LEAD_DECAY_WARM_DAYS: z
    .preprocess((val) => Number(val), z.number())
    .default(7),
  LEAD_RETENTION_DAYS_SOFT: z
    .preprocess((val) => Number(val), z.number())
    .default(30),
  LEAD_RETENTION_DAYS_HARD: z
    .preprocess((val) => Number(val), z.number())
    .default(90),
  LEAD_BYPASS_CACHE: z
    .preprocess((val) => val === "true", z.boolean())
    .default(false),
});

export type LeadIntelligenceConfig = BaseConfig &
  z.infer<typeof leadIntelligenceEnvSchema>;

export const config: LeadIntelligenceConfig = {
  ...baseConfig,
  ...leadIntelligenceEnvSchema.parse(process.env),
};
