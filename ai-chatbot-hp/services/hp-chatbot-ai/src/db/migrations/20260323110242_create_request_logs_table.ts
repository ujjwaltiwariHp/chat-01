import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('request_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id')
      .references('id')
      .inTable('conversations')
      .onDelete('SET NULL'); // Keep logs even if conversation is deleted
    
    table.string('model').notNullable();
    table.integer('prompt_tokens').defaultTo(0);
    table.integer('completion_tokens').defaultTo(0);
    table.integer('total_tokens').defaultTo(0);
    table.integer('latency_ms').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Index for analytics
    table.index(['conversation_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('request_logs');
}

