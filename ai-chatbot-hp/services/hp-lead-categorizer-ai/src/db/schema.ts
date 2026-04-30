import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  decimal,
  boolean,
  bigint,
  vector,
} from "drizzle-orm/pg-core";
import { sql, isNull, eq, desc } from "drizzle-orm";
import { tenants, users } from "@hp-intelligence/core";

export const icpProfiles = pgTable(
  "lead_intelligence_icp_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Standard ICP"), // Multi-ICP
    isDefault: boolean("is_default").notNull().default(false), // Multi-ICP
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    targetIndustries: jsonb("target_industries").$type<string[]>().notNull(),
    companySizeRange: text("company_size_range").notNull(),
    budgetRangeMin: bigint("budget_range_min", { mode: "number" }).notNull(),
    budgetRangeMax: bigint("budget_range_max", { mode: "number" }).notNull(),
    dealBreakerSignals: jsonb("deal_breaker_signals")
      .$type<string[]>()
      .notNull(),
    strongFitSignals: jsonb("strong_fit_signals").$type<string[]>().notNull(),
    servicesOffered: jsonb("services_offered").$type<string[]>().notNull(),
    targetPersonas: jsonb("target_personas").$type<string[]>().default([]),
    negativePersonas: jsonb("negative_personas").$type<string[]>().default([]),
    additionalContext: text("additional_context"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lead_icp_profiles_tenant_idx").on(table.tenantId),
    index("lead_icp_profiles_active_idx").on(table.isActive),
  ],
);

export const leadIntelligenceUsageEvents = pgTable(
  "lead_intelligence_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // lead_categorized, lead_normalized, email_drafted
    modelUsed: text("model_used"),
    promptVersion: text("prompt_version"),
    tokensUsed: bigint("tokens_used", { mode: "number" }).default(0),
    costUsdCents: bigint("cost_usd_cents", { mode: "number" }).default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_usage_events_tenant_idx").on(table.tenantId),
    index("lead_usage_events_type_idx").on(table.eventType),
    index("lead_usage_events_created_idx").on(table.createdAt),
  ],
);

