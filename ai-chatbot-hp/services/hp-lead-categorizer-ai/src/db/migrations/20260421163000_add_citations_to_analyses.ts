// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasCitations = await knex.schema.hasColumn(
    "lead_intelligence_analyses",
    "citations",
  );
  if (!hasCitations) {
    await knex.schema.alterTable("lead_intelligence_analyses", (table) => {
      table.jsonb("citations").notNull().defaultTo("[]");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("lead_intelligence_analyses", (table) => {
    table.dropColumn("citations");
  });
}
