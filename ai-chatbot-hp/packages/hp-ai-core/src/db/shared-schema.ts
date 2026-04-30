import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Shared Multi-tenant Identity Schema
 * This schema is the ONE Source of Truth for all services in the monorepo.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'suspended'
  apiKey: text('api_key').unique(),
  credits: integer('credits').default(0).notNull(),
  version: integer('version').default(1).notNull(), // <--- P10 Optimistic Locking
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Other potential shared tables: users, subscriptions, etc.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  tenantId: uuid('tenant_id').references(() => tenants.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: text('used').notNull().default('false'), // 'true' | 'false' (Postgres boolean can be used but text 'true' is common in legacy HP code, wait I'll use text or boolean)
  tenantId: uuid('tenant_id').references(() => tenants.id),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * P10: Strategic Slack Multi-Tenant Orchestration
 * Maps Slack Team IDs (Workspaces) to our internal Tenant architecture.
 */
export const slackTeamInstalls = pgTable('slack_team_installs', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: text('team_id').unique().notNull(), // The Slack Team ID (e.g., T12345)
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(), // The internal Platform Tenant
  botToken: text('bot_token').notNull(), // Encrypted Slack Bot User Token
  botUserId: text('bot_user_id'),
  teamName: text('team_name'),
  installedBy: text('installed_by'), // Slack User ID who authorized the installation
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiBillingEvents = pgTable('ai_billing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: text('request_id').notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  service: text('service').notNull(),
  operation: text('operation').notNull().default('invoke'),
  model: text('model').notNull(),
  status: text('status').notNull().default('reserved'),
  requestOutcome: text('request_outcome').notNull().default('pending'),
  estimatedPromptTokens: integer('estimated_prompt_tokens').notNull().default(0),
  requestedCompletionTokens: integer('requested_completion_tokens').notNull().default(0),
  requestedTokenBudget: integer('requested_token_budget').notNull().default(0),
  reservedTokens: integer('reserved_tokens').notNull().default(0),
  actualPromptTokens: integer('actual_prompt_tokens').notNull().default(0),
  actualCompletionTokens: integer('actual_completion_tokens').notNull().default(0),
  actualTotalTokens: integer('actual_total_tokens').notNull().default(0),
  refundedTokens: integer('refunded_tokens').notNull().default(0),
  additionalChargedTokens: integer('additional_charged_tokens').notNull().default(0),
  uncollectedTokens: integer('uncollected_tokens').notNull().default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('ai_billing_request_id_uidx').on(table.requestId),
  index('ai_billing_tenant_idx').on(table.tenantId),
  index('ai_billing_created_at_idx').on(table.createdAt),
]);