export const leads = pgTable(
  "lead_intelligence_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: text("status").notNull().default("new"),
    lifecycleStage: text("lifecycle_stage").notNull().default("lead"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    companyName: text("company_name"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    normalizedData: jsonb("normalized_data").$type<Record<
      string,
      unknown
    > | null>(),
    confidence: decimal("confidence", { precision: 3, scale: 2 }).default(
      "1.00",
    ),
    needsHumanReview: boolean("needs_human_review").default(false),
    reviewReason: text("review_reason"),
    classification: text("classification"),
    classificationHistory: jsonb("classification_history")
      .$type<
        Array<{ classification: string; timestamp: string; reason: string }>
      >()
      .default([]),
    externalId: text("external_id"),
    assignedTo: uuid("assigned_to").references(() => (users as any).id, {
      onDelete: "set null",
    }),
    freezeUntil: timestamp("freeze_until"),
    staleAt: timestamp("stale_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_leads_tenant_idx").on(table.tenantId),
    index("lead_intelligence_leads_external_id_idx").on(table.externalId),
    index("lead_intelligence_leads_email_idx").on(table.email),
    index("lead_intelligence_leads_phone_idx").on(table.phone),
    index("lead_intelligence_leads_status_idx").on(table.status),
    index("lead_intelligence_leads_lifecycle_idx").on(table.lifecycleStage),
    index("lead_intelligence_leads_classification_idx").on(
      table.classification,
    ),
    index("lead_intelligence_leads_created_at_idx").on(table.createdAt),
    index("lead_intelligence_leads_tenant_email_idx").on(
      table.tenantId,
      table.email,
    ),
    index("lead_intelligence_leads_active_idx")
      .on(table.tenantId)
      .where(sql`deleted_at IS NULL AND status != 'junk'`),
    index("lead_intelligence_leads_decay_idx")
      .on(table.staleAt)
      .where(sql`classification IN ('HOT', 'WARM')`),
  ],
);

export const leadAnalyses = pgTable(
  "lead_intelligence_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    modelUsed: text("model_used").notNull(),
    analysisTier: text("analysis_tier").notNull(),
    analysisDepth: text("analysis_depth").notNull(),
    summary: text("summary").notNull(),
    classification: text("classification").notNull(),
    intent: text("intent").notNull().default("UNKNOWN"),
    promptVersion: text("prompt_version").notNull().default("1.0.0"),
    schemaVersion: text("schema_version").notNull().default("1.0.0"),
    confidence: decimal("confidence", { precision: 3, scale: 2 })
      .notNull()
      .default("1.00"),
    needsHumanReview: boolean("needs_human_review").notNull().default(false),
    reviewReason: text("review_reason"),
    classificationReasoning: text("classification_reasoning").notNull(),
    scoringFactors: jsonb("scoring_factors")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    extractedAttributes: jsonb("extracted_attributes")
      .$type<Record<string, unknown>>()
      .notNull(),
    riskFlags: jsonb("risk_flags").$type<string[]>().notNull(),
    suggestedAction: text("suggested_action").notNull(),
    conversationHighlights: jsonb("conversation_highlights").$type<
      string[] | null
    >(),
    competitiveSignals: jsonb("competitive_signals").$type<string[] | null>(),
    objectionPredictions: jsonb("objection_predictions").$type<
      string[] | null
    >(),
    detailedActionPlan: jsonb("detailed_action_plan").$type<string[] | null>(),
    citations: jsonb("citations")
      .$type<Array<{ claim: string; evidence: string; confidence: number }>>()
      .notNull()
      .default([]),
    feedback: jsonb("feedback").$type<Record<string, unknown> | null>(),
    icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id),
    tokensUsed: bigint("tokens_used", { mode: "number" }).notNull().default(0),
    costEstimateCents: bigint("cost_estimate_cents", { mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_analyses_tenant_idx").on(table.tenantId),
    index("lead_intelligence_analyses_lead_idx").on(table.leadId),
    index("lead_intelligence_analyses_created_at_idx").on(table.createdAt),
  ],
);

export const leadEmailDrafts = pgTable(
  "lead_intelligence_email_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    draftType: text("draft_type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    modelUsed: text("model_used").notNull(),
    copiedAt: timestamp("copied_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_email_drafts_tenant_idx").on(table.tenantId),
    index("lead_intelligence_email_drafts_lead_idx").on(table.leadId),
  ],
);

export const leadActivities = pgTable(
  "lead_intelligence_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => (users as any).id, {
      onDelete: "set null",
    }),
    activityType: text("activity_type").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_activities_lead_idx").on(table.leadId),
    index("lead_intelligence_activities_tenant_idx").on(table.tenantId),
    index("lead_intelligence_activities_created_at_idx").on(table.createdAt),
  ],
);

export const routingRules = pgTable(
  "lead_intelligence_routing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    priority: integer("priority").notNull(),
    // G73: Composition
    ruleGroup: text("rule_group"), // e.g., 'group_A'
    logicalOperator: text("logical_operator").notNull().default("AND"), // 'AND' | 'OR'
    // G75: Territory/Geo/Deal-size
    territory: text("territory"),
    geoAllowlist: jsonb("geo_allowlist").$type<string[]>(),
    minDealSizeCents: bigint("min_deal_size_cents", { mode: "number" }),

    conditionField: text("condition_field").notNull(),
    conditionOperator: text("condition_operator").notNull(),
    conditionValue: text("condition_value").notNull(),
    actionAssignTo: uuid("action_assign_to").references(
      () => (users as any).id,
      { onDelete: "set null" },
    ),
    actionAssignTeam: uuid("action_assign_team"), // G74: Team assignment
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_routing_rules_tenant_idx").on(table.tenantId),
    index("lead_intelligence_routing_rules_active_idx")
      .on(table.tenantId)
      .where(eq(table.isActive, true)),
  ],
);

export const webhookConfigs = pgTable(
  "lead_intelligence_webhook_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_intelligence_webhook_configs_tenant_idx").on(table.tenantId),
  ],
);

