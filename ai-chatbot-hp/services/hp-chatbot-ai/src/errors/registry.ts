import { HttpStatusCode, ErrorDetail } from '@hp-intelligence/core';

/**
 * Atomic Registry for Chatbot-Specific Errors.
 * Consolidates technical internal errors with user-facing messages.
 */
export const BotErrorRegistry: Record<string, ErrorDetail> = {
  // Overriding a Core Error with service-specific UX
  LLM_TIMEOUT: {
    code: 1001,
    statusCode: HttpStatusCode.GATEWAY_TIMEOUT,
    severity: 'high',
    component: 'chatbot:llm',
    internalMessage: 'OpenAI brain timeout',
    clientMessage: 'The AI brain is taking too long to respond, please try again.',
  },

  // Service-Local Errors
  CHATBOT_INVALID_PROMPT: {
    code: 5011,
    statusCode: HttpStatusCode.BAD_REQUEST,
    severity: 'low',
    component: 'chatbot',
    internalMessage: 'User input failed moderation or validation',
    clientMessage: 'Your message was rejected as invalid or inappropriate.',
  },

  CHATBOT_RATE_LIMIT: {
    code: 5012,
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    severity: 'medium',
    component: 'chatbot',
    internalMessage: 'Chatbot session rate limit hit',
    clientMessage: 'You have sent too many messages, please slow down.',
  }
};
