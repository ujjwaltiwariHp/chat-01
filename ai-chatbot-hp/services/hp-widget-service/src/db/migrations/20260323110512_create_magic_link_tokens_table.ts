import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure the extension for UUID generation is present for Postgres
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('magic_link_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').notNullable();
    table.string('token').unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.string('used').defaultTo('false');
    table.uuid('tenant_id').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for fast verification
    table.index(['token']);
    table.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('magic_link_tokens');
}

