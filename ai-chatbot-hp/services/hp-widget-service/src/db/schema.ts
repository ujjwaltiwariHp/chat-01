import { pgTable, uuid, varchar, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

// Widget customers table
export const widgetCustomers = pgTable('widget_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  apiKey: varchar('api_key', { length: 255 }).unique().notNull(),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  conversationsLimit: integer('conversations_limit').default(10).notNull(),
  resetDate: timestamp('reset_date').notNull(),
  allowedDomains: jsonb('allowed_domains').$type<string[]>().default([]).notNull(),
  widgetConfig: jsonb('widget_config').$type<any>().default({}).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [
  index('api_key_idx').on(table.apiKey),
  index('email_idx').on(table.email)
]);

// Magic link tokens table (Synced with Core)
export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: varchar('used', { length: 10 }).default('false').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [
  index('token_idx').on(table.token),
  index('email_token_idx').on(table.email)
]);
