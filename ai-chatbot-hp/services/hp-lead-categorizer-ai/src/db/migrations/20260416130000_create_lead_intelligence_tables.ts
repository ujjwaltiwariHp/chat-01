// @ts-nocheck
import type { Knex } from 'knex';

const jsonEmptyObject = (knex: Knex) => knex.raw(`'{}'::jsonb`);
const jsonEmptyArray = (knex: Knex) => knex.raw(`'[]'::jsonb`);

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('lead_intelligence_icp_profiles'))) {
    await knex.schema.createTable('lead_intelligence_icp_profiles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.jsonb('target_industries').notNullable().defaultTo(jsonEmptyArray(knex));
      table.string('company_size_range', 100).notNullable();
      table.integer('budget_range_min').notNullable();
      table.integer('budget_range_max').notNullable();
      table.jsonb('deal_breaker_signals').notNullable().defaultTo(jsonEmptyArray(knex));
      table.jsonb('strong_fit_signals').notNullable().defaultTo(jsonEmptyArray(knex));
      table.jsonb('services_offered').notNullable().defaultTo(jsonEmptyArray(knex));
      table.text('additional_context').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id'], { indexName: 'lead_icp_profiles_tenant_uidx' });
      table.index(['tenant_id'], 'lead_icp_profiles_tenant_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_leads'))) {
    await knex.schema.createTable('lead_intelligence_leads', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('source', 50).notNullable();
      table.string('status', 50).notNullable().defaultTo('new');
      table.string('name', 255).nullable();
      table.string('email', 255).nullable();
      table.string('phone', 50).nullable();
      table.string('company_name', 255).nullable();
      table.jsonb('raw_data').notNullable().defaultTo(jsonEmptyObject(knex));
      table.jsonb('normalized_data').nullable();
      table.string('classification', 50).nullable();
      table.uuid('assigned_to').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('stale_at').nullable();
      table.timestamp('deleted_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'lead_intelligence_leads_tenant_idx');
      table.index(['email'], 'lead_intelligence_leads_email_idx');
      table.index(['phone'], 'lead_intelligence_leads_phone_idx');
      table.index(['status'], 'lead_intelligence_leads_status_idx');
      table.index(['classification'], 'lead_intelligence_leads_classification_idx');
      table.index(['created_at'], 'lead_intelligence_leads_created_at_idx');
      table.index(['tenant_id', 'email'], 'lead_intelligence_leads_tenant_email_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_analyses'))) {
    await knex.schema.createTable('lead_intelligence_analyses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('lead_id').notNullable().references('id').inTable('lead_intelligence_leads').onDelete('CASCADE');
      table.string('model_used', 100).notNullable();
      table.string('analysis_tier', 30).notNullable();
      table.string('analysis_depth', 30).notNullable();
      table.text('summary').notNullable();
      table.string('classification', 50).notNullable();
      table.text('classification_reasoning').notNullable();
      table.jsonb('scoring_factors').notNullable().defaultTo(jsonEmptyArray(knex));
      table.jsonb('extracted_attributes').notNullable().defaultTo(jsonEmptyObject(knex));
      table.jsonb('risk_flags').notNullable().defaultTo(jsonEmptyArray(knex));
      table.text('suggested_action').notNullable();
      table.jsonb('conversation_highlights').nullable();
      table.jsonb('competitive_signals').nullable();
      table.jsonb('objection_predictions').nullable();
      table.jsonb('detailed_action_plan').nullable();
      table.jsonb('feedback').nullable();
      table.integer('tokens_used').notNullable().defaultTo(0);
      table.decimal('cost_estimate', 10, 6).notNullable().defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'lead_intelligence_analyses_tenant_idx');
      table.index(['lead_id'], 'lead_intelligence_analyses_lead_idx');
      table.index(['created_at'], 'lead_intelligence_analyses_created_at_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_email_drafts'))) {
    await knex.schema.createTable('lead_intelligence_email_drafts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('lead_id').notNullable().references('id').inTable('lead_intelligence_leads').onDelete('CASCADE');
      table.string('draft_type', 50).notNullable();
      table.string('subject', 255).notNullable();
      table.text('body').notNullable();
      table.string('model_used', 100).notNullable();
      table.timestamp('copied_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'lead_intelligence_email_drafts_tenant_idx');
      table.index(['lead_id'], 'lead_intelligence_email_drafts_lead_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_activities'))) {
    await knex.schema.createTable('lead_intelligence_activities', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('lead_id').notNullable().references('id').inTable('lead_intelligence_leads').onDelete('CASCADE');
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('activity_type', 50).notNullable();
      table.jsonb('details').notNullable().defaultTo(jsonEmptyObject(knex));
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['lead_id'], 'lead_intelligence_activities_lead_idx');
      table.index(['tenant_id'], 'lead_intelligence_activities_tenant_idx');
      table.index(['created_at'], 'lead_intelligence_activities_created_at_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_routing_rules'))) {
    await knex.schema.createTable('lead_intelligence_routing_rules', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.integer('priority').notNullable();
      table.string('condition_field', 50).notNullable();
      table.string('condition_operator', 50).notNullable();
      table.string('condition_value', 255).notNullable();
      table.uuid('action_assign_to').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'lead_intelligence_routing_rules_tenant_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_webhook_configs'))) {
    await knex.schema.createTable('lead_intelligence_webhook_configs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('url', 500).notNullable();
      table.string('secret', 255).notNullable();
      table.jsonb('events').notNullable().defaultTo(jsonEmptyArray(knex));
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id'], 'lead_intelligence_webhook_configs_tenant_idx');
    });
  }

  if (!(await knex.schema.hasTable('lead_intelligence_settings'))) {
    await knex.schema.createTable('lead_intelligence_settings', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('slack_webhook_url', 500).nullable();
      table.text('openai_api_key_encrypted').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id'], { indexName: 'lead_intelligence_settings_tenant_uidx' });
      table.index(['tenant_id'], 'lead_intelligence_settings_tenant_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lead_intelligence_settings');
  await knex.schema.dropTableIfExists('lead_intelligence_webhook_configs');
  await knex.schema.dropTableIfExists('lead_intelligence_routing_rules');
  await knex.schema.dropTableIfExists('lead_intelligence_activities');
  await knex.schema.dropTableIfExists('lead_intelligence_email_drafts');
  await knex.schema.dropTableIfExists('lead_intelligence_analyses');
  await knex.schema.dropTableIfExists('lead_intelligence_leads');
  await knex.schema.dropTableIfExists('lead_intelligence_icp_profiles');
}
