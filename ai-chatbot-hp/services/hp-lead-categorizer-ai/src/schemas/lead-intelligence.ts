import { z } from "zod";
import {
  ROUTING_FIELDS,
  ROUTING_OPERATORS,
  WEBHOOK_EVENTS,
} from "@/types/lead-intelligence.js";

const OptionalString = z.string().trim().min(1).optional();

export const ManualLeadInputSchema = z
  .object({
    name: OptionalString,
    email: z.string().email().optional(),
    phone: OptionalString,
    companyName: OptionalString,
    message: OptionalString,
    serviceType: OptionalString,
    budget: z.union([z.number(), z.string()]).optional(),
    timeline: OptionalString,
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

export const FormLeadInputSchema = z
  .record(z.string(), z.any())
  .refine((value) => Object.keys(value).length > 0, {
    message: "Form payload must contain at least one field",
  });

export const ChatbotTranscriptMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1),
  createdAt: z.string().optional(),
});

export const ChatbotLeadInputSchema = z
  .object({
    conversationId: z.string().trim().min(1),
    transcript: z.array(ChatbotTranscriptMessageSchema).min(1),
    visitor: z
      .object({
        pageUrl: OptionalString,
        referrer: OptionalString,
        location: OptionalString,
        name: OptionalString,
        email: z.string().email().optional(),
        phone: OptionalString,
        widgetApiKey: OptionalString,
      })
      .passthrough()
      .optional(),
    tenantId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

export const IcpProfileSchema = z
  .object({
    target_industries: z.array(z.string().trim().min(1)).min(1),
    company_size_range: z.string().trim().min(1),
    budget_range_min: z.number().int().nonnegative(),
    budget_range_max: z.number().int().nonnegative(),
    deal_breaker_signals: z.array(z.string().trim().min(1)),
    strong_fit_signals: z.array(z.string().trim().min(1)),
    services_offered: z.array(z.string().trim().min(1)).min(1),
    target_personas: z.array(z.string().trim().min(1)).optional().default([]),
    negative_personas: z.array(z.string().trim().min(1)).optional().default([]),
    additional_context: z.string().trim().optional(),
  })
  .refine((value) => value.budget_range_max >= value.budget_range_min, {
    message:
      "budget_range_max must be greater than or equal to budget_range_min",
    path: ["budget_range_max"],
  });

export const RoutingRuleCreateSchema = z.object({
  priority: z.number().int().nonnegative(),
  condition_field: z.enum(ROUTING_FIELDS),
  condition_operator: z.enum(ROUTING_OPERATORS),
  condition_value: z.string().trim().min(1),
  action_assign_to: z.string().uuid(),
  is_active: z.boolean().optional(),
});

export const RoutingRuleUpdateSchema = RoutingRuleCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one routing rule field must be provided",
  },
);

export const TeamMemberCreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const TeamMemberUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(["admin", "member"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one team field must be provided",
  });

export const SlackSettingsSchema = z.object({
  url: z.string().trim().url(),
});

export const WebhookSettingsSchema = z.object({
  url: z.string().trim().url(),
  secret: z.string().trim().min(8),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  is_active: z.boolean().optional(),
});

export const OpenAISettingsSchema = z.object({
  apiKey: z.string().trim().min(20),
});

export const ConsentSettingsSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().min(1),
});

export const CostLimitSchema = z.object({
  dailyLimit: z.number().nonnegative(),
});
