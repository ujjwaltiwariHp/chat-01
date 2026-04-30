import {
  ChatMessage,
  trimConversationHistory as coreTrimHistory,
} from "@hp-intelligence/core";
import { config } from "@config/index.js";
import { CHATBOT_V1 } from "@/prompts/templates/chatbot.v1.js";
import { CHATBOT_V2 } from "@/prompts/templates/chatbot.v2.js";
import { buildFAQPrompt } from "@/data/faq.js";

export const PROMPT_VERSION = "2.0.0";

/**
 * Builds the centralized system prompt for AI turns.
 * Defaulting to V2 for improved natural language and consultant persona.
 */
export const buildSystemPrompt = (version: "v1" | "v2" = "v2"): string => {
  const template = version === "v2" ? CHATBOT_V2 : CHATBOT_V1;
  let base = template + "\n";
  base += buildFAQPrompt(version);

  // Replace contact placeholders
  return base
    .replace(/{{EMAIL}}/g, config.contact.email)
    .replace(/{{PHONE}}/g, config.contact.phone)
    .replace(/{{WHATSAPP}}/g, config.contact.whatsapp);
};

/**
 * Trims conversation history using exact tokens from core.
 */
export const trimConversationHistory = (
  history: ChatMessage[],
): ChatMessage[] => {
  return coreTrimHistory(history, config.CONTEXT_WINDOW / 2);
};
