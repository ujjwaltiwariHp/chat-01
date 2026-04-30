import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableName = "lead_intelligence_icp_profiles";

  const hasName = await knex.schema.hasColumn(tableName, "name");
  if (!hasName) {
    await knex.schema.alterTable(tableName, (table) => {
      table.text("name").notNullable().defaultTo("Standard ICP");
      table.boolean("is_default").notNullable().defaultTo(false);
      table.jsonb("target_personas").defaultTo(knex.raw("'[]'::jsonb"));
      table.jsonb("negative_personas").defaultTo(knex.raw("'[]'::jsonb"));
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const tableName = "lead_intelligence_icp_profiles";
  const hasName = await knex.schema.hasColumn(tableName, "name");

  if (hasName) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn("name");
      table.dropColumn("is_default");
      table.dropColumn("target_personas");
      table.dropColumn("negative_personas");
    });
  }
}
