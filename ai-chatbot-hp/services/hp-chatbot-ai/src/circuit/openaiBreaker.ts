import { createCircuitBreaker, LLMRequest, LLMStreamChunk } from '@hp-intelligence/core';
import { chatbotOpenAIProvider } from '@/ai/openai-provider.js';

/**
 * Standardized OpenAI Circuit Breaker
 * Logic localized in Chatbot AI but pattern centralized in @hp-intelligence/core.
 */
export const breaker = createCircuitBreaker(
  async (request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> => {
    return chatbotOpenAIProvider.stream(request);
  },
  {
    name: 'openai',
    timeout: 30000,                // 30s timeout for streaming
    errorThresholdPercentage: 50,  // Open after 50% errors
    resetTimeout: 30000,           // Try again after 30s
    volumeThreshold: 5,            // Open after 5 requests fail
  }
);

// Fallback logic when Open
breaker.fallback(async () => {
  return (async function* () {
    yield {
      content: "Deeply sorry, but my connection to the AI hive is temporarily unstable. Please try again in 30 seconds.",
      done: true
    };
  })();
});
