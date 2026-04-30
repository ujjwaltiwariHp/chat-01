import OpenAI from "openai";
import { Redactor, decrypt, redis } from "@hp-intelligence/core";
import { z } from "zod";
import { config } from "@/config.js";
import type {
  DraftType,
  LeadClassification,
  LeadEmailDraftResult,
  LeadSource,
  LeadStatus,
} from "@/types/lead-intelligence.js";

import * as prompts from "../prompts/prompts.js";
import { aiCostCounter, aiTokensCounter } from "@/utils/metrics.js";
import { callLLMWithValidation } from "@/ai/llm.js";
import { createLeadLogger } from "@/logging/logger.js";
import {
  normalizeEmail,
  normalizeOptionalString,
  normalizePhone,
  normalizeComparable,
} from "@/utils/normalization.js";
import { ScoringFactorSchema } from "@/ai/common.js";
import { PROMPT_VERSIONS, Stage } from "../prompts/versions.js";

const ExtractedContextSchema = z.object({
  mentioned_budget: z.string().nullable().optional().default(null),
  mentioned_timeline: z.string().nullable().optional().default(null),
  mentioned_services: z.array(z.string()).default([]),
  mentioned_industry: z.string().nullable().optional().default(null),
  mentioned_company_size: z.string().nullable().optional().default(null),
  other_signals: z.array(z.string()).default([]),
});

const DEFAULT_EXTRACTED_CONTEXT = {
  mentioned_services: [],
  other_signals: [],
  mentioned_budget: null,
  mentioned_timeline: null,
  mentioned_industry: null,
  mentioned_company_size: null,
};

/**
 * A/B Testing Infrastructure
 * Provides tenant-bucketed selection for prompt versions to support canary rollouts.
 */
export class PromptVersionService {
  static resolveVersion(
    tenantId: string | null,
    feature: keyof typeof PROMPT_VERSIONS.prod,
    baseVersion?: string,
  ): string {
    const stage = (process.env.NODE_ENV || "dev") as Stage;
    const versions = PROMPT_VERSIONS[stage] || PROMPT_VERSIONS.dev;

    const envVersion = versions[feature];
    if (envVersion) return envVersion;

    if (!tenantId) return baseVersion || "1.0.0";

    // Simple deterministic bucketing (CRC32 style) for canary rollouts
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = (hash << 5) - hash + tenantId.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;

    // G82: Canary logic - 10% of tenants get the canary version if available
    if (bucket < 10 && stage === "prod") {
      return PROMPT_VERSIONS.canary[feature] || baseVersion || "1.0.0";
    }

    return baseVersion || "1.0.0";
  }
}

export const LeadNormalizationSchema = z.object({
  name: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  company_name: z.string().nullable().optional().default(null),
  source_type: z.enum(["chatbot", "form", "manual"]).default("manual"),
  message_summary: z.string().max(2000).default("No summary provided."),
  raw_requirements: z.string().nullable().default(null),
  detected_language: z
    .enum([
      "en",
      "hi",
      "gu",
      "mr",
      "ta",
      "te",
      "kn",
      "ml",
      "bn",
      "pa",
      "es",
      "fr",
      "de",
      "ja",
      "zh",
      "ar",
      "pt",
      "it",
      "ru",
      "ko",
      "unknown",
    ])
    .default("en"),
  contact_preference: z
    .enum(["phone", "email", "whatsapp", "not_specified"])
    .default("not_specified"),
  extracted_context: ExtractedContextSchema.nullable()
    .optional()
    .default(DEFAULT_EXTRACTED_CONTEXT),
  evidence: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      company: z.string().nullable(),
    })
    .describe("The exact snippet from raw data where this identity was found")
    .default({ name: null, email: null, phone: null, company: null }),
  is_spam: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(1),
  needs_human_review: z.boolean().default(false),
  prompt_version: z.string().default("1.1.0"),
  schema_version: z.string().default("1.1.0"),
});

/**
 * Basic Analysis (Standard Intelligence)
 */
const DEFAULT_EXTRACTED_ATTRIBUTES = {
  service_needed: null,
  industry: null,
  budget_range: null,
  timeline: null,
  company_size: null,
  decision_stage: "unknown" as const,
  contact_preference: null,
};

