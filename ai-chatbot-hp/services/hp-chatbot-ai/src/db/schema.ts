import { pgTable, uuid, text, timestamp, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from '@hp-intelligence/core';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  userId: text('user_id').notNull(),
  summary: text('summary'),
  source: text('source').default('widget'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('session_idx').on(table.sessionId),
  index('tenant_idx').on(table.tenantId),
  index('user_idx').on(table.userId),
]);


export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // 'user' | 'assistant'
  content: text('content').notNull(),
  status: text('status').notNull().default('completed'), // 'completed' | 'stopped' | 'error' | 'streaming'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('conversation_idx').on(table.conversationId),
  index('conversation_history_idx').on(table.conversationId, table.createdAt),
]);

export const request_logs = pgTable('request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('log_conversation_idx').on(table.conversationId),
]);
