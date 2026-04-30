import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { LeadErrorMessages } from "@errors/error-messages.js";
import {
  ChatbotLeadInputSchema,
  ConsentSettingsSchema,
  CostLimitSchema,
  FormLeadInputSchema,
  IcpProfileSchema,
  ManualLeadInputSchema,
  OpenAISettingsSchema,
  RoutingRuleCreateSchema,
  RoutingRuleUpdateSchema,
  SlackSettingsSchema,
  TeamMemberCreateSchema,
  TeamMemberUpdateSchema,
  WebhookSettingsSchema,
} from "@/schemas/lead-intelligence.js";
import { leadIntelligenceService } from "@/services/lead-intelligence.service.js";
import { ApiError } from "@/utils/api-error.js";

const requireTenant = (request: FastifyRequest) => {
  if (!request.tenantId) {
    throw new ApiError(
      "COMMON_AUTH_ERROR",
      LeadErrorMessages.auth.tenantContextRequired,
    );
  }

  return request.tenantId;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const inferInvokeSource = (body: unknown): "chatbot" | "form" | "manual" => {
  const requestBody = isRecord(body) ? body : {};
  const payload = isRecord(requestBody.payload) ? requestBody.payload : {};
  const payloadMetadata = isRecord(payload.metadata) ? payload.metadata : {};
  const bodyMetadata = isRecord(requestBody.meta) ? requestBody.meta : {};
  const directSource = String(
    requestBody.source ||
      payload.source ||
      payload.source_type ||
      payloadMetadata.source ||
      payloadMetadata.source_type ||
      bodyMetadata.source ||
      bodyMetadata.source_type ||
      "",
  )
    .trim()
    .toLowerCase();

  if (
    directSource === "chatbot" ||
    directSource === "form" ||
    directSource === "manual"
  ) {
    return directSource;
  }

  if (
    Array.isArray(payload.transcript) ||
    payload.conversationId ||
    (isRecord(payload.visitor) && payload.visitor.widgetApiKey)
  ) {
    return "chatbot";
  }

  const hasFormSignal = [
    payloadMetadata.form_source,
    payloadMetadata.form_source_url,
    bodyMetadata.form_source,
    bodyMetadata.form_source_url,
    payload.form_source,
    payload.form_source_url,
    payload.formId,
    payload.form_id,
  ].some((value) =>
    typeof value === "string" ? value.trim().length > 0 : Boolean(value),
  );

  if (hasFormSignal) {
    return "form";
  }

  return "manual";
};

export const ingestManualLeadController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const payload = ManualLeadInputSchema.parse(request.body);
  const result = await leadIntelligenceService.ingestLead({
    tenantId,
    requestId: request.id,
    source: "manual",
    payload,
    idempotencyKey: request.headers["x-idempotency-key"] as string | undefined,
    actorId: request.actorId || request.userId,
  });

  return reply.status(202).send(result);
};

export const ingestFormLeadController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const payload = FormLeadInputSchema.parse(request.body);
  const result = await leadIntelligenceService.ingestLead({
    tenantId,
    requestId: request.id,
    source: "form",
    payload,
    idempotencyKey: request.headers["x-idempotency-key"] as string | undefined,
    actorId: request.actorId || request.userId,
  });

  return reply.status(202).send(result);
};

export const ingestChatbotLeadController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (request.authMode !== "INTERNAL") {
    throw new ApiError(
      "COMMON_AUTH_ERROR",
      LeadErrorMessages.auth.chatbotInternalOnly,
    );
  }

  const payload = ChatbotLeadInputSchema.parse(request.body);
  const tenantId =
    await leadIntelligenceService.resolveTenantIdForInternalChatbotRequest(
      payload as any,
      request.tenantId,
    );
  const result = await leadIntelligenceService.ingestLead({
    tenantId,
    requestId: request.id,
    source: "chatbot",
    payload,
    idempotencyKey: request.headers["x-idempotency-key"] as string | undefined,
    actorId: request.actorId || request.userId,
  });

  return reply.status(202).send(result);
};

