// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableName = "lead_intelligence_leads";

  // List of indexes to ensure exist
  const indexes = [
    { name: "lead_intelligence_leads_external_id_idx", column: "external_id" },
    { name: "lead_intelligence_leads_tenant_idx", column: "tenant_id" },
    { name: "lead_intelligence_leads_email_idx", column: "email" },
  ];

  for (const idx of indexes) {
    // We use a raw query to check for index existence in Postgres
    const checkIndex = await knex.raw(
      `
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = ? AND n.nspname = 'public'
    `,
      [idx.name],
    );

    if (checkIndex.rows.length === 0) {
      await knex.schema.alterTable(tableName, (t) => {
        t.index(idx.column, idx.name);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {}
