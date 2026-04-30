import { LLMResponse, LLMStreamChunk } from '../types/llm.js';
import { ApiError } from './api-error.js';

/**
 * Generic LLM Response Validator
 * Standardized for all AI services in the @hp-intelligence monorepo.
 */
export function validateResponse(response: LLMResponse, sourceService: string = 'LLM'): void {
  if (!response) {
    throw new ApiError('LLM_EMPTY_RESPONSE', `Empty response from ${sourceService}`);
  }

  if (!response.content || response.content.trim().length === 0) {
    throw new ApiError('LLM_EMPTY_RESPONSE', `Empty content from ${sourceService}`);
  }

  if (!response.usage) {
    throw new ApiError('COMMON_VALIDATION_ERROR', `Missing usage metadata from ${sourceService}`);
  }

  const { promptTokens, completionTokens, totalTokens } = response.usage;

  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    throw new ApiError('COMMON_VALIDATION_ERROR', `Malformed usage metadata from ${sourceService}`);
  }

  if (totalTokens !== promptTokens + completionTokens) {
    throw new ApiError('COMMON_VALIDATION_ERROR', `Usage integrity check failed for ${sourceService}`);
  }
}

/**
 * Generic LLM Stream Chunk Type Guard
 */
export function isValidStreamChunk(chunk: unknown): chunk is LLMStreamChunk {
  return (
    !!chunk &&
    typeof chunk === 'object' &&
    'content' in chunk &&
    typeof (chunk as any).content === 'string' &&
    'done' in chunk &&
    typeof (chunk as any).done === 'boolean'
  );
}
