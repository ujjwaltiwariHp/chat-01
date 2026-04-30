// @ts-nocheck
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasRequestIdColumn = await knex.schema.hasColumn('categorization_logs', 'request_id');
  if (!hasRequestIdColumn) {
    await knex.schema.alterTable('categorization_logs', (table: any) => {
      table.string('request_id');
      table.index(['request_id'], 'categorizer_request_id_idx');
    });
  }

  const hasLegacyBillingTable = await knex.schema.hasTable('categorization_billing_events');
  const hasSharedBillingTable = await knex.schema.hasTable('ai_billing_events');

  if (hasLegacyBillingTable && !hasSharedBillingTable) {
    await knex.schema.renameTable('categorization_billing_events', 'ai_billing_events');
    await knex.schema.alterTable('ai_billing_events', (table: any) => {
      table.string('service', 100).notNullable().defaultTo('lead-categorizer');
      table.string('operation', 50).notNullable().defaultTo('categorize');
      table.jsonb('metadata');
      table.dropColumn('source');
      table.dropColumn('type');
    });
    await knex.raw('ALTER INDEX IF EXISTS categorizer_billing_request_id_uidx RENAME TO ai_billing_request_id_uidx');
    await knex.raw('ALTER INDEX IF EXISTS categorizer_billing_tenant_idx RENAME TO ai_billing_tenant_idx');
    await knex.raw('ALTER INDEX IF EXISTS categorizer_billing_created_at_idx RENAME TO ai_billing_created_at_idx');
  }

  if (!hasSharedBillingTable && !(hasLegacyBillingTable && !hasSharedBillingTable)) {
    await knex.schema.createTable('ai_billing_events', (table: any) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('request_id').notNullable().unique();
      table.uuid('tenant_id').notNullable();
      table.string('service', 100).notNullable();
      table.string('operation', 50).notNullable().defaultTo('invoke');
      table.string('model', 100).notNullable();
      table.string('status', 30).notNullable().defaultTo('reserved');
      table.string('request_outcome', 30).notNullable().defaultTo('pending');
      table.integer('estimated_prompt_tokens').notNullable().defaultTo(0);
      table.integer('requested_completion_tokens').notNullable().defaultTo(0);
      table.integer('requested_token_budget').notNullable().defaultTo(0);
      table.integer('reserved_tokens').notNullable().defaultTo(0);
      table.integer('actual_prompt_tokens').notNullable().defaultTo(0);
      table.integer('actual_completion_tokens').notNullable().defaultTo(0);
      table.integer('actual_total_tokens').notNullable().defaultTo(0);
      table.integer('refunded_tokens').notNullable().defaultTo(0);
      table.integer('additional_charged_tokens').notNullable().defaultTo(0);
      table.integer('uncollected_tokens').notNullable().defaultTo(0);
      table.text('error_message');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'ai_billing_tenant_idx');
      table.index(['created_at'], 'ai_billing_created_at_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_billing_events');

  const hasRequestIdColumn = await knex.schema.hasColumn('categorization_logs', 'request_id');
  if (hasRequestIdColumn) {
    await knex.schema.alterTable('categorization_logs', (table: any) => {
      table.dropIndex(['request_id'], 'categorizer_request_id_idx');
      table.dropColumn('request_id');
    });
  }
}
