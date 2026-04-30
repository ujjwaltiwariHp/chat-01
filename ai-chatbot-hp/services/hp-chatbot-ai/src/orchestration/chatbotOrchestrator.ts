import { buildSystemPrompt, trimConversationHistory } from '@prompts/promptBuilder.js';
import { config } from '@config/index.js';
import { breaker } from '@circuit/openaiBreaker.js';
import { LLMRequest, LLMStreamChunk, ChatMessage } from '@hp-intelligence/core';
import { db } from '@db/connection.js';
import { conversations } from '@db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '@hp-intelligence/core';

/**
 * Chatbot Orchestrator
 * Integrates long-term context, dynamic budget calculation, and circuit breakers.
 */
export class ChatbotOrchestrator {
  private orchestratorLogger = logger.child({ ns: 'orchestrator:core' });

  async getChatResponse(
    userMessage: string, 
    history: ChatMessage[] = [], 
    conversationId?: string, 
    signal?: AbortSignal
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    let contextHeader = '';

    // Fetch and inject long-term summary if it exists
    if (conversationId && conversationId !== 'new-conv') {
      try {
        const [conv] = await db.select({ summary: conversations.summary })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);

        if (conv?.summary) {
          contextHeader = `### LONG-TERM CONVERSATION SUMMARY\n${conv.summary}\n\n`;
        }
      } catch (err: any) {
        this.orchestratorLogger.warn({ msg: 'Failed to fetch summary from DB', error: err.message });
      }
    }

    let systemPrompt = contextHeader + buildSystemPrompt();
    systemPrompt += `\n\n### CONTINUITY DIRECTIVE\nRefer to the LONG-TERM SUMMARY above and the RECENT HISTORY below to maintain conversation continuity.`;

    // Trim history using exact tokens
    const trimmedHistory = trimConversationHistory(history);

    const request: LLMRequest = {
      systemPrompt,
      userMessage,
      history: trimmedHistory.filter(m => m.role === 'user' || m.role === 'assistant'),
      maxTokens: config.MAX_MESSAGE_TOKENS,
      signal,
    };

    return breaker.fire(request);
  }
}

export const chatbotOrchestrator = new ChatbotOrchestrator();
