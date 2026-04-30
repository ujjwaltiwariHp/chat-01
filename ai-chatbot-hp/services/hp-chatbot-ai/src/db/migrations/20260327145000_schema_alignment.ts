import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add missing 'status' column to 'messages' table
  await knex.schema.alterTable('messages', (table) => {
    table.string('status').notNullable().defaultTo('completed');
  });

  // Add missing 'prompt_version' column to 'request_logs' table
  await knex.schema.alterTable('request_logs', (table) => {
    table.string('prompt_version').notNullable().defaultTo('v1');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('request_logs', (table) => {
    table.dropColumn('prompt_version');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('status');
  });
}
