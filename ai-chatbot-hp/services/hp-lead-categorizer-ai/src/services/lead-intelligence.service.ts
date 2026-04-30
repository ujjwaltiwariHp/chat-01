import crypto from "crypto";
import { Job, Queue } from "bullmq";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import { propagation, context } from "@opentelemetry/api";
import {
  ApiError,
  AuthError,
  createAIBillingEvent,
  encrypt,
  finalizeAIBillingEvent,
  getTenantCredits,
  redis,
  refundTenantCredits,
  reserveTenantCredits,
  users,
} from "@hp-intelligence/core";
import { config } from "@/config.js";
import { db } from "@/db/connection.js";
import { createLeadLogger } from "@/logging/logger.js";
import {
  icpProfiles,
  leadAnalyses,
  leads,
  leadIntelligenceUsageEvents,
  leadServiceSettings,
  routingRules,
  webhookConfigs,
  leadIntelligenceTeams,
  leadIntelligenceTeamMembers,
  categorizationLogs,
  leadIntelligenceEvals,
  leadIntelligenceWebhookLogs,
  leadEmbeddings,
} from "@/db/schema.js";
import {
  actionsQueue,
  analysisQueue,
  normalizationQueue,
  notificationsQueue,
} from "@/services/lead-intelligence-queue.service.js";
import {
  leadIntelligenceAIService,
  PromptVersionService,
} from "@/services/lead-intelligence-ai.service.js";
import {
  leadAnalysisCounter,
  leadAnalysisFallbackCounter,
  leadClassificationCounter,
  leadNormalizationCounter,
  leadsIngestedCounter,
  leadGateRejectedCounter,
  routingAssignmentCounter,
  slackNotificationCounter,
  webhookDeliveryCounter,
  rlsViolationCounter,
} from "@/utils/metrics.js";
import { IngestionValidator } from "@/utils/ingestion-validator.js";
import {
  checkDailyQuota,
  incrementDailyUsage,
  type DailyUsageUpdateResult,
} from "@/utils/billing.js";
import {
  normalizeEmail,
  normalizeOptionalString,
  normalizePhone,
  normalizeComparable,
  now,
} from "@/utils/normalization.js";
import type {
  AnalysisTier,
  LeadClassification,
  LeadSource,
  NormalizedLeadData,
  QueueJobResponse,
  WebhookEvent,
} from "@/types/lead-intelligence.js";
import { assertQueueCapacity } from "@/services/lead-intelligence-queue.service.js";

type IdentitySnapshot = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  externalId?: string | null;
};

