import { ApiError, type ILLMProvider } from '@hp-intelligence/core';
import { createOpenAIProvider } from '@hp-intelligence/core/llm/openai.js';
import { config } from '@config/index.js';

let chatbotOpenAIProviderSingleton: ILLMProvider | null = null;

const getResolvedChatbotOpenAIKey = () =>
  config.CHATBOT_OPENAI_API_KEY?.trim() || config.OPENAI_API_KEY?.trim() || null;

const getChatbotOpenAIProvider = (): ILLMProvider => {
  const apiKey = getResolvedChatbotOpenAIKey();
  if (!apiKey) {
    throw new ApiError(
      'LLM_EMPTY_RESPONSE',
      'CHATBOT_OPENAI_API_KEY or OPENAI_API_KEY is required for chatbot AI operations',
    );
  }

  if (!chatbotOpenAIProviderSingleton) {
    chatbotOpenAIProviderSingleton = createOpenAIProvider({ apiKey });
  }

  return chatbotOpenAIProviderSingleton!;
};

export const chatbotOpenAIProvider: ILLMProvider = {
  complete(request) {
    return getChatbotOpenAIProvider().complete(request);
  },
  stream(request) {
    return getChatbotOpenAIProvider().stream(request);
  },
};
