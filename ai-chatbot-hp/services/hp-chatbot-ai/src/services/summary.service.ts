import { db } from '../db/connection.js';
import { conversations, messages } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { logger, decrypt, ChatMessage } from '@hp-intelligence/core';
import { config } from '@config/index.js';
import { chatbotOpenAIProvider } from '@/ai/openai-provider.js';

const summaryLogger = logger.child({ ns: 'summary' });

export async function generateConversationSummary(conversationId: string): Promise<string | null> {
    try {
        // 1. Fetch current conversation and its history
        const [conv] = await db.select({ summary: conversations.summary })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

        if (!conv) return null;

        // Fetch the last 20 messages to generate a good summary
        const historyResults = await db.select({
            role: messages.role,
            content: messages.content
        })
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(desc(messages.createdAt))
            .limit(20);

        const history: ChatMessage[] = (historyResults as any).reverse().map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: (decrypt(m.content) ?? m.content) as string
        }));

        // 2. Build the summarization prompt
        const prompt = `Progressively summarize the conversation provided below. 
If an existing summary exists, incorporate it into the new summary.
Keep the summary concise (under 200 words) and focus on:
- User's primary goals or problems.
- Key technical details shared.
- Progress of discussion.

Current Summary: ${conv.summary || 'None'}

New Messages:
${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

New Consolidated Summary:`;

        // 3. Call LLM for summarization
        const response = await chatbotOpenAIProvider.complete({
            model: config.OPENAI_MODEL,
            systemPrompt: "You are an expert at summarizing technical software development discussions. Be concise and accurate.",
            userMessage: prompt,
            maxTokens: config.SUMMARY_MAX_TOKENS,
        });


        const newSummary = response.content.trim();

        // 4. Persist to database
        await db.update(conversations)
            .set({ summary: newSummary })
            .where(eq(conversations.id, conversationId));

        summaryLogger.info({ conversationId }, 'conversation.summary_updated');
        return newSummary;
    } catch (err: any) {
        summaryLogger.error({
            error: err.message,
            conversationId
        }, 'conversation.summary_failed');
        return null;
    }
}