type IngestLeadInput = {
  tenantId: string;
  requestId: string;
  source: LeadSource;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

type EnqueueOptions = {
  skipBackpressureCheck?: boolean;
};

const leadLogger = createLeadLogger("service");

const getAnalysisModelForTier = (tier: AnalysisTier, isFallback = false) => {
  if (isFallback && tier === "deep") {
    return config.LEAD_BASIC_ANALYSIS_MODEL;
  }
  return tier === "deep"
    ? config.LEAD_DEEP_ANALYSIS_MODEL
    : config.LEAD_BASIC_ANALYSIS_MODEL;
};

const ANALYSIS_CREDIT_COST = 1;

const isFinalJobAttempt = (job: Job) => {
  const attempts = Number(job.opts.attempts ?? 1);
  return job.attemptsMade + 1 >= attempts;
};

const toJsonSafeRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

class LeadIntelligenceService {
  private log = leadLogger;

  private async writeUsageEvent(params: {
    tenantId: string;
    eventType: string;
    modelUsed?: string;
    promptVersion?: string;
    tokensUsed?: number;
    costUsd?: number;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const costUsdCents = Math.ceil((params.costUsd || 0) * 100);
      await db.insert(leadIntelligenceUsageEvents).values({
        tenantId: params.tenantId,
        eventType: params.eventType,
        modelUsed: params.modelUsed || null,
        promptVersion: params.promptVersion || null,
        tokensUsed: params.tokensUsed || 0,
        costUsdCents,
        metadata: params.metadata || {},
      });
    } catch (error: any) {
      this.log.warn({ error: error.message }, "Failed to write usage event");
    }
  }

  private async reserveAnalysisCredit(params: {
    tenantId: string;
    leadId: string;
    tier: AnalysisTier;
    modelUsed: string;
  }) {
    const billingRequestId = crypto.randomUUID();
    const reservation = await reserveTenantCredits(
      db,
      params.tenantId,
      ANALYSIS_CREDIT_COST,
    );

    try {
      await createAIBillingEvent(db, {
        requestId: billingRequestId,
        tenantId: params.tenantId,
        service: "lead-categorizer",
        operation: `analysis-${params.tier}`,
        model: params.modelUsed,
        estimatedPromptTokens: ANALYSIS_CREDIT_COST,
        requestedCompletionTokens: 0,
        requestedTokenBudget: ANALYSIS_CREDIT_COST,
        reservedTokens: ANALYSIS_CREDIT_COST,
        metadata: {
          leadId: params.leadId,
          tier: params.tier,
          billingUnit: "analysis-credit",
          reservedCredits: ANALYSIS_CREDIT_COST,
          remainingCredits: reservation.remaining,
        },
        status: "reserved",
        requestOutcome: "pending",
      });
    } catch (error) {
      try {
        await refundTenantCredits(db, params.tenantId, ANALYSIS_CREDIT_COST);
      } catch (refundError: any) {
        this.log.error(
          {
            tenantId: params.tenantId,
            leadId: params.leadId,
            tier: params.tier,
            error: refundError.message,
          },
          "Failed to refund analysis credit after billing record creation failed",
        );
      }

      throw error;
    }

    return {
      billingRequestId,
      reservedCredits: ANALYSIS_CREDIT_COST,
      remainingCredits: reservation.remaining,
    };
  }

  private async finalizeAnalysisCredit(params: {
    tenantId: string;
    leadId: string;
    tier: AnalysisTier;
    billingRequestId?: string;
    success: boolean;
    errorMessage?: string | null;
  }) {
    if (!params.billingRequestId) {
      return;
    }

    if (!params.success) {
      try {
        await refundTenantCredits(db, params.tenantId, ANALYSIS_CREDIT_COST);
      } catch (refundError: any) {
        this.log.error(
          {
            tenantId: params.tenantId,
            leadId: params.leadId,
            tier: params.tier,
            requestId: params.billingRequestId,
            error: refundError.message,
          },
          "Failed to refund analysis credit after job failure",
        );
      }
    }

    try {
      await finalizeAIBillingEvent(db, {
        requestId: params.billingRequestId,
        status: params.success ? "settled" : "refunded",
        requestOutcome: params.success ? "succeeded" : "failed",
        actualPromptTokens: params.success ? ANALYSIS_CREDIT_COST : 0,
        actualCompletionTokens: 0,
        actualTotalTokens: params.success ? ANALYSIS_CREDIT_COST : 0,
        refundedTokens: params.success ? 0 : ANALYSIS_CREDIT_COST,
        additionalChargedTokens: 0,
        uncollectedTokens: 0,
        errorMessage: params.success ? null : params.errorMessage || null,
      });
    } catch (error: any) {
      if (error?.errorCodeSlug === "RESOURCE_NOT_FOUND") {
        this.log.debug(
          {
            tenantId: params.tenantId,
            leadId: params.leadId,
            tier: params.tier,
            requestId: params.billingRequestId,
          },
          "Skipping analysis billing finalization for legacy job without billing record",
        );
        return;
      }

      this.log.warn(
        {
          tenantId: params.tenantId,
          leadId: params.leadId,
          tier: params.tier,
          requestId: params.billingRequestId,
          error: error.message,
        },
        "Failed to finalize analysis billing record",
      );
    }
  }

  private getTraceContext() {
    const traceContext: Record<string, string> = {};
    propagation.inject(context.active(), traceContext);
    return traceContext;
  }

  private async maybeRecordSoftQuotaWarning(
    tenantId: string,
    usageUpdate: DailyUsageUpdateResult | null,
    metadata: Record<string, unknown>,
  ) {
    if (!usageUpdate?.softWarningTriggered) {
      return;
    }

    await this.writeUsageEvent({
      tenantId,
      eventType: "quota_soft_warning",
      costUsd: 0,
      metadata: {
        ...metadata,
        usage: usageUpdate.usage,
        limit: usageUpdate.limit,
        threshold: config.LEAD_SOFT_WARNING_THRESHOLD,
      },
    });
  }

  private buildIngestionEnvelope(
    source: LeadSource,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    return {
      latestSource: source,
      latestPayload: payload,
      ingestions: [
        {
          source,
          payload,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
        },
      ],
    } as Record<string, unknown>;
  }

  private deriveIdentityFromPayload(
    source: LeadSource,
    payload: Record<string, unknown>,
  ): IdentitySnapshot {
    if (source === "chatbot") {
      const visitor = toJsonSafeRecord(payload.visitor);
      return {
        name: normalizeOptionalString(visitor.name),
        email: normalizeEmail(visitor.email),
        phone: normalizePhone(visitor.phone),
        companyName: normalizeOptionalString(
          (payload.companyName as string | undefined) || visitor.companyName,
        ),
      };
    }

    return {
      name: normalizeOptionalString(
        (payload.name as string | undefined) ||
          (payload.fullName as string | undefined),
      ),
      email: normalizeEmail(
        (payload.email as string | undefined) ||
          (payload.emailAddress as string | undefined),
      ),
      phone: normalizePhone(
        (payload.phone as string | undefined) ||
          (payload.phoneNumber as string | undefined),
      ),
      companyName: normalizeOptionalString(
        (payload.companyName as string | undefined) ||
          (payload.company as string | undefined) ||
          (payload.organization as string | undefined),
      ),
      externalId: normalizeOptionalString(
        (payload.external_id as string | undefined) ||
          (payload.lead_id as string | undefined) ||
          (payload.id as string | undefined),
      ),
    };
  }

  private async validateCommonLeadPayload(
    source: LeadSource,
    payload: Record<string, unknown>,
  ) {
    const identity = this.deriveIdentityFromPayload(source, payload);

    // enhanced validation (MX, role-based, format)
    await IngestionValidator.validateLeadSourceData({
      email: identity.email || undefined,
      phone: identity.phone || undefined,
      source,
    });

    const honeypotKeys = ["website", "honeypot", "hp_field", "company_website"];
    const botField = honeypotKeys.find((key) =>
      normalizeOptionalString(payload[key]),
    );
    if (botField) {
      leadGateRejectedCounter.inc({ gate: "spam-guard" });
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        `Lead rejected by spam guard (${botField})`,
      );
    }

    const submissionTimeMs = Number(
      payload.submissionTimeMs ?? payload.submission_time_ms ?? 0,
    );
    if (submissionTimeMs > 0 && submissionTimeMs < 1000) {
      leadGateRejectedCounter.inc({ gate: "spam-guard" });
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        "Lead rejected by spam guard (submission too fast)",
      );
    }

    if (source === "chatbot" && !Array.isArray(payload.transcript)) {
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        "Chatbot ingestion requires a transcript array",
      );
    }
  }

  private async reserveIdempotencyKey(
    tenantId: string,
    idempotencyKey?: string | null,
  ) {
    if (!idempotencyKey) {
      return;
    }

    const redisKey = `${config.LEAD_QUEUE_PREFIX}:idempotency:${tenantId}:${idempotencyKey}`;
    const result = await redis.set(
      redisKey,
      new Date().toISOString(),
      "EX",
      config.LEAD_IDEMPOTENCY_TTL_SECONDS,
      "NX",
    );
    if (result !== "OK") {
      const error = new ApiError(
        "COMMON_VALIDATION_ERROR",
        "Duplicate request detected via X-Idempotency-Key",
      );
      error.statusCode = 409 as any;
      throw error;
    }
  }

  public async getSettingsRecord(tenantId: string) {
    const [settings] = await db
      .select()
      .from(leadServiceSettings)
      .where(eq(leadServiceSettings.tenantId, tenantId))
      .limit(1);

    return settings || null;
  }

  private async queueWebhookDeliveries(
    tenantId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ) {
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.tenantId, tenantId),
          eq(webhookConfigs.isActive, true),
        ),
      );

    const subscribedConfigs = configs.filter(
      (configRow: (typeof configs)[number]) =>
        Array.isArray(configRow.events) && configRow.events.includes(event),
    );

    this.log.debug(
      {
        tenantId,
        event,
        totalActive: configs.length,
        subscribedCount: subscribedConfigs.length,
      },
      "Checking webhook subscribers",
    );
    await Promise.all(
      subscribedConfigs.map(
        async (configRow: (typeof subscribedConfigs)[number]) => {
          const eventId = crypto.randomUUID();
          const deliveryId = crypto.randomUUID();

          await notificationsQueue.add("outbound-webhook", {
            tenantId,
            event,
            payload: {
              event_id: eventId,
              delivery_id: deliveryId,
              event,
              timestamp: new Date().toISOString(),
              tenant_id: tenantId,
              data,
            },
            webhookConfigId: configRow.id,
            traceContext: this.getTraceContext(),
          });
        },
      ),
    );
  }

  private async getIcpRecord(tenantId: string) {
    const profiles = await db
      .select()
      .from(icpProfiles)
      .where(
        and(eq(icpProfiles.tenantId, tenantId), eq(icpProfiles.isActive, true)),
      )
      .orderBy(desc(icpProfiles.isDefault));

    return profiles[0] || null;
  }

  async resolveTenantIdForInternalChatbotRequest(
    body: Record<string, unknown>,
    headerTenantId?: string,
  ) {
    const resolvedTenantId =
      headerTenantId || normalizeOptionalString(body.tenantId);
    if (!resolvedTenantId) {
      throw new ApiError(
        "COMMON_AUTH_ERROR",
        "Internal chatbot ingestion requires tenant context",
      );
    }

    return resolvedTenantId;
  }

  async ingestLead(
    input: IngestLeadInput,
    options: EnqueueOptions = {},
  ): Promise<QueueJobResponse> {
    await this.validateCommonLeadPayload(input.source, input.payload);

    // C13: Hard Disqualification Gate
    /*
    if (IngestionValidator.isHardDisqualified(input.payload)) {
      leadGateRejectedCounter.inc({ gate: "disqualification" });
      this.log.info(
        { source: input.source, tenantId: input.tenantId },
        "Lead rejected by hard disqualification gate",
      );
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        "Lead submission rejected (minimum quality criteria not met)",
      );
    }
    */

    const fallbackKey =
      input.source === "chatbot"
        ? normalizeOptionalString(input.payload.conversationId)
        : null;

    await this.reserveIdempotencyKey(
      input.tenantId,
      input.idempotencyKey || fallbackKey,
    );

    if (!options.skipBackpressureCheck) {
      await assertQueueCapacity(normalizationQueue, "lead-normalization");
    }

    const identity = this.deriveIdentityFromPayload(
      input.source,
      input.payload,
    );

    // G88: Persist Lead to Local Intelligence DB to satisfy Foreign Key constraints
    const leadId = input.requestId || crypto.randomUUID();
    let leadRecord: any;

    try {
      // Build insertion object dynamically to avoid Drizzle placeholder bugs
      const insertValues: any = {
        id: leadId,
        tenantId: input.tenantId,
        source: input.source,
        status: "normalizing",
        lifecycleStage: "lead",
        name: identity.name || null,
        email: identity.email || null,
        phone: identity.phone || null,
        companyName: identity.companyName || null,
        rawData: this.buildIngestionEnvelope(
          input.source,
          input.payload,
          input.metadata,
        ),
        normalizedData: null,
        confidence: "1.00",
        classification: null,
        classificationHistory: [],
        assignedTo: null,
        freezeUntil: null,
        staleAt: null,
        deletedAt: null,
      };

      // Explicitly set externalId to null if it's missing to avoid 'DEFAULT' keyword issues
      insertValues.externalId = identity.externalId ?? null;

      const [record] = await db.insert(leads).values(insertValues).returning();

      leadRecord = record;
    } catch (dbError: any) {
      this.log.error(
        {
          leadId,
          errorMessage: dbError.message,
          errorStack: dbError.stack,
          dbCode: dbError.code,
        },
        "CRITICAL: Lead Persistence Failed",
      );
      throw dbError;
    }

    const email = (identity.email || "").toLowerCase();
    const isFreeEmail =
      email.includes("gmail.com") ||
      email.includes("yahoo.com") ||
      email.includes("hotmail.com") ||
      email.includes("outlook.com");
    const priority = isFreeEmail ? 5 : 10;

    try {
      const job = await normalizationQueue.add(
        "normalize",
        {
          tenantId: input.tenantId,
          leadId: leadRecord.id,
          leadRecord: leadRecord, // Pass the record directly
          source: input.source,
          merged: false, // Stateless doesn't support merging
          traceContext: this.getTraceContext(),
        },
        {
          priority, // G51: Corporate leads get faster processing
        },
      );

      leadsIngestedCounter.inc({ source: input.source });

      return {
        leadId: leadRecord.id,
        jobId: String(job.id),
        merged: false,
        status: "normalizing",
      };
    } catch (queueError: any) {
      this.log.error(
        { leadId: leadRecord.id, error: queueError.message },
        "Failed to enqueue lead normalization - rolling back database record",
      );

      // C14: Atomic Rollback (Cleanup orphaned DB records if Redis is down)
      await db.delete(leads).where(eq(leads.id, leadRecord.id));

      throw new ApiError(
        "INTERNAL_SERVER_ERROR",
        "Lead ingestion system is temporarily unavailable (Queue failure)",
      );
    }
  }

  async enqueueAnalysisWithData(
    tenantId: string,
    leadRecord: any,
    tier: AnalysisTier,
    options: EnqueueOptions = {},
  ) {
    if (!options.skipBackpressureCheck) {
      await assertQueueCapacity(analysisQueue, "lead-analysis");
    }

    const modelUsed = getAnalysisModelForTier(tier);
    const billing = await this.reserveAnalysisCredit({
      tenantId,
      leadId: leadRecord.id,
      tier,
      modelUsed,
    });

    try {
      const job = await analysisQueue.add(
        tier === "deep" ? "analyze-deep" : "analyze-basic",
        {
          tenantId,
          leadId: leadRecord.id,
          leadRecord,
          tier,
          billingRequestId: billing.billingRequestId,
          billingCharged: true,
          billingCredits: billing.reservedCredits,
          traceContext: this.getTraceContext(),
        },
        {
          jobId: billing.billingRequestId,
        },
      );

      return { leadId: leadRecord.id, jobId: String(job.id), tier };
    } catch (error: any) {
      await this.finalizeAnalysisCredit({
        tenantId,
        leadId: leadRecord.id,
        tier,
        billingRequestId: billing.billingRequestId,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }
  async assignLead(
    _tenantId: string,
    leadId: string,
    assignedTo: string,
    _actorId?: string | null,
    _method: "manual" | "rule" = "manual",
    leadRecord?: any,
  ) {
    if (leadRecord) {
      leadRecord.assignedTo = assignedTo;
      leadRecord.updatedAt = new Date();
    }
    this.log.debug(
      { leadId, assignedTo },
      "Stateless lead assignment (no-op persistence)",
    );
    return { success: true, assignedTo };
  }

  async getIcpProfile(tenantId: string) {
    return this.getIcpRecord(tenantId);
  }

  async upsertIcpProfile(
    tenantId: string,
    payload: {
      target_industries: string[];
      company_size_range: string;
      budget_range_min: number;
      budget_range_max: number;
      deal_breaker_signals: string[];
      strong_fit_signals: string[];
      services_offered: string[];
      target_personas?: string[];
      negative_personas?: string[];
      additional_context?: string;
    },
  ) {
    return db.transaction(async (tx: any) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`lead-intelligence:icp:${tenantId}`}))`,
      );

      const [existing] = await tx
        .select()
        .from(icpProfiles)
        .where(
          and(
            eq(icpProfiles.tenantId, tenantId),
            eq(icpProfiles.isActive, true),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(icpProfiles)
          .set({ isActive: false, updatedAt: now() })
          .where(eq(icpProfiles.id, existing.id));
      }

      const [created] = await tx
        .insert(icpProfiles)
        .values({
          tenantId,
          version: existing ? existing.version + 1 : 1,
          isActive: true,
          targetIndustries: payload.target_industries,
          companySizeRange: payload.company_size_range,
          budgetRangeMin: payload.budget_range_min,
          budgetRangeMax: payload.budget_range_max,
          dealBreakerSignals: payload.deal_breaker_signals,
          strongFitSignals: payload.strong_fit_signals,
          servicesOffered: payload.services_offered,
          targetPersonas: payload.target_personas || [],
          negativePersonas: payload.negative_personas || [],
          additionalContext: payload.additional_context || null,
        })
        .returning();

      return created;
    });
  }

  async listRoutingRules(tenantId: string) {
    return db
      .select()
      .from(routingRules)
      .where(eq(routingRules.tenantId, tenantId))
      .orderBy(routingRules.priority);
  }

  async createRoutingRule(
    tenantId: string,
    payload: {
      priority: number;
      condition_field: string;
      condition_operator: string;
      condition_value: string;
      action_assign_to: string;
      is_active?: boolean;
    },
  ) {
    const [assignee] = await db
      .select()
      .from(users as any)
      .where(
        and(
          eq((users as any).id, payload.action_assign_to),
          eq((users as any).tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assignee) {
      throw new ApiError(
        "NOT_FOUND",
        "Routing rule assignee does not belong to this tenant",
      );
    }

    const [created] = await db
      .insert(routingRules)
      .values({
        tenantId,
        priority: payload.priority,
        conditionField: payload.condition_field,
        conditionOperator: payload.condition_operator,
        conditionValue: payload.condition_value,
        actionAssignTo: payload.action_assign_to,
        isActive: payload.is_active ?? true,
      })
      .returning();

    return created;
  }

  async updateRoutingRule(
    tenantId: string,
    ruleId: string,
    payload: {
      priority?: number;
      condition_field?: string;
      condition_operator?: string;
      condition_value?: string;
      action_assign_to?: string;
      is_active?: boolean;
    },
  ) {
    const [existing] = await db
      .select()
      .from(routingRules)
      .where(
        and(eq(routingRules.id, ruleId), eq(routingRules.tenantId, tenantId)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiError("NOT_FOUND", `Routing rule ${ruleId} not found`);
    }

    if (payload.action_assign_to) {
      const [assignee] = await db
        .select()
        .from(users as any)
        .where(
          and(
            eq((users as any).id, payload.action_assign_to),
            eq((users as any).tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!assignee) {
        throw new ApiError(
          "NOT_FOUND",
          "Routing rule assignee does not belong to this tenant",
        );
      }
    }

    const [updated] = await db
      .update(routingRules)
      .set({
        priority: payload.priority ?? existing.priority,
        conditionField: payload.condition_field ?? existing.conditionField,
        conditionOperator:
          payload.condition_operator ?? existing.conditionOperator,
        conditionValue: payload.condition_value ?? existing.conditionValue,
        actionAssignTo: payload.action_assign_to ?? existing.actionAssignTo,
        isActive: payload.is_active ?? existing.isActive,
      })
      .where(eq(routingRules.id, ruleId))
      .returning();

    return updated;
  }

  async deleteRoutingRule(tenantId: string, ruleId: string) {
    const deleted = await db
      .delete(routingRules)
      .where(
        and(eq(routingRules.id, ruleId), eq(routingRules.tenantId, tenantId)),
      )
      .returning();

    if (deleted.length === 0) {
      throw new ApiError("NOT_FOUND", `Routing rule ${ruleId} not found`);
    }
  }

  async listTeamMembers(tenantId: string) {
    return db
      .select()
      .from(users as any)
      .where(eq((users as any).tenantId, tenantId));
  }

  async createTeamMember(
    tenantId: string,
    payload: { name: string; email: string; role: string },
  ) {
    const [created] = await db
      .insert(users as any)
      .values({
        tenantId,
        name: payload.name,
        email: payload.email.toLowerCase(),
        role: payload.role,
      })
      .returning();

    return created;
  }

  async updateTeamMember(
    tenantId: string,
    userId: string,
    payload: { name?: string; email?: string; role?: string },
  ) {
    const [existing] = await db
      .select()
      .from(users as any)
      .where(
        and(
          eq((users as any).id, userId),
          eq((users as any).tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiError("NOT_FOUND", `Team member ${userId} not found`);
    }

    const [updated] = await db
      .update(users as any)
      .set({
        name: payload.name ?? existing.name,
        email: payload.email?.toLowerCase() ?? existing.email,
        role: payload.role ?? existing.role,
        updatedAt: now(),
      })
      .where(eq((users as any).id, userId))
      .returning();

    return updated;
  }

  async deleteTeamMember(tenantId: string, userId: string) {
    const deleted = await db
      .delete(users as any)
      .where(
        and(
          eq((users as any).id, userId),
          eq((users as any).tenantId, tenantId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new ApiError("NOT_FOUND", `Team member ${userId} not found`);
    }
  }

  async getSlackSettings(tenantId: string) {
    const settings = await this.getSettingsRecord(tenantId);
    return {
      url: settings?.slackWebhookUrl || null,
      configured: !!settings?.slackWebhookUrl,
    };
  }

  async upsertSlackSettings(tenantId: string, url: string) {
    const settings = await this.getSettingsRecord(tenantId);
    if (settings) {
      const [updated] = await db
        .update(leadServiceSettings)
        .set({ slackWebhookUrl: url, updatedAt: now() })
        .where(eq(leadServiceSettings.id, settings.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(leadServiceSettings)
      .values({
        tenantId,
        slackWebhookUrl: url,
      })
      .returning();

    return created;
  }

  async getWebhookSettings(tenantId: string) {
    return this.listActiveWebhookConfigs(tenantId);
  }

  private async listActiveWebhookConfigs(tenantId: string) {
    return db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.tenantId, tenantId))
      .orderBy(desc(webhookConfigs.createdAt));
  }

  async upsertWebhookSettings(
    tenantId: string,
    payload: {
      url: string;
      secret: string;
      events: string[];
      is_active?: boolean;
    },
  ) {
    const [existing] = await db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.tenantId, tenantId))
      .orderBy(desc(webhookConfigs.createdAt))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(webhookConfigs)
        .set({
          url: payload.url,
          secret: payload.secret,
          events: payload.events,
          isActive: payload.is_active ?? true,
        })
        .where(eq(webhookConfigs.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(webhookConfigs)
      .values({
        tenantId,
        url: payload.url,
        secret: payload.secret,
        events: payload.events,
        isActive: payload.is_active ?? true,
      })
      .returning();

    return created;
  }

  async getOpenAISettings(tenantId: string) {
    const settings = await this.getSettingsRecord(tenantId);
    return {
      hasCustomKey: !!settings?.openaiApiKeyEncrypted,
    };
  }

  async upsertOpenAISettings(tenantId: string, apiKey: string) {
    const encryptedKey = encrypt(apiKey);
    const settings = await this.getSettingsRecord(tenantId);
    if (settings) {
      const [updated] = await db
        .update(leadServiceSettings)
        .set({ openaiApiKeyEncrypted: encryptedKey, updatedAt: now() })
        .where(eq(leadServiceSettings.id, settings.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(leadServiceSettings)
      .values({
        tenantId,
        openaiApiKeyEncrypted: encryptedKey,
      })
      .returning();

    return created;
  }

  async getUsage(tenantId: string) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const aiUsageFilter = or(
      eq(leadIntelligenceUsageEvents.eventType, "lead_normalized"),
      eq(leadIntelligenceUsageEvents.eventType, "lead_categorized"),
      eq(leadIntelligenceUsageEvents.eventType, "lead_email_drafted"),
    );

    const [usageStats, dailyUsageStats] = await Promise.all([
      db
        .select({
          totalLeads: sql<number>`count(*) filter (where ${leadIntelligenceUsageEvents.eventType} = 'lead_normalized')`,
          analysesRun: sql<number>`count(*) filter (where ${leadIntelligenceUsageEvents.eventType} = 'lead_categorized')`,
          operations: sql<number>`count(*) filter (where ${aiUsageFilter})`,
          tokens: sql<number>`coalesce(sum(${leadIntelligenceUsageEvents.tokensUsed}), 0)`,
          costCents: sql<number>`coalesce(sum(${leadIntelligenceUsageEvents.costUsdCents}), 0)`,
        })
        .from(leadIntelligenceUsageEvents)
        .where(eq(leadIntelligenceUsageEvents.tenantId, tenantId)),
      db
        .select({
          costCents: sql<number>`coalesce(sum(${leadIntelligenceUsageEvents.costUsdCents}), 0)`,
        })
        .from(leadIntelligenceUsageEvents)
        .where(
          and(
            eq(leadIntelligenceUsageEvents.tenantId, tenantId),
            aiUsageFilter,
            gte(leadIntelligenceUsageEvents.createdAt, todayStart),
          ),
        ),
    ]);

    const settings = await this.getSettingsRecord(tenantId);
    const remainingCredits = await getTenantCredits(db, tenantId);

    return {
      totalLeads: Number(usageStats[0]?.totalLeads || 0),
      analysesRun: Number(usageStats[0]?.analysesRun || 0),
      aiOperations: Number(usageStats[0]?.operations || 0),
      tokensUsed: Number(usageStats[0]?.tokens || 0),
      costEstimateUsd: Number(usageStats[0]?.costCents || 0) / 100,
      dailyCostEstimateUsd: Number(dailyUsageStats[0]?.costCents || 0) / 100,
      dailyCostLimitUsd: Number(settings?.costLimitDailyCents || 1000) / 100,
      softWarningThreshold: config.LEAD_SOFT_WARNING_THRESHOLD,
      remainingCredits,
    };
  }

  async getAnalyticsSourcePerformance(tenantId: string) {
    this.log.debug(
      { tenantId },
      "Source performance analytics disabled in stateless mode",
    );
    return [];
  }

  async getAnalyticsClassificationDistribution(tenantId: string) {
    this.log.debug(
      { tenantId },
      "Classification analytics disabled in stateless mode",
    );
    return [];
  }

  async getAnalyticsResponseTime(tenantId: string) {
    this.log.debug(
      { tenantId },
      "Response time analytics disabled in stateless mode",
    );
    return {
      leadsWithAction: 0,
      averageFirstActionHours: 0,
    };
  }

  private async resolveRoutingAssignment(
    tenantId: string,
    leadRecord: any,
    analysis: any,
  ) {
    const rules = await db
      .select()
      .from(routingRules)
      .where(
        and(
          eq(routingRules.tenantId, tenantId),
          eq(routingRules.isActive, true),
        ),
      )
      .orderBy(routingRules.priority);

    const industry = normalizeComparable(
      analysis.extracted_attributes?.industry ||
        leadRecord.normalizedData?.extracted_context?.mentioned_industry,
    );
    const serviceType = normalizeComparable(
      analysis.extracted_attributes?.service_needed ||
        leadRecord.normalizedData?.extracted_context?.mentioned_services?.[0],
    );
    const classification = normalizeComparable(analysis.classification);
    const source = normalizeComparable(leadRecord.source);

    for (const rule of rules) {
      const conditionValue = normalizeComparable(rule.conditionValue);
      const fieldValue = (() => {
        switch (rule.conditionField) {
          case "classification":
            return classification;
          case "industry":
            return industry;
          case "source":
            return source;
          case "service_type":
            return serviceType;
          default:
            return null;
        }
      })();

      if (!fieldValue || !conditionValue) {
        continue;
      }

      const matches = (() => {
        if (rule.conditionOperator === "equals") {
          return fieldValue === conditionValue;
        }

        if (rule.conditionOperator === "contains") {
          return fieldValue.includes(conditionValue);
        }

        if (rule.conditionOperator === "greater_than") {
          return Number(fieldValue) > Number(conditionValue);
        }

        return false;
      })();

      if (matches) {
        return rule.actionAssignTo;
      }
    }

    return null;
  }

  private checkDealBreakers(
    normalized: NormalizedLeadData,
    icp: any,
  ): { disqualified: boolean; reason?: string } {
    if (!icp) return { disqualified: false };

    const ctx = normalized.extracted_context;
    if (!ctx) return { disqualified: false };

    // 1. Budget check
    if (icp.budgetRangeMin > 0 && ctx.mentioned_budget) {
      const budgetStr = ctx.mentioned_budget.toLowerCase();
      // handle $1M, 1M, $100k format
      let budgetNum = 0;
      const match = budgetStr.match(/([\d,.]+)\s*([mk])?/);
      if (match) {
        budgetNum = parseFloat(match[1].replace(/,/g, ""));
        if (match[2] === "m") budgetNum *= 1_000_000;
        else if (match[2] === "k") budgetNum *= 1_000;

        // If it's still small (e.g. "1.5" without suffix but min is 100k),
        // maybe it's in Millions? (Common in enterprise)
        if (budgetNum < 1000 && icp.budgetRangeMin >= 10000) {
          budgetNum *= 1_000_000; // heuristic
        }

        if (budgetNum > 0 && budgetNum < icp.budgetRangeMin / 5) {
          return {
            disqualified: true,
            reason: `Budget (${budgetNum}) significantly below minimum (${icp.budgetRangeMin})`,
          };
        }
      }
    }

    // 2. Industry check
    if (icp.targetIndustries?.length > 0 && ctx.mentioned_industry) {
      // If we have a blacklist or strict whitelist, we could check here.
      // For now, we'll rely on explicit deal breaker signals.
    }

    // 3. Explicit Deal Breakers
    if (icp.dealBreakerSignals?.length > 0) {
      const textToSearch =
        `${normalized.message_summary || ""} ${normalized.raw_requirements || ""}`.toLowerCase();
      const hit = icp.dealBreakerSignals.find((signal: string) =>
        textToSearch.includes(signal.toLowerCase()),
      );
      if (hit) {
        return {
          disqualified: true,
          reason: `Lead hit deal-breaker signal: ${hit}`,
        };
      }
    }

    return { disqualified: false };
  }

  /**
   * G91: External Data Enrichment (Enricher-clay-pattern)
   * Simulated placeholder for external enrichment (Clearbit/Apollo/6sense).
   * High-accuracy systems perform this BEFORE analysis to provide 'hidden' context.
   */
  private async enrichLeadData(tenantId: string, email?: string | null) {
    if (
      !email ||
      email.includes("gmail") ||
      email.includes("yahoo") ||
      email.includes("hotmail")
    ) {
      return null;
    }

    this.log.info(
      { tenantId, domain: email.split("@")[1] },
      "Simulating external data enrichment",
    );

    // In a production scenario, we would call an enrichment API here
    // return enrichmentService.lookup(email);

    return {
      enriched_at: new Date().toISOString(),
      source: "placeholder_enricher",
      company_details: {
        estimated_revenue: "Unknown (Enrichment Placeholder)",
        tech_stack: ["Unknown"],
      },
    };
  }

  /**
   * G92: Account-Based Intelligence (ABM Signal)
   * Checks if multiple leads are coming from the same company domain.
   */
  private async checkAccountActivity(
    tenantId: string,
    email?: string | null,
    currentLeadId?: string,
  ) {
    if (
      !email ||
      email.includes("gmail") ||
      email.includes("yahoo") ||
      email.includes("hotmail")
    ) {
      return { isAccountSignal: false };
    }

    const domain = email.split("@")[1];
    const otherLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          ilike(leads.email, `%@${domain}`),
          not(eq(leads.id, currentLeadId || "")),
        ),
      );

    const count = Number(otherLeads[0]?.count || 0);
    return {
      isAccountSignal: count > 0,
      activeLeadsFromDomain: count,
      domain,
    };
  }

  async processNormalizationJob(job: Job) {
    const {
      tenantId,
      leadId,
      source,
      merged,
      leadRecord: inputLeadRecord,
    } = job.data as {
      tenantId: string;
      leadId: string;
      source: LeadSource;
      merged: boolean;
      leadRecord: any;
    };

    const leadRecord = inputLeadRecord;
    if (!leadRecord) {
      this.log.error({ leadId }, "Lead record not found in job data");
      return;
    }

    const settings = await this.getSettingsRecord(tenantId);
    const icpProfile = await this.getIcpProfile(tenantId);
    const startTime = Date.now();

    try {
      // C7: Daily Quota Enforcement
      await checkDailyQuota(tenantId);

      const normalized = await leadIntelligenceAIService.normalizeLead({
        apiKey: leadIntelligenceAIService.normalizeStoredApiKey(
          settings?.openaiApiKeyEncrypted,
        ),
        source,
        rawPayload: toJsonSafeRecord(leadRecord.rawData.latestPayload),
      });

      const normalizedData = normalized.data as NormalizedLeadData;

      // G91: External Data Enrichment
      const enrichedData = await this.enrichLeadData(
        tenantId,
        normalizedData.email,
      );
      (normalizedData as any).enrichedData = enrichedData;

      // G92: Account-Based Intelligence
      const accountSignal = await this.checkAccountActivity(
        tenantId,
        normalizedData.email,
        leadId,
      );
      (normalizedData as any).accountSignal = accountSignal;

      // Update leadRecord in memory
      leadRecord.status = "new";
      leadRecord.name = normalizeOptionalString(normalizedData.name);
      leadRecord.email = normalizeEmail(normalizedData.email);
      leadRecord.phone = normalizePhone(normalizedData.phone);
      leadRecord.companyName = normalizeOptionalString(
        normalizedData.company_name,
      );
      leadRecord.normalizedData = normalizedData as unknown as Record<
        string,
        unknown
      >;
      leadRecord.confidence = String(normalizedData.confidence || 1.0);
      leadRecord.needsHumanReview = normalizedData.needs_human_review || false;
      leadRecord.updatedAt = now();

      // G88: Persist normalization results to DB
      await db
        .update(leads)
        .set({
          status: leadRecord.status,
          name: leadRecord.name,
          email: leadRecord.email,
          phone: leadRecord.phone,
          companyName: leadRecord.companyName,
          normalizedData: leadRecord.normalizedData as any,
          confidence: leadRecord.confidence,
          needsHumanReview: leadRecord.needsHumanReview,
          updatedAt: leadRecord.updatedAt,
        })
        .where(eq(leads.id, leadId));

      leadNormalizationCounter.inc({ status: "success" });

      // G88: Audit logging
      await db.insert(categorizationLogs).values({
        tenantId,
        requestId: job.id,
        source: leadRecord.source,
        type: "normalization",
        rawInput: "Redacted per source type",
        result: normalized.data as any,
        latencyMs: Date.now() - startTime,
        totalTokens: normalized.usage.totalTokens,
        model: config.LEAD_NORMALIZATION_MODEL,
      });

      await this.writeUsageEvent({
        tenantId,
        eventType: "lead_normalized",
        modelUsed: config.LEAD_NORMALIZATION_MODEL,
        promptVersion: (normalized.data as any).prompt_version || "1.0.0",
        tokensUsed: normalized.usage.totalTokens,
        costUsd: normalized.costEstimate,
        metadata: { leadId, source },
      });

      const usageUpdate = await incrementDailyUsage(
        tenantId,
        normalized.costEstimate,
      );
      await this.maybeRecordSoftQuotaWarning(tenantId, usageUpdate, {
        leadId,
        stage: "normalization",
        source,
      });

      if (!merged) {
        await this.queueWebhookDeliveries(tenantId, "lead.created", {
          lead_id: leadRecord.externalId || leadId,
          source,
          name: normalizedData.name,
          email: normalizedData.email,
          normalized_data: normalizedData,
        });

        // AUTO-PIPELINE: Queue basic analysis automatically if not spam
        const dealBreaker = this.checkDealBreakers(normalizedData, icpProfile);

        this.log.info(
          {
            leadId,
            isSpam: normalizedData.is_spam,
            disqualified: dealBreaker.disqualified,
            disqualificationReason: dealBreaker.reason,
          },
          "Auto-pipeline check results",
        );

        if (!normalizedData.is_spam && !dealBreaker.disqualified) {
          this.log.info({ leadId }, "Enqueueing basic analysis...");
          try {
            await this.enqueueAnalysisWithData(tenantId, leadRecord, "basic", {
              skipBackpressureCheck: true,
            });
          } catch (error: any) {
            if (
              error instanceof AuthError ||
              error?.errorCodeSlug === "AUTH_INSUFFICIENT_CREDITS"
            ) {
              this.log.warn(
                { leadId, error: error.message },
                "Skipping basic analysis because the tenant has no remaining credits",
              );

              await this.queueWebhookDeliveries(tenantId, "analysis.failed", {
                lead_id: leadRecord.externalId || leadId,
                error_code: "INSUFFICIENT_CREDITS",
                error_message: error.message,
              });

              const slackSettings = await this.getSlackSettings(tenantId);
              if (slackSettings.url) {
                await actionsQueue.add("notify-slack", {
                  tenantId,
                  leadId,
                  alertOnly: true,
                  alertMessage: `Lead analysis skipped for lead ${leadId}: ${error.message}`,
                });
              }
            } else {
              throw error;
            }
          }
        } else {
          leadRecord.status = normalizedData.is_spam ? "junk" : "unqualified";
          leadRecord.classification = "UNQUALIFIED";
          leadRecord.updatedAt = now();

          if (dealBreaker.disqualified) {
            leadGateRejectedCounter.inc({ gate: "deal-breaker" });
          }

          // Notify the subscriber about the final (rejected) state
          await this.queueWebhookDeliveries(tenantId, "analysis.completed", {
            lead_id: leadRecord.externalId || leadId,
            classification: "UNQUALIFIED",
            summary: normalizedData.is_spam
              ? "Lead marked as junk during normalization"
              : `Disqualified: ${dealBreaker.reason || "Criteria not met"}`,
            analysis: {
              status: leadRecord.status,
              classification: leadRecord.classification,
              rejection_reason: dealBreaker.reason,
              is_spam: normalizedData.is_spam,
            },
          });
        }
      }
    } catch (error: any) {
      if (isFinalJobAttempt(job)) {
        this.log.error(
          { leadId, error: error.message },
          "Normalization failed after all retries (stateless)",
        );

        await this.queueWebhookDeliveries(tenantId, "analysis.failed", {
          lead_id: leadRecord.externalId || leadId,
          error_code: "NORMALIZATION_FAILED",
          error_message: error.message,
        });

        const slackSettings = await this.getSlackSettings(tenantId);
        if (slackSettings.url) {
          await actionsQueue.add("notify-slack", {
            tenantId,
            leadId,
            alertOnly: true,
            alertMessage: `Lead normalization failed after retries for lead ${leadId}: ${error.message}`,
          });
        }
      }

      leadNormalizationCounter.inc({ status: "fail" });
      throw error;
    }
  }

  private async findSemanticCache(
    tenantId: string,
    message: string,
    apiKey?: string | null,
  ) {
    if (!message || message.length < 50) return null;

    try {
      const resolvedApiKey = apiKey || config.OPENAI_API_KEY || null; // Ensure string | null
      const embedding = await leadIntelligenceAIService.generateEmbedding(
        resolvedApiKey,
        message,
      );

      // G68: Cosine Similarity search in pgvector
      // (1 - (embedding <=> vector)) > 0.95
      const [cached] = (await db.execute(sql`
        SELECT a.* 
        FROM lead_intelligence_embeddings e
        JOIN lead_intelligence_analyses a ON e.lead_id = a.lead_id
        WHERE e.tenant_id = ${tenantId}
        AND (1 - (e.embedding <=> ${JSON.stringify(embedding)}::vector)) > ${config.LEAD_SEMANTIC_CACHE_THRESHOLD}
        ORDER BY e.created_at DESC
        LIMIT 1
      `)) as any[];

      return cached;
    } catch (e) {
      this.log.error(
        { error: (e as any).message },
        "Semantic cache lookup failed",
      );
      return null;
    }
  }

  async processAnalysisJob(job: Job) {
    const {
      tenantId,
      leadId,
      tier,
      leadRecord: inputLeadRecord,
    } = job.data as {
      tenantId: string;
      leadId: string;
      tier: AnalysisTier;
      leadRecord: any;
    };

    const leadRecord = inputLeadRecord;
    if (!leadRecord) {
      this.log.error({ leadId }, "Lead record not found for analysis job");
      return;
    }
    const billingRequestId =
      typeof (job.data as Record<string, unknown>).billingRequestId === "string"
        ? ((job.data as Record<string, unknown>).billingRequestId as string)
        : undefined;
    const billingCharged = Boolean(
      (job.data as Record<string, unknown>).billingCharged,
    );
    const icpProfile = await this.getIcpProfile(tenantId);
    const settings = await this.getSettingsRecord(tenantId);

    let analysisResult: any;
    const startTime = Date.now();

    try {
      // C7: Daily Quota Enforcement
      await checkDailyQuota(tenantId);

      // G68: Semantic Cache Check (Cost/Speed Optimization)
      const messageToMatch =
        (leadRecord.normalizedData as any)?.message_summary || "";

      const decryptedApiKey = leadIntelligenceAIService.normalizeStoredApiKey(
        settings?.openaiApiKeyEncrypted,
      );

      const cachedResult = await this.findSemanticCache(
        tenantId,
        messageToMatch,
        decryptedApiKey,
      );

      let analysis: any;
      let tierModel = "";

      if (cachedResult) {
        this.log.debug(
          { leadId, cachedFrom: cachedResult.lead_id },
          "G68: Semantic Cache Hit - Reusing intelligence",
        );
        analysis = {
          ...cachedResult,
          summary: `[Cached result] ${cachedResult.summary}`,
          needs_human_review: true, // Mark for safety
          review_reason: "Reused from similar historical lead",
        };
        tierModel = cachedResult.model_used;
        // Mock result for metrics
        analysisResult = {
          usage: { totalTokens: 0 },
          costEstimate: 0,
        };
      } else {
        tierModel = getAnalysisModelForTier(
          tier,
          (job.data as any).fallbackTriggered,
        );

        analysisResult = await leadIntelligenceAIService.analyzeLead({
          apiKey: leadIntelligenceAIService.normalizeStoredApiKey(
            settings?.openaiApiKeyEncrypted,
          ),
          tier,
          model: tierModel,
          icpProfile: icpProfile
            ? {
                targetIndustries: icpProfile.targetIndustries,
                companySizeRange: icpProfile.companySizeRange,
                budgetRangeMin: icpProfile.budgetRangeMin,
                budgetRangeMax: icpProfile.budgetRangeMax,
                dealBreakerSignals: icpProfile.dealBreakerSignals,
                strongFitSignals: icpProfile.strongFitSignals,
                servicesOffered: icpProfile.servicesOffered,
                targetPersonas: icpProfile.targetPersonas,
                negativePersonas: icpProfile.negativePersonas,
                additionalContext: icpProfile.additionalContext,
              }
            : null,
          lead: {
            ...leadRecord,
            rawData: leadRecord.rawData,
            normalizedData: leadRecord.normalizedData,
          },
        });
        analysis = analysisResult.data;

        // Step 2: Store Embedding for future caching
        // This is a best-effort optimization. The core analysis must not fail
        // if embeddings are unavailable or the cache table is missing.
        if (messageToMatch.length >= 50) {
          try {
            const decryptedApiKey =
              leadIntelligenceAIService.normalizeStoredApiKey(
                settings?.openaiApiKeyEncrypted,
              ) || null;
            const embedding = await leadIntelligenceAIService.generateEmbedding(
              decryptedApiKey,
              messageToMatch,
            );

            await db.insert(leadEmbeddings).values({
              tenantId,
              leadId,
              embedding,
              contextType: "summary",
            });
          } catch (embeddingError: any) {
            this.log.warn(
              {
                leadId,
                error: embeddingError.message,
              },
              "Skipping analysis embedding persistence",
            );
          }
        }
      }

      // G102: LLM-as-a-Judge (Hallucination Guard) for HOT leads
      if (analysis.classification === "HOT" && !cachedResult) {
        const judgeResult =
          await leadIntelligenceAIService.validateAnalysisWithJudge({
            apiKey: leadIntelligenceAIService.normalizeStoredApiKey(
              settings?.openaiApiKeyEncrypted,
            ),
            lead: leadRecord,
            analysis: analysis,
          });

        if (!judgeResult.data.is_grounded) {
          analysis.needs_human_review = true;
          analysis.review_reason = `AI Judge Warning: ${judgeResult.data.reasoning}`;
          this.log.warn(
            { leadId, judge: judgeResult.data },
            "AI Judge flagged potential hallucination",
          );
        }
      }

      // G88: Persist analysis to Local Intelligence DB
      const [createdAnalysisRecord] = await db
        .insert(leadAnalyses)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          leadId,
          modelUsed: tierModel,
          analysisTier: tier,
          analysisDepth: tier,
          summary: analysis.summary,
          classification: analysis.classification,
          intent: analysis.intent || "UNKNOWN",
          classificationReasoning: analysis.classification_reasoning,
          scoringFactors: analysis.scoring_factors as any,
          extractedAttributes: analysis.extracted_attributes as any,
          riskFlags: analysis.risk_flags,
          suggestedAction: analysis.suggested_action,
          conversationHighlights: analysis.conversation_highlights as any,
          competitiveSignals: analysis.competitive_signals,
          objectionPredictions: analysis.objection_predictions,
          detailedActionPlan: analysis.detailed_action_plan,
          citations: analysis.citations as any,
          icpProfileId: icpProfile?.id || null,
          promptVersion: analysis.prompt_version || "1.1.0",
          schemaVersion: analysis.schema_version || "1.1.0",
          confidence: String(analysis.confidence || 1.0),
          needsHumanReview: analysis.needs_human_review || false,
          reviewReason: analysis.review_reason || null,
          tokensUsed: analysisResult.usage.totalTokens,
          costEstimateCents: Math.ceil(analysisResult.costEstimate * 100),
        })
        .returning();

      const createdAnalysis = createdAnalysisRecord;

      this.log.debug(
        {
          leadId,
          analysisId: createdAnalysis.id,
          classification: createdAnalysis.classification,
          result: createdAnalysis,
        },
        "Full AI Analysis Response Generated and Persisted",
      );

      // PROGRESSIVE ANALYSIS: Auto-escalate HOT/WARM leads to Deep Analysis
      if (
        tier === "basic" &&
        (analysis.classification === "HOT" ||
          analysis.classification === "WARM")
      ) {
        this.log.debug(
          { leadId, classification: analysis.classification },
          "High-value lead detected, auto-upgrading to deep-tier analysis",
        );
        try {
          await this.enqueueAnalysisWithData(tenantId, leadRecord, "deep", {
            skipBackpressureCheck: true,
          });
        } catch (error: any) {
          if (
            error instanceof AuthError ||
            error?.errorCodeSlug === "AUTH_INSUFFICIENT_CREDITS"
          ) {
            this.log.warn(
              {
                leadId,
                classification: analysis.classification,
                error: error.message,
              },
              "Skipping deep analysis upgrade because the tenant has no remaining credits",
            );
          } else {
            this.log.error(
              {
                leadId,
                classification: analysis.classification,
                error: error.message,
              },
              "Failed to enqueue deep analysis upgrade",
            );
          }
        }
      }

      await this.writeUsageEvent({
        tenantId,
        eventType: "lead_categorized",
        modelUsed: tierModel,
        tokensUsed: analysisResult.usage.totalTokens,
        costUsd: analysisResult.costEstimate,
        metadata: { leadId, tier, analysisId: createdAnalysis.id },
      });

      const usageUpdate = await incrementDailyUsage(
        tenantId,
        analysisResult.costEstimate,
      );
      await this.maybeRecordSoftQuotaWarning(tenantId, usageUpdate, {
        leadId,
        stage: "analysis",
        tier,
        analysisId: createdAnalysis.id,
      });

      // W6: Trigger Routing Rules Engine
      await this.evaluateRoutingRules(tenantId, leadId, analysis, leadRecord);

      const history = Array.isArray(leadRecord.classificationHistory)
        ? leadRecord.classificationHistory
        : [];
      const updatedHistory = [
        ...history,
        {
          classification: analysis.classification,
          timestamp: new Date().toISOString(),
          reason: analysis.classification_reasoning,
        },
      ];

      // Update in-memory record
      leadRecord.classification = analysis.classification;
      leadRecord.classificationHistory = updatedHistory;
      leadRecord.status = leadIntelligenceAIService.classificationToLeadStatus(
        analysis.classification as LeadClassification,
      );
      leadRecord.updatedAt = now();

      // G88: Persist analysis classification to leads table
      await db
        .update(leads)
        .set({
          status: leadRecord.status,
          classification: leadRecord.classification,
          classificationHistory: leadRecord.classificationHistory as any,
          updatedAt: leadRecord.updatedAt,
        })
        .where(eq(leads.id, leadId));

      // Trigger Webhook
      await this.queueWebhookDeliveries(tenantId, "analysis.completed", {
        lead_id: leadRecord.externalId || leadId,
        categorizer_uuid: leadId,
        analysis_id: createdAnalysis.id,
        classification: analysis.classification,
        analysis: createdAnalysis,
        lead: leadRecord,
      });

      this.log.debug(
        { leadId, analysisId: createdAnalysis.id },
        "Lead analysis completed and webhooks queued (stateless)",
      );

      leadAnalysisCounter.inc({ tier, status: "success" });

      // G88: Audit logging
      await db.insert(categorizationLogs).values({
        tenantId,
        requestId: job.id,
        source: leadRecord.source,
        type: `analysis-${tier}`,
        rawInput: "Analysis input",
        result: analysis as any,
        latencyMs: Date.now() - startTime,
        totalTokens: analysisResult.usage.totalTokens,
        model: tierModel,
      });
      leadClassificationCounter.inc({
        classification: analysis.classification,
      });

      if (billingCharged) {
        await this.finalizeAnalysisCredit({
          tenantId,
          leadId,
          tier,
          billingRequestId,
          success: true,
        });
      }

      // Shadow-mode canary (experimental analysis)
      const shadowVersion = PromptVersionService.resolveVersion(
        tenantId,
        "CANARY_ANALYSIS",
        "none",
      );
      if (shadowVersion !== "none" && shadowVersion !== "1.0.0") {
        this.log.debug(
          { leadId, shadowVersion },
          "Running shadow-mode canary analysis",
        );
        // We fire and forget this shadow run so it doesn't block the main pipeline
        leadIntelligenceAIService
          .analyzeLead({
            apiKey: leadIntelligenceAIService.normalizeStoredApiKey(
              settings?.openaiApiKeyEncrypted,
            ),
            tier,
            model: tierModel,
            lead: { ...leadRecord, normalizedData: leadRecord.normalizedData },
            promptOverride: shadowVersion, // Helper to use experimental prompt
          })
          .then((shadowResult) => {
            this.log.debug(
              {
                leadId,
                original: analysis.classification,
                shadow: shadowResult.data.classification,
                match:
                  analysis.classification === shadowResult.data.classification,
              },
              "Shadow-mode comparison result",
            );
          })
          .catch((err) =>
            this.log.error({ err: err.message }, "Shadow analysis failed"),
          );
      }
      await this.queueWebhookDeliveries(tenantId, "lead.analyzed", {
        lead_id: leadRecord.externalId || leadId,
        classification: analysis.classification,
        summary: analysis.summary,
        scoring_factors: analysis.scoring_factors,
      });

      // Smart deep-tier routing (only when basic confidence low)
      if (
        tier === "basic" &&
        (analysis.confidence || 0) < 0.7 &&
        analysis.classification !== "HOT" &&
        analysis.classification !== "WARM" &&
        !(job.data as any).isUpgrade
      ) {
        this.log.debug(
          { leadId, confidence: analysis.confidence },
          "Basic analysis confidence low, auto-upgrading to deep-tier",
        );
        try {
          await this.enqueueAnalysisWithData(tenantId, leadRecord, "deep", {
            skipBackpressureCheck: true,
          });
        } catch (error: any) {
          if (
            error instanceof AuthError ||
            error?.errorCodeSlug === "AUTH_INSUFFICIENT_CREDITS"
          ) {
            this.log.warn(
              { leadId, confidence: analysis.confidence, error: error.message },
              "Skipping deep analysis upgrade because the tenant has no remaining credits",
            );
          } else {
            this.log.error(
              { leadId, confidence: analysis.confidence, error: error.message },
              "Failed to enqueue low-confidence deep analysis upgrade",
            );
          }
        }
      }
    } catch (error: any) {
      // FALLBACK LOGIC: If deep analysis fails, try basic analysis
      if (tier === "deep" && !(job.data as any).fallbackTriggered) {
        this.log.warn(
          { leadId, error: error.message },
          "Deep analysis failed, triggering fallback to basic",
        );
        if (billingCharged) {
          await this.finalizeAnalysisCredit({
            tenantId,
            leadId,
            tier,
            billingRequestId,
            success: false,
            errorMessage: error.message,
          });
        }
        await this.enqueueAnalysisWithData(tenantId, leadRecord, "basic", {
          skipBackpressureCheck: true,
        });
        leadAnalysisFallbackCounter.inc();
        return;
      }

      leadAnalysisCounter.inc({ tier, status: "fail" });

      if (isFinalJobAttempt(job)) {
        this.log.error(
          { leadId },
          "Analysis failed after all retries (stateless no-op status update)",
        );

        if (billingCharged) {
          await this.finalizeAnalysisCredit({
            tenantId,
            leadId,
            tier,
            billingRequestId,
            success: false,
            errorMessage: error.message,
          });
        }

        await this.queueWebhookDeliveries(tenantId, "analysis.failed", {
          lead_id: leadId,
          error_code: "ANALYSIS_FAILED",
          error_message: error.message,
        });

        const slackSettings = await this.getSlackSettings(tenantId);
        if (slackSettings.url) {
          await actionsQueue.add("notify-slack", {
            tenantId,
            leadId,
            alertOnly: true,
            alertMessage: `Lead analysis failed after retries for lead ${leadId}: ${error.message}`,
          });
        }
      }

      throw error;
    }
  }

  async processActionJob(job: Job) {
    if (job.name === "notify-slack") {
      const { tenantId, leadId, alertOnly, alertMessage } = job.data as {
        tenantId: string;
        leadId: string;
        alertOnly?: boolean;
        alertMessage?: string;
      };

      if (!alertOnly) {
        this.log.debug(
          { leadId },
          "Skipping non-alert slack job in stateless mode",
        );
        return;
      }

      const settings = await this.getSettingsRecord(tenantId);
      if (!settings?.slackWebhookUrl) {
        throw new ApiError(
          "NOT_FOUND",
          "Slack webhook is not configured for this tenant",
        );
      }
      const payload = {
        text: alertMessage || `Lead alert for ${leadId}`,
      };

      const response = await fetch(settings.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.LEAD_SLACK_TIMEOUT_MS),
      });

      if (!response.ok) {
        slackNotificationCounter.inc({ status: "fail" });
        throw new ApiError(
          "INTERNAL_SERVER_ERROR",
          `Slack webhook returned ${response.status}`,
        );
      }

      slackNotificationCounter.inc({ status: "success" });
    }
  }

  async processWebhookJob(job: Job) {
    const { webhookConfigId, payload } = job.data as {
      webhookConfigId: string;
      payload: Record<string, unknown>;
    };

    const [configRow] = await db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.id, webhookConfigId))
      .limit(1);

    if (!configRow) {
      this.log.error(
        { webhookConfigId },
        "Webhook configuration record not found - skipping delivery",
      );
      return;
    }

    if (!configRow.isActive) {
      this.log.debug(
        { webhookConfigId },
        "Webhook is inactive - skipping delivery",
      );
      return;
    }

    let url: URL;
    try {
      url = new URL(configRow.url);
    } catch (err: any) {
      this.log.error(
        { webhookConfigId, url: configRow.url, error: err.message },
        "Malformed webhook URL - skipping delivery",
      );
      return;
    }
    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "metadata.google.internal",
      "169.254.169.254",
    ];
    if (
      config.NODE_ENV === "production" &&
      (blockedHosts.includes(url.hostname) ||
        url.hostname.startsWith("10.") ||
        url.hostname.startsWith("192.168."))
    ) {
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        "SSRF: Blocked internal webhook destination",
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const bodyString = JSON.stringify(payload);

    // C11: Outbound Webhook Security (HMAC + Replay Protection)
    const signature = crypto
      .createHmac("sha256", configRow.secret)
      .update(`${timestamp}.${bodyString}`)
      .digest("hex");

    let response: Response;
    try {
      response = await fetch(configRow.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": String(timestamp),
          "X-Webhook-Event": payload.event as string,
          "X-Webhook-Attempt": String((job.attemptsMade || 0) + 1),
        },
        body: bodyString,
        signal: AbortSignal.timeout(config.LEAD_WEBHOOK_TIMEOUT_MS),
      });
    } catch (error: any) {
      const errorMessage =
        error.name === "TimeoutError" || error.name === "AbortError"
          ? `Webhook timeout after ${config.LEAD_WEBHOOK_TIMEOUT_MS}ms`
          : `Webhook connection failed: ${error.message}`;

      // G101: Log network-level failure to audit trail
      await db.insert(leadIntelligenceWebhookLogs).values({
        tenantId: configRow.tenantId,
        webhookConfigId: configRow.id,
        event: payload.event as string,
        payload: payload,
        responseStatus: 0, // 0 indicates network failure
        responseBody: errorMessage,
        latencyMs: Date.now() - timestamp * 1000,
      });

      webhookDeliveryCounter.inc({
        event: payload.event as string,
        status: "fail",
      });

      throw new ApiError("INTERNAL_SERVER_ERROR", errorMessage);
    }

    const responseBody = await response.text().catch(() => "");
    const latencyMs = Date.now() - timestamp * 1000;

    // G101: Webhook Audit Trail (Industry Standard Persistence)
    await db.insert(leadIntelligenceWebhookLogs).values({
      tenantId: configRow.tenantId,
      webhookConfigId: configRow.id,
      event: payload.event as string,
      payload: payload,
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 1000), // Cap size
      latencyMs,
    });

    if (!response.ok) {
      webhookDeliveryCounter.inc({
        event: payload.event as string,
        status: "fail",
      });
      throw new ApiError(
        "INTERNAL_SERVER_ERROR",
        `Outbound webhook returned ${response.status}: ${responseBody.substring(0, 50)}`,
      );
    }

    webhookDeliveryCounter.inc({
      event: payload.event as string,
      status: "success",
    });
  }

  async getConsentSettings(tenantId: string) {
    const settings = await this.getSettingsRecord(tenantId);
    return settings?.consentData || { enabled: false, text: "" };
  }

  async upsertConsentSettings(
    tenantId: string,
    payload: { enabled: boolean; text: string },
  ) {
    const settings = await this.getSettingsRecord(tenantId);
    if (settings) {
      const [updated] = await db
        .update(leadServiceSettings)
        .set({ consentData: payload, updatedAt: now() })
        .where(eq(leadServiceSettings.id, settings.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(leadServiceSettings)
      .values({ tenantId, consentData: payload })
      .returning();
    return created;
  }

  async getCostLimit(tenantId: string) {
    const settings = await this.getSettingsRecord(tenantId);
    return {
      dailyLimit: Number((settings?.costLimitDailyCents || 1000) / 100),
    };
  }

  async upsertCostLimit(tenantId: string, dailyLimit: number) {
    const settings = await this.getSettingsRecord(tenantId);
    const dailyLimitCents = Math.round(dailyLimit * 100);
    if (settings) {
      const [updated] = await db
        .update(leadServiceSettings)
        .set({ costLimitDailyCents: dailyLimitCents, updatedAt: now() })
        .where(eq(leadServiceSettings.id, settings.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(leadServiceSettings)
      .values({ tenantId, costLimitDailyCents: dailyLimitCents })
      .returning();
    return created;
  }

  async evaluateRoutingRules(
    tenantId: string,
    leadId: string,
    analysis: any,
    leadRecord: any,
  ) {
    const rules = await db
      .select()
      .from(routingRules)
      .where(
        and(
          eq(routingRules.tenantId, tenantId),
          eq(routingRules.isActive, true),
        ),
      )
      .orderBy(asc(routingRules.priority));

    if (rules.length === 0) return;

    // G73: Group rules by ruleGroup for AND/OR composition
    const groups = rules.reduce(
      (acc: Record<string, any[]>, rule: any) => {
        const g = rule.ruleGroup || `single-${rule.id}`;
        if (!acc[g]) acc[g] = [];
        acc[g].push(rule);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    for (const groupName of Object.keys(groups)) {
      const groupRules = groups[groupName];
      const logicalOp = groupRules[0].logicalOperator || "AND";

      let groupMatch = logicalOp === "AND";

      for (const rule of groupRules) {
        const {
          conditionField,
          conditionOperator,
          conditionValue,
          minDealSizeCents,
        } = rule;

        // G75: Deal Size & Territory filter
        if (
          minDealSizeCents &&
          (analysis.extracted_attributes?.budget_value || 0) < minDealSizeCents
        ) {
          if (logicalOp === "AND") {
            groupMatch = false;
            break;
          }
          continue;
        }

        let actualValue: any;
        if (conditionField === "classification")
          actualValue = analysis.classification;
        else if (conditionField === "intent") actualValue = analysis.intent;
        else if (conditionField === "industry")
          actualValue = analysis.extracted_attributes?.industry;
        else if (conditionField === "territory")
          actualValue = analysis.extracted_attributes?.territory;
        else if (conditionField === "source") {
          actualValue = leadRecord?.source;
        }

        let ruleMatch = false;
        if (conditionOperator === "eq")
          ruleMatch = String(actualValue) === conditionValue;
        else if (conditionOperator === "contains")
          ruleMatch = String(actualValue).includes(conditionValue);
        else if (conditionOperator === "in")
          ruleMatch = conditionValue.split(",").includes(String(actualValue));

        if (logicalOp === "AND") groupMatch = groupMatch && ruleMatch;
        else groupMatch = groupMatch || ruleMatch;

        if (logicalOp === "OR" && groupMatch) break;
        if (logicalOp === "AND" && !groupMatch) break;
      }

      if (groupMatch) {
        const primaryRule = groupRules[0];
        this.log.info({ leadId, groupName }, "Lead matched routing group");

        // G74: Team Round-robin vs Direct Assignment
        if (primaryRule.actionAssignTeam) {
          await this.assignToTeamRoundRobin(
            tenantId,
            leadId,
            primaryRule.actionAssignTeam,
            leadRecord,
          );
        } else if (primaryRule.actionAssignTo) {
          await this.assignLead(
            tenantId,
            leadId,
            primaryRule.actionAssignTo,
            null,
            "rule",
            leadRecord,
          );
        }

        routingAssignmentCounter.inc({
          rule_id: primaryRule.id,
          assignee: primaryRule.actionAssignTo ?? "team",
        });
        break; // Stop at first matched group
      }
    }
  }

  /**
   * Round-robin Team Assignment logic
   */
  private async assignToTeamRoundRobin(
    tenantId: string,
    leadId: string,
    teamId: string,
    leadRecord: any,
  ) {
    const [team] = await db
      .select()
      .from(leadIntelligenceTeams)
      .where(eq(leadIntelligenceTeams.id, teamId))
      .limit(1);
    if (!team) return;

    const members = await db
      .select()
      .from(leadIntelligenceTeamMembers)
      .where(
        and(
          eq(leadIntelligenceTeamMembers.teamId, teamId),
          eq(leadIntelligenceTeamMembers.isActive, true),
        ),
      )
      .orderBy(asc(leadIntelligenceTeamMembers.createdAt));

    if (members.length === 0) return;

    const nextIndex = (team.lastAssignedIndex + 1) % members.length;
    const assignee = members[nextIndex];

    await this.assignLead(
      tenantId,
      leadId,
      assignee.userId,
      null,
      "rule",
      leadRecord,
    );

    await db
      .update(leadIntelligenceTeams)
      .set({ lastAssignedIndex: nextIndex })
      .where(eq(leadIntelligenceTeams.id, teamId));
  }

  /**
   * DLQ Replay Handler
   * Reuses quota validation logic to ensure that manually retried jobs from DLQ
   * do not bypass billing limits.
   */
  async retryFailedJob(tenantId: string, queueName: string, jobId: string) {
    let queue: Queue;
    switch (queueName) {
      case "normalization":
        queue = normalizationQueue;
        break;
      case "analysis":
        queue = analysisQueue;
        break;
      case "actions":
        queue = actionsQueue;
        break;
      case "notifications":
        queue = notificationsQueue;
        break;
      default:
        throw new ApiError("NOT_FOUND", `Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new ApiError(
        "NOT_FOUND",
        `Job ${jobId} not found in ${queueName} queue`,
      );
    }

    if (job.data.tenantId !== tenantId) {
      rlsViolationCounter.inc({ tenant_id: tenantId });
      throw new ApiError("FORBIDDEN", "Access denied to this job");
    }

    // C7: Daily Quota Enforcement (Reuse middleware logic)
    await checkDailyQuota(tenantId);

    this.log.info(
      { tenantId, queueName, jobId },
      "Manually retrying failed job from DLQ",
    );
    await job.retry();

    return { success: true, jobId, status: "retrying" };
  }

  /**
   * Rotates the primary OpenAI API key and moves the current key to 'previous' state.
   * Enables a 7-day grace period for existing jobs/integrations.
   */
  async rotateApiKey(tenantId: string, newKeyPlainText: string) {
    this.log.info({ tenantId }, "G65: Rotating OpenAI API key");

    const [settings] = await db
      .select()
      .from(leadServiceSettings)
      .where(eq(leadServiceSettings.tenantId, tenantId))
      .limit(1);
    const existingKey = settings?.openaiApiKeyEncrypted;

    const newKeyEncrypted = encrypt(newKeyPlainText);

    await db
      .update(leadServiceSettings)
      .set({
        openaiApiKeyEncrypted: newKeyEncrypted,
        previousOpenaiApiKeyEncrypted: existingKey,
        rotatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadServiceSettings.tenantId, tenantId));

    return { success: true, rotatedAt: new Date() };
  }

  async submitFeedback(
    tenantId: string,
    leadId: string,
    payload: {
      classification: string;
      intent?: string;
      notes?: string;
      labelerEmail: string;
    },
  ) {
    this.log.info({ tenantId, leadId }, "Submitting human feedback for lead");

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      throw new ApiError("NOT_FOUND", "Lead not found");
    }

    const [latestAnalysis] = await db
      .select()
      .from(leadAnalyses)
      .where(eq(leadAnalyses.leadId, leadId))
      .orderBy(desc(leadAnalyses.createdAt))
      .limit(1);

    return db.transaction(async (tx: any) => {
      // 1. Store in eval table for benchmarking
      await tx
        .insert(leadIntelligenceEvals)
        .values({
          tenantId,
          leadId,
          analysisId: latestAnalysis?.id,
          groundTruthClassification: payload.classification,
          groundTruthIntent: payload.intent,
          labelerEmail: payload.labelerEmail,
          notes: payload.notes,
        })
        .onConflictDoUpdate({
          target: leadIntelligenceEvals.leadId,
          set: {
            groundTruthClassification: payload.classification,
            groundTruthIntent: payload.intent,
            labelerEmail: payload.labelerEmail,
            notes: payload.notes,
            updatedAt: new Date(),
          },
        });

      // 2. Update the lead's current classification if it changed
      if (payload.classification !== lead.classification) {
        const history = lead.classificationHistory || [];
        await tx
          .update(leads)
          .set({
            classification: payload.classification,
            classificationHistory: [
              ...history,
              {
                classification: payload.classification,
                timestamp: new Date().toISOString(),
                reason: `Human review by ${payload.labelerEmail}: ${payload.notes || "No notes"}`,
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(leads.id, leadId));
      }

      return { success: true };
    });
  }
}

export const leadIntelligenceService = new LeadIntelligenceService();
export default leadIntelligenceService;
