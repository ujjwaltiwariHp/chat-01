import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure the extension for UUID generation is present for Postgres
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('widget_customers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('api_key').unique().notNullable();
    table.string('plan').defaultTo('free');
    table.integer('conversations_limit').defaultTo(10);
    table.timestamp('reset_date').notNullable();
    table.jsonb('allowed_domains').defaultTo('[]');
    table.jsonb('widget_config').defaultTo('{}');
    table.boolean('enabled').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for fast authentication
    table.index(['api_key']);
    table.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('widget_customers');
}

