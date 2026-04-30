export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Common Message Structure
 */
export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date | string;
}

/**
 * Centralized Conversation Definition
 */
export interface Conversation {
  id: string;
  tenantId?: string;
  customerId?: string; // Widget/SaaS context
  sessionId?: string; // Client frontend context
  source: 'GATEWAY' | 'WIDGET' | 'STANDALONE';
  metadata?: Record<string, any>;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

/**
 * Token Usage & Latency Metadata
 */
export interface UsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  model: string;
}
