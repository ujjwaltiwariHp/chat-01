import { getEncoding, encodingForModel, TiktokenModel } from "js-tiktoken";
import { ChatMessage } from "../types/llm.js";
import { config } from "../config/base-config.js";

/**
 * High-Standard Token Counter
 * Uses Tiktoken for exact OpenAI/Anthropic tokenization.
 * Optimized with cl100k_base as a universal fallback.
 */
export function countTokens(text: string, model: string = config.OPENAI_MODEL): number {
    try {
        const encoder = encodingForModel(model as TiktokenModel);
        return encoder.encode(text).length;
    } catch (e) {
        // Universal fallback for modern models (o1, gpt-4o, etc)
        const defaultEncoder = getEncoding("cl100k_base");
        return defaultEncoder.encode(text).length;
    }
}

/**
 * Counts total tokens for a full chat payload.
 * Accounts for message metadata overhead (~4 tokens per message).
 */
export function countChatTokens(
    systemPrompt: string, 
    userMessage: string, 
    history: ChatMessage[], 
    model: string = config.OPENAI_MODEL
): number {
    let total = 3; // Base overhead

    total += countTokens(systemPrompt, model) + 4;
    total += countTokens(userMessage, model) + 4;

    for (const msg of history) {
        total += countTokens(msg.content, model) + 4;
    }

    return total;
}

/**
 * Trims conversation history to fit within context window constraints.
 */
export function trimConversationHistory(
    history: ChatMessage[], 
    maxTokens: number = 8000, 
    model: string = config.OPENAI_MODEL
): ChatMessage[] {
    let currentTokens = 0;
    const result: ChatMessage[] = [];

    // Traverse backwards from newest to oldest
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        const tokens = countTokens(msg.content, model) + 4; // Add overhead

        if (currentTokens + tokens > maxTokens) break;

        currentTokens += tokens;
        result.unshift(msg);
    }

    return result;
}
