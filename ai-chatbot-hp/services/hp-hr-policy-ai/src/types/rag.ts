import type { ChatMessage, Usage } from '@hp-intelligence/core';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  sourceUrl: string | null;
  chunkIndex: number;
}

export interface PolicyCitation {
  chunkId: string;
  documentId: string;
  title: string;
  sourceUrl: string | null;
  score: number;
}

export interface PolicyAnswer {
  answer: string;
  citations: PolicyCitation[];
  matches: RetrievedChunk[];
  usage: Usage;
  retrievalQuery: string;
}

export interface PolicyDocumentInput {
  sourceKey: string;
  title: string;
  content: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyQuestionInput {
  requestId?: string;
  tenantId: string;
  message: string;
  history?: ChatMessage[];
  signal?: AbortSignal;
}