export const compatibilityInvokeController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const rawBody = (request.body as any) || {};
  let payload = rawBody.payload;

  if (typeof payload !== "object" || payload === null) {
    // If the body itself looks like a lead (has email/phone), use it as payload
    if (
      rawBody.email ||
      rawBody.phone ||
      rawBody.email_address ||
      rawBody.phone_number
    ) {
      payload = rawBody;
    } else {
      payload = { payload: rawBody.payload ?? rawBody };
    }
  }

  if (isRecord(payload)) {
    const legacyMeta = isRecord(rawBody.meta) ? rawBody.meta : {};
    const existingMetadata = isRecord(payload.metadata) ? payload.metadata : {};
    if (
      Object.keys(legacyMeta).length > 0 ||
      Object.keys(existingMetadata).length > 0
    ) {
      payload = {
        ...payload,
        metadata: {
          ...legacyMeta,
          ...existingMetadata,
        },
      };
    }
  }

  const result = await leadIntelligenceService.ingestLead({
    tenantId,
    requestId: request.id,
    source: inferInvokeSource(rawBody),
    payload,
    idempotencyKey: request.headers["x-idempotency-key"] as string | undefined,
    actorId: request.actorId || request.userId,
    metadata: {
      legacyInvoke: true,
      meta: rawBody.meta || null,
    },
  });

  return reply.status(202).send({
    success: true,
    message: "Legacy invoke accepted and queued for lead normalization",
    ...result,
  });
};

export const getIcpController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getIcpProfile(requireTenant(request));
};

export const upsertIcpController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = IcpProfileSchema.parse(request.body);
  return leadIntelligenceService.upsertIcpProfile(tenantId, body);
};

export const listRoutingRulesController = async (request: FastifyRequest) => {
  return leadIntelligenceService.listRoutingRules(requireTenant(request));
};

export const createRoutingRuleController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = RoutingRuleCreateSchema.parse(request.body);
  return leadIntelligenceService.createRoutingRule(tenantId, body);
};

export const updateRoutingRuleController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const { id } = request.params as { id: string };
  const body = RoutingRuleUpdateSchema.parse(request.body);
  return leadIntelligenceService.updateRoutingRule(tenantId, id, body);
};

export const deleteRoutingRuleController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const { id } = request.params as { id: string };
  await leadIntelligenceService.deleteRoutingRule(tenantId, id);
  return reply.status(204).send();
};

export const listTeamController = async (request: FastifyRequest) => {
  return leadIntelligenceService.listTeamMembers(requireTenant(request));
};

export const createTeamController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = TeamMemberCreateSchema.parse(request.body);
  return leadIntelligenceService.createTeamMember(tenantId, body);
};

export const updateTeamController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const { id } = request.params as { id: string };
  const body = TeamMemberUpdateSchema.parse(request.body);
  return leadIntelligenceService.updateTeamMember(tenantId, id, body);
};

export const deleteTeamController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const { id } = request.params as { id: string };
  await leadIntelligenceService.deleteTeamMember(tenantId, id);
  return reply.status(204).send();
};

export const getSlackSettingsController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getSlackSettings(requireTenant(request));
};

export const putSlackSettingsController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = SlackSettingsSchema.parse(request.body);
  return leadIntelligenceService.upsertSlackSettings(tenantId, body.url);
};

export const getWebhookSettingsController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getWebhookSettings(requireTenant(request));
};

export const putWebhookSettingsController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = WebhookSettingsSchema.parse(request.body);
  return leadIntelligenceService.upsertWebhookSettings(tenantId, body);
};

export const getOpenAISettingsController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getOpenAISettings(requireTenant(request));
};

export const putOpenAISettingsController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = OpenAISettingsSchema.parse(request.body);
  return leadIntelligenceService.upsertOpenAISettings(tenantId, body.apiKey);
};

export const getUsageController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getUsage(requireTenant(request));
};

export const getConsentSettingsController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getConsentSettings(requireTenant(request));
};

export const putConsentSettingsController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = ConsentSettingsSchema.parse(request.body);
  return leadIntelligenceService.upsertConsentSettings(tenantId, body);
};

export const getCostLimitController = async (request: FastifyRequest) => {
  return leadIntelligenceService.getCostLimit(requireTenant(request));
};

export const putCostLimitController = async (request: FastifyRequest) => {
  const tenantId = requireTenant(request);
  const body = CostLimitSchema.parse(request.body);
  return leadIntelligenceService.upsertCostLimit(tenantId, body.dailyLimit);
};

export const submitFeedbackController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const tenantId = requireTenant(request);
  const { id } = request.params as { id: string };
  const body = z
    .object({
      classification: z.string().trim().min(1),
      intent: z.string().trim().optional(),
      notes: z.string().trim().optional(),
      labelerEmail: z.string().email(),
    })
    .parse(request.body);

  await leadIntelligenceService.submitFeedback(tenantId, id, body);
  return reply.status(200).send({ success: true });
};