export const BasicAnalysisSchema = z.object({
  summary: z.string().default("Lead intelligence brief."),
  classification: z
    .enum(["HOT", "WARM", "COLD", "UNQUALIFIED"])
    .default("COLD"),
  intent: z
    .enum(["READY_TO_START", "EVALUATING", "RESEARCHING", "UNKNOWN"])
    .default("UNKNOWN"),
  classification_reasoning: z
    .string()
    .default("Analysis based on provided ICP and lead data."),
  scoring_factors: z.array(ScoringFactorSchema).default([]),
  extracted_attributes: z
    .object({
      service_needed: z.string().nullable().default(null),
      industry: z.string().nullable().default(null),
      budget_range: z.string().nullable().default(null),
      timeline: z.string().nullable().default(null),
      company_size: z.string().nullable().default(null),
      decision_stage: z
        .enum([
          "ready_to_start",
          "evaluating_options",
          "exploring",
          "just_researching",
          "unknown",
        ])
        .default("unknown"),
      contact_preference: z.string().nullable().default(null),
    })
    .default(DEFAULT_EXTRACTED_ATTRIBUTES),
  risk_flags: z.array(z.string()).default([]),
  suggested_action: z.string().default("Follow up with lead."),
  conversation_highlights: z
    .array(
      z.object({
        lead_quote: z.string(),
        significance: z.string(),
      }),
    )
    .nullable()
    .optional()
    .default([]),
  competitive_signals: z.array(z.string()).nullable().optional().default([]),
  objection_predictions: z.array(z.string()).nullable().optional().default([]),
  detailed_action_plan: z.array(z.string()).nullable().optional().default([]),
  citations: z
    .array(
      z.object({
        claim: z.string(),
        evidence: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(1),
  needs_human_review: z.boolean().default(false),
  review_reason: z.string().nullable().optional().default(null),
  prompt_version: z.string().default("1.1.0"),
  schema_version: z.string().default("1.1.0"),
});

export const LeadAnalysisSchema = BasicAnalysisSchema;

/**
 * G85: Deep Analysis (Extends Basic with Narrative/Competitor focus)
 * Used for on-demand deep-dive analysis requests.
 */
export const DeepAnalysisSchema = BasicAnalysisSchema.extend({
  narrative_summary: z
    .string()
    .describe("Long-form executive summary of the lead opportunity")
    .default("No narrative summary provided."),
  competitor_intel: z
    .array(
      z.object({
        competitor: z.string(),
        sentiment: z.enum(["positive", "negative", "neutral"]),
        comparison_points: z.array(z.string()),
      }),
    )
    .default([]),
  swot_analysis: z
    .object({
      strengths: z.array(z.string()).default([]),
      weaknesses: z.array(z.string()).default([]),
      opportunities: z.array(z.string()).default([]),
      threats: z.array(z.string()).default([]),
    })
    .default({ strengths: [], weaknesses: [], opportunities: [], threats: [] }),
  deal_execution_strategy: z
    .array(z.string())
    .describe(
      "Step-by-step psychological/business approach for this specific lead",
    )
    .default([]),
});

export const LeadEmailDraftSchema = z.object({
  draftType: z.enum(["follow_up", "meeting_request", "discovery"]).optional(),
  subject: z.string().max(200).optional(), // G86: Tighten caps
  body: z.string().max(5000).optional(), // G86: Tighten caps
  prompt_version: z.string().default("1.0.0"),
  schema_version: z.string().default("1.0.0"),
});

const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o-mini": { prompt: 0.15 / 1_000_000, completion: 0.6 / 1_000_000 },
  "gpt-4o": { prompt: 2.5 / 1_000_000, completion: 10 / 1_000_000 },
};

const stripMarkdownCodeFences = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
};

export class LeadIntelligenceAIService {
  private log = createLeadLogger("ai:service");

  public async callLLMWithValidation<T extends z.ZodTypeAny>(
    params: Parameters<typeof this.completeJson<T>>[0],
  ) {
    return this.completeJson<T>(params);
  }

  private async completeJson<T extends z.ZodTypeAny>({
    apiKey,
    model,
    systemPrompt,
    userMessage,
    schema,
    maxTokens = config.LEAD_MAX_COMPLETION_TOKENS,
    temperature = 0.1,
  }: {
    apiKey?: string | null;
    model: string;
    systemPrompt: string;
    userMessage: string;
    schema: T;
    maxTokens?: number;
    temperature?: number;
  }) {
    // Sandbox deterministic pipeline (Zero temperature for sandbox keys)
    const activeTemperature = apiKey?.startsWith("sandbox_") ? 0 : temperature;

    // Handle gpt-4o-mini-latest experimental alias
    const activeModel =
      model === "gpt-4o-mini-latest" && !apiKey?.startsWith("sandbox_")
        ? config.LEAD_NORMALIZATION_MODEL // In production we pin, but alias allows eval runner to target it
        : model;

    return callLLMWithValidation({
      apiKey: apiKey?.startsWith("sandbox_") ? null : apiKey, // Sandbox keys use internal fallback/mock in real apps, here we just force deterministic
      model: activeModel,
      systemPrompt,
      userMessage,
      schema,
      schemaName: "AIOutput", // Default name for the schema
      maxTokens,
      temperature: activeTemperature,
    });
  }

  normalizeStoredApiKey(encryptedApiKey?: string | null) {
    if (!encryptedApiKey) {
      return null;
    }

    return decrypt(encryptedApiKey);
  }

  async normalizeLead(params: {
    apiKey?: string | null;
    source: LeadSource;
    rawPayload: Record<string, unknown>;
    tenantId?: string | null;
    tenantName?: string | null;
  }) {
    // G54: Deterministic normalization for form leads (Zod gate)
    // If it's a form and already has structured data that passes validation, skip LLM.
    if (params.source === "form" && params.rawPayload.email) {
      try {
        const directData = {
          name: normalizeOptionalString(
            params.rawPayload.name || params.rawPayload.fullName,
          ),
          email: normalizeEmail(params.rawPayload.email as string),
          phone: normalizePhone(params.rawPayload.phone as string),
          company_name: normalizeOptionalString(
            params.rawPayload.company_name || params.rawPayload.company,
          ),
          source_type: "form" as const,
          message_summary:
            normalizeOptionalString(
              params.rawPayload.message || params.rawPayload.summary,
            ) || "Form submission received.",
          raw_requirements: JSON.stringify(params.rawPayload),
          detected_language:
            (params.rawPayload.detected_language as string) || "en",
          contact_preference: "not_specified" as const,
          extracted_context: DEFAULT_EXTRACTED_CONTEXT,
          evidence: {
            name: normalizeOptionalString(
              params.rawPayload.name || params.rawPayload.fullName,
            ),
            email: normalizeEmail(params.rawPayload.email as string),
            phone: normalizePhone(params.rawPayload.phone as string),
            company: normalizeOptionalString(
              params.rawPayload.company_name || params.rawPayload.company,
            ),
          },
          is_spam: false,
          confidence: 1.0,
          schema_version: "1.1.0",
          prompt_version: "deterministic-gate",
        };

        const parsed = LeadNormalizationSchema.parse(directData);
        this.log.info(
          { leadEmail: parsed.email },
          "G54: Skipping LLM - Form lead passed deterministic Zod gate",
        );
        return {
          data: parsed,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          costEstimate: 0,
          raw: "deterministic",
        };
      } catch (e) {
        this.log.info(
          "Deterministic gate failed, falling back to LLM normalization",
        );
      }
    }

    const systemPrompt = prompts.NORMALIZATION_SYSTEM_PROMPT;
    let userMessage = "";
    let tokenMap: Record<string, string> = {};

    if (params.source === "chatbot") {
      const messages = (params.rawPayload.transcript as any[]) || [];
      const transcript = messages
        .map((m: any) => `${m.role || "user"}: ${m.content || ""}`)
        .join("\n");

      const transcriptInput = {
        transcript,
        visitor: params.rawPayload.visitor || {},
      };

      userMessage = prompts.CHATBOT_USER_PROMPT(
        transcriptInput.transcript,
        transcriptInput.visitor || {},
      );
    } else if (params.source === "form") {
      userMessage = prompts.FORM_USER_PROMPT(
        params.rawPayload,
        (params.rawPayload.metadata as any)?.form_source_url,
      );
    } else {
      userMessage = prompts.MANUAL_USER_PROMPT(
        params.rawPayload,
        (params.rawPayload.metadata as any)?.entered_by_name || "Admin",
        (params.rawPayload.metadata as any)?.notes || "",
      );
    }

    const result = await this.completeJson({
      apiKey:
        params.apiKey ||
        config.LEAD_SERVICE_OPENAI_API_KEY ||
        config.OPENAI_API_KEY,
      model: config.LEAD_NORMALIZATION_MODEL,
      systemPrompt,
      userMessage,
      schema: LeadNormalizationSchema,
      maxTokens: config.LEAD_NORMALIZATION_MAX_TOKENS,
    });

    return {
      ...result,
      data: result.data,
    };
  }

  async analyzeLead(params: {
    apiKey?: string | null;
    tier: "basic" | "deep";
    model?: string;
    tenantName?: string | null;
    icpProfile?: Record<string, unknown> | null;
    lead: Record<string, unknown>;
    promptOverride?: string;
  }) {
    this.log.info(
      { leadId: (params.lead as any).id, tier: params.tier },
      ">>> AI Analysis Starting",
    );
    const model =
      params.model ||
      (params.tier === "deep"
        ? config.LEAD_DEEP_ANALYSIS_MODEL
        : config.LEAD_BASIC_ANALYSIS_MODEL);

    const resolvedApiKey =
      params.apiKey ||
      config.LEAD_SERVICE_OPENAI_API_KEY ||
      config.OPENAI_API_KEY;

    const systemPrompt = prompts.ANALYSIS_SYSTEM_PROMPT(params.tier);
    const redactedLead = Redactor.redactStructuredData(params.lead);
    const userMessage = prompts.ANALYSIS_USER_PROMPT(
      params.icpProfile || {},
      (params.icpProfile as any)?.additional_context || "",
      redactedLead.redactedData,
      (params.lead as any).source_type || "unknown",
      (params.lead as any).created_at || new Date().toISOString(),
    );

    const result = await this.completeJson({
      apiKey: resolvedApiKey,
      model,
      systemPrompt,
      userMessage,
      schema: params.tier === "deep" ? DeepAnalysisSchema : LeadAnalysisSchema,
      maxTokens:
        params.tier === "deep"
          ? config.LEAD_DEEP_ANALYSIS_MAX_TOKENS
          : config.LEAD_BASIC_ANALYSIS_MAX_TOKENS,
      temperature: params.tier === "deep" ? 0.2 : 0.1,
    });

    const normalizedAnalysis = {
      ...result.data,
      classification: result.data.classification || "COLD",
    };

    return {
      ...result,
      data: Redactor.restoreStructuredData(
        normalizedAnalysis,
        redactedLead.tokenMap,
      ),
    };
  }

  async draftEmail(params: {
    apiKey?: string | null;
    type: DraftType;
    lead: Record<string, unknown>;
    latestAnalysis?: Record<string, unknown> | null;
    timeSlots?: string[];
    tenantName?: string | null;
    senderName?: string | null;
  }) {
    // G53: Email draft exact-match cache
    const leadId = params.lead.id;
    const analysisId = (params.latestAnalysis as any)?.id;
    const cacheKey = `lead-categorizer:draft:${leadId}:${params.type}:${analysisId}`;

    if (leadId && analysisId) {
      const cached = await redis.get(cacheKey);
      if (cached && !config.LEAD_BYPASS_CACHE) {
        this.log.info(
          { leadId, type: params.type },
          "G53: Cache hit for email draft",
        );
        return JSON.parse(cached);
      }
    }

    const systemPrompt = prompts.DRAFT_SYSTEM_PROMPTS[params.type];
    const redactedPromptInput = Redactor.redactStructuredData({
      tenantName: params.tenantName || "HangingPanda",
      senderName: params.senderName || "Account Manager",
      lead: params.lead,
      latestAnalysis: params.latestAnalysis || {},
      timeSlots: params.timeSlots || [],
    });

    const userMessage = [
      `Your company name: ${(redactedPromptInput.redactedData as any).tenantName}`,
      `Your sender name: ${(redactedPromptInput.redactedData as any).senderName}`,
      `Lead info:`,
      JSON.stringify((redactedPromptInput.redactedData as any).lead, null, 2),
      `Analysis:`,
      JSON.stringify(
        (redactedPromptInput.redactedData as any).latestAnalysis || {},
        null,
        2,
      ),
      params.type === "meeting_request"
        ? `Available time slots: ${JSON.stringify((redactedPromptInput.redactedData as any).timeSlots || [])}`
        : "",
    ].join("\n");

    const result = await this.completeJson({
      apiKey:
        params.apiKey ||
        config.LEAD_SERVICE_OPENAI_API_KEY ||
        config.OPENAI_API_KEY,
      model: config.LEAD_DRAFT_MODEL,
      systemPrompt,
      userMessage,
      schema: LeadEmailDraftSchema,
      maxTokens: config.LEAD_DRAFT_MAX_TOKENS,
      temperature: 0.4,
    });

    const finalResult = {
      ...result,
      data: Redactor.restoreStructuredData(
        {
          ...result.data,
          draftType: result.data.draftType || params.type,
        } as LeadEmailDraftResult,
        redactedPromptInput.tokenMap,
      ),
    };

    if (leadId && analysisId) {
      // Cache for 24 hours
      await redis.set(cacheKey, JSON.stringify(finalResult), "EX", 86400);
    }

    return finalResult;
  }

  inferAutomaticDraftType(params: {
    extractedAttributes?: Record<string, unknown> | null;
    timeSlots?: string[];
  }): DraftType {
    if (params.timeSlots && params.timeSlots.length > 0) {
      return "meeting_request";
    }

    const attr = params.extractedAttributes as any;
    const concreteCount = [
      attr?.budget_range,
      attr?.timeline,
      attr?.service_needed,
      attr?.industry,
      attr?.company_size,
    ].filter((v) => v && v !== "null" && v !== "unknown").length;

    return concreteCount >= 3 ? "follow_up" : "discovery";
  }

  /**
   * Batch API harness for eval runs + historical re-analysis SKU
   * Prepares and submits a batch job to OpenAI for cost-effective (50% off) processing.
   */
  async createBatchJob(
    apiKey: string | null,
    jsonlContent: string,
    metadata: Record<string, string> = {},
  ) {
    this.log.info({ metadata }, "G52: Preparing OpenAI Batch submission");
    const resolvedApiKey =
      apiKey?.trim() ||
      config.LEAD_SERVICE_OPENAI_API_KEY?.trim() ||
      config.OPENAI_API_KEY;
    if (!resolvedApiKey) throw new Error("API Key required for Batch API");

    const client = new OpenAI({ apiKey: resolvedApiKey });

    // 1. Upload the file
    const file = await client.files.create({
      file: await OpenAI.toFile(Buffer.from(jsonlContent), "batch_input.jsonl"),
      purpose: "batch",
    });

    // 2. Create the batch
    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
      metadata,
    });

    this.log.info(
      { batchId: batch.id },
      "G52: OpenAI Batch job created successfully",
    );
    return batch;
  }

  /**
   * LLM-as-judge harness + rubric for automated regression evals
   * Uses an 'Expert Judge' model to grade a result against a ground-truth rubric.
   */
  async evaluateResult(params: {
    apiKey?: string | null;
    rubric: string;
    actualOutput: any;
    expectedOutput: any;
  }) {
    const systemPrompt = `You are a Lead Intelligence QA Judge. Grade the actual output against the expected output using the provided rubric. Respond with JSON { "score": 0-1, "reasoning": "...", "passed": boolean }`;
    const userMessage = `RUBRIC: ${params.rubric}\nEXPECTED: ${JSON.stringify(params.expectedOutput)}\nACTUAL: ${JSON.stringify(params.actualOutput)}`;

    return this.completeJson({
      apiKey: params.apiKey,
      model: config.LEAD_EVAL_MODEL, // Higher intelligence for judging
      systemPrompt,
      userMessage,
      schema: z.object({
        score: z.number().min(0).max(1),
        reasoning: z.string(),
        passed: z.boolean(),
      }),
      temperature: 0,
    });
  }

  /**
   * Uses text-embedding-3-small to convert text into a 1536-dimensional vector.
   */
  async generateEmbedding(
    apiKey: string | null,
    text: string,
  ): Promise<number[]> {
    const resolvedApiKey =
      apiKey?.trim() ||
      config.LEAD_SERVICE_OPENAI_API_KEY?.trim() ||
      config.OPENAI_API_KEY;
    const client = new OpenAI({ apiKey: resolvedApiKey });

    const response = await client.embeddings.create({
      model: config.LEAD_EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  }

  /**
   * G68: Find Similar Lead Analysis
   * Searches for previous analyses with high cosine similarity (>0.95).
   */
  async findSimilarAnalysis(
    tenantId: string,
    message: string,
    threshold: number = 0.95,
  ) {
    // This will be called from LeadIntelligenceService which has DB access
    return null;
  }

  /**
   * LLM-as-a-Judge: Automated Hallucination Guard
   * Uses a secondary model call to verify if the primary model's "Citations" are actually grounded.
   */
  async validateAnalysisWithJudge(params: {
    apiKey?: string | null;
    lead: any;
    analysis: any;
  }) {
    const systemPrompt = `You are an AI Hallucination Guard. Compare the AI Analysis against the Raw Lead Data.
Your goal is to detect 'hallucinations' (claims made in the analysis that are NOT in the raw data).

Verify:
1. Is the 'Company Name' actually in the text?
2. Are 'Budget' or 'Intent' claims supported by specific quotes?
3. Are 'Risk Flags' grounded in reality?

Respond in JSON: { "is_grounded": boolean, "hallucinated_fields": string[], "reasoning": "..." }`;

    const userMessage = `RAW LEAD DATA: ${JSON.stringify(params.lead)}\nAI ANALYSIS: ${JSON.stringify(params.analysis)}`;

    return this.completeJson({
      apiKey: params.apiKey,
      model: config.LEAD_JUDGE_MODEL, // Use mini for speed/cost for judging
      systemPrompt,
      userMessage,
      schema: z.object({
        is_grounded: z.boolean(),
        hallucinated_fields: z.array(z.string()),
        reasoning: z.string(),
      }),
      temperature: 0,
    });
  }

  classificationToLeadStatus(classification: LeadClassification): LeadStatus {
    if (classification === "UNQUALIFIED") return "junk";
    return "analyzed";
  }

  /**
   * Verifies that AI-extracted attributes have some basis in the raw normalized data.
   */
  verifyGrounding(
    lead: any,
    analysis: any,
  ): { isGrounded: boolean; reason?: string } {
    const summary = lead.normalizedData?.message_summary || "";
    const requirements = lead.normalizedData?.raw_requirements || "";
    const raw = (summary + " " + requirements).toLowerCase();

    const attributes = analysis.extracted_attributes || {};
    const suspiciousFields: string[] = [];

    for (const [key, value] of Object.entries(attributes)) {
      if (
        value &&
        typeof value === "string" &&
        value !== "unknown" &&
        value !== "null" &&
        value.length > 2
      ) {
        // Simple heuristic: check if significant words from the value appear in the source text
        const words = value
          .toLowerCase()
          .split(/[\s,._-]+/)
          .filter((w) => w.length > 3);
        if (words.length > 0) {
          const matchCount = words.filter((w) => raw.includes(w)).length;
          if (matchCount === 0) {
            suspiciousFields.push(key);
          }
        }
      }
    }

    if (suspiciousFields.length > 0) {
      return {
        isGrounded: false,
        reason: `Potential hallucination in fields: ${suspiciousFields.join(", ")}`,
      };
    }

    return { isGrounded: true };
  }
}

export const leadIntelligenceAIService = new LeadIntelligenceAIService();
export default leadIntelligenceAIService;
