import type { Knex } from 'knex';

const TABLE_NAME = 'widget_customers';
const COLUMN_NAME = 'current_usage';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);

  if (hasColumn) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.dropColumn(COLUMN_NAME);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);

  if (!hasColumn) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.integer(COLUMN_NAME).defaultTo(0).notNullable();
    });
  }
}
