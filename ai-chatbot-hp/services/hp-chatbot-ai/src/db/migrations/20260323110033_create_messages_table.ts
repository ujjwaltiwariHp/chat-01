import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id')
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE')
      .notNullable();
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for fast message lookups
    table.index(['conversation_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
}

