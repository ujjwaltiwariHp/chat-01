import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('policy_conversations', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('session_id').notNullable();
    table.uuid('tenant_id').notNullable();
    table.string('user_id');
    table.string('customer_id');
    table.text('summary');
    table.string('source').defaultTo('widget');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['session_id'], 'policy_conversations_session_idx');
    table.index(['tenant_id'], 'policy_conversations_tenant_idx');
    table.index(['user_id'], 'policy_conversations_user_idx');
  });

  await knex.schema.createTable('policy_messages', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id')
      .references('id')
      .inTable('policy_conversations')
      .onDelete('CASCADE')
      .notNullable();
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.string('status').notNullable().defaultTo('completed');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['conversation_id'], 'policy_messages_conversation_idx');
    table.index(['conversation_id', 'created_at'], 'policy_messages_history_idx');
  });

  await knex.schema.createTable('policy_request_logs', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id')
      .references('id')
      .inTable('policy_conversations')
      .onDelete('SET NULL');
    table.string('model').notNullable();
    table.string('prompt_version').notNullable();
    table.integer('prompt_tokens').notNullable().defaultTo(0);
    table.integer('completion_tokens').notNullable().defaultTo(0);
    table.integer('total_tokens').notNullable().defaultTo(0);
    table.integer('latency_ms').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['conversation_id'], 'policy_request_logs_conversation_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('policy_request_logs');
  await knex.schema.dropTableIfExists('policy_messages');
  await knex.schema.dropTableIfExists('policy_conversations');
}
