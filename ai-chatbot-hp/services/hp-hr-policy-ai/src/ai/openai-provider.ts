import { ApiError, type ILLMProvider } from '@hp-intelligence/core';
import { createOpenAIProvider } from '@hp-intelligence/core/llm/openai.js';
import { config } from '@/config/index.js';

let hrPolicyOpenAIProviderSingleton: ILLMProvider | null = null;

export const getResolvedHrPolicyOpenAIKey = () =>
  config.HR_POLICY_OPENAI_API_KEY?.trim() || config.OPENAI_API_KEY?.trim() || null;

const getHrPolicyOpenAIProvider = (): ILLMProvider => {
  const apiKey = getResolvedHrPolicyOpenAIKey();
  if (!apiKey) {
    throw new ApiError(
      'LLM_EMPTY_RESPONSE',
      'HR_POLICY_OPENAI_API_KEY or OPENAI_API_KEY is required for HR policy AI operations',
    );
  }

  if (!hrPolicyOpenAIProviderSingleton) {
    hrPolicyOpenAIProviderSingleton = createOpenAIProvider({ apiKey });
  }

  return hrPolicyOpenAIProviderSingleton!;
};

export const hrPolicyOpenAIProvider: ILLMProvider = {
  complete(request) {
    return getHrPolicyOpenAIProvider().complete(request);
  },
  stream(request) {
    return getHrPolicyOpenAIProvider().stream(request);
  },
};
