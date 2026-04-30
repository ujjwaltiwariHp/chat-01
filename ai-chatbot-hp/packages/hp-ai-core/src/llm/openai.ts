import OpenAI from 'openai';
import { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../types/llm.js';
import { logger } from '../logging/logger.js';
import { ApiError } from '../utils/api-error.js';
import { config } from '../config/base-config.js';
import { tokenCounter, aiErrorCounter } from '../plugins/metrics.js';

export type OpenAIClientOptions = {
  apiKey?: string | null;
  maxRetries?: number;
  timeoutMs?: number;
};

/**
 * High-Standard OpenAI Client (P2-Integration)
 * Modernized to use @hp-intelligence/core infrastructure.
 */
export class OpenAIClient implements ILLMProvider {
  private client: OpenAI;
  private openaiLogger = logger.child({ ns: 'llm:openai' });

  constructor(options: OpenAIClientOptions = {}) {
    const resolvedApiKey = options.apiKey?.trim() || config.OPENAI_API_KEY;
    if (!resolvedApiKey) {
      throw new ApiError('LLM_EMPTY_RESPONSE', 'An OpenAI API key is required to create an OpenAI client');
    }

    this.client = new OpenAI({
      apiKey: resolvedApiKey,
      maxRetries: options.maxRetries ?? 3,
      timeout: options.timeoutMs ?? 60 * 1000,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const model = request.model || config.OPENAI_MODEL;


    try {
      this.openaiLogger.info({ msg: 'Request starting', model }, 'complete.start');

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system' as const, content: request.systemPrompt },
          ...(request.history?.filter(m => m.role !== 'tool').map(m => ({ 
            role: m.role as 'user' | 'assistant' | 'system', 
            content: m.content 
          })) || []),
          { role: 'user' as const, content: request.userMessage },
        ] as any[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.MAX_MESSAGE_TOKENS,
        response_format: request.responseFormat || (request.jsonMode ? { type: 'json_object' } : undefined),
        stream: false,
      }, { signal: request.signal });

      const durationMs = Date.now() - start;
      const usage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      this.openaiLogger.info({ 
        msg: 'Request successful', 
        durationMs, 
        usage,
        requestId: (request as any).id 
      }, 'complete.success');

      tokenCounter.labels({ service: config.SERVICE_NAME, model, type: 'prompt' }).inc(usage.promptTokens);
      tokenCounter.labels({ service: config.SERVICE_NAME, model, type: 'completion' }).inc(usage.completionTokens);

      return {
        content: response.choices[0]?.message?.content || '',
        usage,
      };
    } catch (err: any) {
      this.openaiLogger.error({ 
        msg: 'Request failed', 
        error: err.message,
        durationMs: Date.now() - start 
      }, 'complete.error');
      
      aiErrorCounter.labels({ service: config.SERVICE_NAME, error_type: err.code || 'unknown' }).inc();
      throw new ApiError('LLM_EMPTY_RESPONSE', `OpenAI Error: ${err.message}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const start = Date.now();
    const model = request.model || config.OPENAI_MODEL;

    try {
      this.openaiLogger.info({ msg: 'Stream starting', model }, 'stream.start');

      const streamResponse = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system' as const, content: request.systemPrompt },
          ...(request.history?.filter(m => m.role !== 'tool').map(m => ({ 
            role: m.role as 'user' | 'assistant' | 'system', 
            content: m.content 
          })) || []),
          { role: 'user' as const, content: request.userMessage },
        ] as any[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.MAX_MESSAGE_TOKENS,
        response_format: request.responseFormat || (request.jsonMode ? { type: 'json_object' } : undefined),
        stream: true,
        stream_options: { include_usage: true },
      }, { signal: request.signal });

      return (async function* (this: OpenAIClient) {
        for await (const chunk of streamResponse) {
          const content = chunk.choices[0]?.delta?.content || '';
          const usage = (chunk as any).usage;

          if (content) {
            yield { content, done: false };
          }

          if (usage) {
            const finalUsage = {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            };
            this.openaiLogger.info({ 
              msg: 'Stream completed', 
              usage: finalUsage,
              durationMs: Date.now() - start 
            }, 'stream.complete');

            tokenCounter.labels({ service: config.SERVICE_NAME, model, type: 'prompt' }).inc(finalUsage.promptTokens);
            tokenCounter.labels({ service: config.SERVICE_NAME, model, type: 'completion' }).inc(finalUsage.completionTokens);

            yield { content: '', done: true, usage: finalUsage };
            return;
          }
        }
      }).call(this);
    } catch (err: any) {
      this.openaiLogger.error({ 
        msg: 'Stream setup failed', 
        error: err.message 
      }, 'stream.error');
      aiErrorCounter.labels({ service: config.SERVICE_NAME, error_type: err.code || 'unknown' }).inc();
      throw new ApiError('LLM_TIMEOUT', `OpenAI stream error: ${err.message}`);
    }
  }
}

let openAiClientSingleton: OpenAIClient | null = null;

const getOpenAiClient = (): OpenAIClient => {
  if (!config.OPENAI_API_KEY) {
    throw new ApiError('LLM_EMPTY_RESPONSE', 'OPENAI_API_KEY is required to use the OpenAI client');
  }

  if (!openAiClientSingleton) {
    openAiClientSingleton = new OpenAIClient();
  }

  return openAiClientSingleton;
};

export const createOpenAIProvider = (options: OpenAIClientOptions = {}): ILLMProvider =>
  new OpenAIClient(options);

export const openaiClient: ILLMProvider = {
  complete(request) {
    return getOpenAiClient().complete(request);
  },
  stream(request) {
    return getOpenAiClient().stream(request);
  },
};
