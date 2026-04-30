import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '@hp-intelligence/core';

export const policyConversations = pgTable('policy_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  userId: text('user_id'),
  customerId: text('customer_id'),
  summary: text('summary'),
  source: text('source').default('widget'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('policy_conversations_session_idx').on(table.sessionId),
  index('policy_conversations_tenant_idx').on(table.tenantId),
  index('policy_conversations_user_idx').on(table.userId),
]);

export const policyMessages = pgTable('policy_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => policyConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('policy_messages_conversation_idx').on(table.conversationId),
  index('policy_messages_history_idx').on(table.conversationId, table.createdAt),
]);

export const policyRequestLogs = pgTable('policy_request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .references(() => policyConversations.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('policy_request_logs_conversation_idx').on(table.conversationId),
]);

export const policyDocuments = pgTable('policy_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  sourceKey: text('source_key').notNull(),
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  status: text('status').notNull().default('ready'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('policy_documents_tenant_source_idx').on(table.tenantId, table.sourceKey),
  index('policy_documents_tenant_idx').on(table.tenantId),
  index('policy_documents_status_idx').on(table.status),
]);

// The pgvector embedding column is managed through the raw SQL migration for now.
export const policyChunks = pgTable('policy_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => policyDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  embeddingModel: text('embedding_model').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('policy_chunks_document_chunk_idx').on(table.documentId, table.chunkIndex),
  index('policy_chunks_document_idx').on(table.documentId),
]);

export const retrievalLogs = pgTable('retrieval_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  query: text('query').notNull(),
  topK: integer('top_k').notNull(),
  matches: jsonb('matches').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('retrieval_logs_tenant_idx').on(table.tenantId),
]);
