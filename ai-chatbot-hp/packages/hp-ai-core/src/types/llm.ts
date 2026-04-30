import { type Role } from './conversation.js';

export type { Role };

/**
 * Standardized LLM Provider Interface
 */
export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMRequest {
  systemPrompt: string;
  userMessage: string;
  history?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
  responseFormat?: any;
  signal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  usage: Usage;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: Usage;
}

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>>;
}