export const leadServiceSettings = pgTable(
  "lead_intelligence_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    slackWebhookUrl: text("slack_webhook_url"),
    openaiApiKeyEncrypted: text("openai_api_key_encrypted"),
    previousOpenaiApiKeyEncrypted: text("previous_openai_api_key_encrypted"),
    rotatedAt: timestamp("rotated_at"),
    consentData: jsonb("consent_data")
      .$type<{ enabled: boolean; text: string }>()
      .default({ enabled: false, text: "" }),
    costLimitDailyCents: bigint("cost_limit_daily_cents", {
      mode: "number",
    }).default(1000),
    // Advanced Maintenance
    decayConfig: jsonb("decay_config")
      .$type<{
        overrides: Array<{
          source?: string;
          classification?: string;
          days: number;
        }>;
        defaultDays: number;
      }>()
      .default({ overrides: [], defaultDays: 30 }),
    timezone: text("timezone").default("UTC"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_intelligence_settings_tenant_uidx").on(table.tenantId),
    index("lead_intelligence_settings_tenant_idx").on(table.tenantId),
  ],
);

export const categorizationLogs = pgTable(
  "categorization_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    requestId: text("request_id"),
    source: text("source").notNull().default("direct-api"),
    type: text("type").notNull().default("raw"),
    rawInput: text("raw_input").notNull(),
    result: jsonb("result").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("categorizer_tenant_idx").on(table.tenantId),
    index("categorizer_request_id_idx").on(table.requestId),
    index("categorizer_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Labeling UI Context
 * Stores ground-truth labels provided by humans for model accuracy benchmarking.
 */
export const leadIntelligenceEvals = pgTable(
  "lead_intelligence_evals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => (leads as any).id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").references(() => (leadAnalyses as any).id, {
      onDelete: "set null",
    }),
    groundTruthClassification: text("ground_truth_classification").notNull(),
    groundTruthIntent: text("ground_truth_intent"),
    labelerEmail: text("labeler_email").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("lead_evals_tenant_idx").on(table.tenantId),
    index("lead_evals_lead_idx").on(table.leadId),
    uniqueIndex("lead_evals_lead_uidx").on(table.leadId),
  ],
);

/**
 * Request Logs Table
 * Provides auth-audit visibility for all AI operations.
 * retention: 90 days.
 */
export const requestLogs = pgTable(
  "lead_intelligence_request_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("request_logs_tenant_idx").on(table.tenantId),
    index("request_logs_created_at_idx").on(table.createdAt),
  ],
);

/**
 * G68/G69: Semantic Vector Storage
 * Stores high-dimensional embeddings of lead requirements for similarity search and caching.
 */
export const leadEmbeddings = pgTable(
  "lead_intelligence_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => (leads as any).id, { onDelete: "cascade" }),
    // OpenAI embeddings are 1536 dimensions
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    contextType: text("context_type").notNull(), // 'requirements', 'summary'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("lead_embeddings_tenant_idx").on(table.tenantId),
    index("lead_embeddings_vector_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

/**
 * Round-robin Teams
 * Supports balanced distribution of leads among team members.
 */
export const leadIntelligenceTeams = pgTable(
  "lead_intelligence_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lastAssignedIndex: integer("last_assigned_index").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("lead_teams_tenant_idx").on(table.tenantId)],
);

export const leadIntelligenceTeamMembers = pgTable(
  "lead_intelligence_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => leadIntelligenceTeams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => (users as any).id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("lead_team_members_team_idx").on(table.teamId),
    index("lead_team_members_user_idx").on(table.userId),
  ],
);

/**
 * Webhook Replay Storage
 * Stores historical webhook payloads for manual or automated re-delivery.
 */
export const leadIntelligenceWebhookLogs = pgTable(
  "lead_intelligence_webhook_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => (tenants as any).id, { onDelete: "cascade" }),
    webhookConfigId: uuid("webhook_config_id")
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("webhook_logs_tenant_idx").on(table.tenantId),
    index("webhook_logs_created_idx").on(table.createdAt),
  ],
);
