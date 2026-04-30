import OpenAI from 'openai';
import { ApiError, logger } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { getResolvedHrPolicyOpenAIKey } from '@/ai/openai-provider.js';
import { assertVectorDimensions } from '@/lib/pgvector.js';

const embeddingLogger = logger.child({ ns: 'hr-policy:embeddings' });

let client: OpenAI | null = null;

const getClient = () => {
  const apiKey = getResolvedHrPolicyOpenAIKey();
  if (!apiKey) {
    throw new ApiError(
      'LLM_EMPTY_RESPONSE',
      'HR_POLICY_OPENAI_API_KEY or OPENAI_API_KEY is required for policy embeddings',
    );
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      maxRetries: 3,
      timeout: 60 * 1000,
    });
  }

  return client;
};

export const embedText = async (input: string): Promise<number[]> => {
  const text = input.trim();

  if (!text) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Input text is required for embeddings');
  }

  const response = await getClient().embeddings.create({
    model: config.RAG_EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0]?.embedding ?? [];

  if (!embedding.length) {
    throw new ApiError('LLM_EMPTY_RESPONSE', 'Embedding provider returned an empty vector');
  }

  embeddingLogger.debug({
    msg: 'Embedding generated',
    model: config.RAG_EMBEDDING_MODEL,
    dimensions: embedding.length,
  });

  return assertVectorDimensions(embedding, config.VECTOR_DIMENSIONS);
};

export const embedTexts = async (inputs: string[]): Promise<number[][]> => {
  const texts = inputs.map((input) => input.trim());

  if (!texts.length || texts.some((text) => !text)) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'All embedding inputs must be non-empty strings');
  }

  const response = await getClient().embeddings.create({
    model: config.RAG_EMBEDDING_MODEL,
    input: texts,
  });

  if (response.data.length !== texts.length) {
    throw new ApiError('LLM_EMPTY_RESPONSE', 'Embedding provider returned an unexpected number of vectors');
  }

  embeddingLogger.debug({
    msg: 'Batch embeddings generated',
    model: config.RAG_EMBEDDING_MODEL,
    count: response.data.length,
  });

  return response.data.map((item) => assertVectorDimensions(item.embedding ?? [], config.VECTOR_DIMENSIONS));
};
