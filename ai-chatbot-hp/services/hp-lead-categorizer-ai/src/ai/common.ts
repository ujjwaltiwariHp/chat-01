import { z } from "zod";

/**
 * Deduplicated Scoring Factor Schema
 * Standardized format for AI-driven scoring feedback.
 */
export const ScoringFactorSchema = z.object({
  factor: z.string(),
  value: z.string().default("Yes"),
  impact: z.enum(["positive", "negative", "neutral"]).default("neutral"),
});
