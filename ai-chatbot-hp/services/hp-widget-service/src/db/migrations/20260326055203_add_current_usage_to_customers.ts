import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('widget_customers', (table) => {
    table.integer('current_usage').defaultTo(0).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('widget_customers', (table) => {
    table.dropColumn('current_usage');
  });
}
