export const LEAD_SOURCES = ["chatbot", "form", "manual"] as const;
export const LEAD_STATUSES = [
  "new",
  "normalizing",
  "analyzing",
  "analyzed",
  "contacted",
  "converted",
  "lost",
  "extraction_failed",
  "analysis_failed",
  "junk",
] as const;
export const LEAD_CLASSIFICATIONS = [
  "HOT",
  "WARM",
  "COLD",
  "UNQUALIFIED",
] as const;
export const ANALYSIS_TIERS = ["basic", "deep"] as const;
export const DRAFT_TYPES = [
  "follow_up",
  "meeting_request",
  "discovery",
] as const;
export const ROUTING_FIELDS = [
  "classification",
  "intent",
  "industry",
  "source",
  "service_type",
] as const;
export const ROUTING_OPERATORS = [
  "eq",
  "equals",
  "contains",
  "greater_than",
  "in",
] as const;
export const WEBHOOK_EVENTS = [
  "lead.created",
  "lead.analyzed",
  "lead.assigned",
  "lead.status_changed",
  "analysis.completed",
  "analysis.failed",
  "email_draft.completed",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadClassification = (typeof LEAD_CLASSIFICATIONS)[number];
export type AnalysisTier = (typeof ANALYSIS_TIERS)[number];
export type DraftType = (typeof DRAFT_TYPES)[number];
export type RoutingField = (typeof ROUTING_FIELDS)[number];
export type RoutingOperator = (typeof ROUTING_OPERATORS)[number];
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type LeadScoringFactor = {
  factor: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
};

export type ExtractedContext = {
  mentioned_budget: string | null;
  mentioned_timeline: string | null;
  mentioned_services: string[];
  mentioned_industry: string | null;
  mentioned_company_size: string | null;
  other_signals: string[];
};

export type NormalizedLeadData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source_type: LeadSource;
  message_summary: string;
  raw_requirements: string | null;
  detected_language: string;
  contact_preference: "phone" | "email" | "whatsapp" | "not_specified";
  extracted_context: ExtractedContext;
  evidence: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
  is_spam: boolean;
  confidence: number;
  needs_human_review: boolean;
};

export type LeadAnalysisResult = {
  summary: string;
  classification: LeadClassification;
  classification_reasoning: string;
  scoring_factors: LeadScoringFactor[];
  extracted_attributes: {
    service_needed: string | null;
    industry: string | null;
    budget_range: string | null;
    timeline: string | null;
    company_size: string | null;
    decision_stage:
      | "ready_to_start"
      | "evaluating_options"
      | "exploring"
      | "just_researching"
      | "unknown";
    contact_preference: string | null;
  };
  risk_flags: string[];
  suggested_action: string;
  conversation_highlights: Array<{
    lead_quote: string;
    significance: string;
  }> | null;
  competitive_signals: string[] | null;
  objection_predictions: string[] | null;
  detailed_action_plan: string[] | null;
  intent: "READY_TO_START" | "EVALUATING" | "RESEARCHING" | "UNKNOWN";
  citations: Array<{ claim: string; evidence: string; confidence: number }>;
  confidence: number;
  needs_human_review: boolean;
  prompt_version: string;
  schema_version: string;
};

export type LeadEmailDraftResult = {
  draftType: DraftType;
  subject: string;
  body: string;
};

export type QueueJobResponse = {
  leadId: string;
  jobId: string;
  merged: boolean;
  status: LeadStatus;
};
