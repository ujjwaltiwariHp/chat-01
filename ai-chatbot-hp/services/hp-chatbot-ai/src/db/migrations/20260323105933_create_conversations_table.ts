import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure the extension for UUID generation is present for Postgres
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('session_id').notNullable();
    table.uuid('tenant_id').notNullable();
    table.string('customer_id');
    table.string('source').defaultTo('widget');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.text('summary');

    // Indexes for fast history lookups
    table.index(['session_id']);
    table.index(['tenant_id']);
    table.index(['customer_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('conversations');
}

