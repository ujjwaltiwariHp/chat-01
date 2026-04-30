// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const table = "lead_intelligence_analyses";

  // List of columns to ensure based on Drizzle schema
  const columns = [
    { name: "intent", type: "text", default: "UNKNOWN" },
    { name: "prompt_version", type: "text", default: "1.0.0" },
    { name: "schema_version", type: "text", default: "1.0.0" },
    {
      name: "confidence",
      type: "decimal",
      precision: 3,
      scale: 2,
      default: "1.00",
    },
    { name: "needs_human_review", type: "boolean", default: false },
    { name: "review_reason", type: "text" },
    { name: "citations", type: "jsonb", default: "[]" },
    { name: "icp_profile_id", type: "uuid" },
    { name: "cost_estimate_cents", type: "bigint", default: 0 },
    { name: "tokens_used", type: "bigint", default: 0, forceUpdate: true },
  ];

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn(table, col.name);
    if (!hasCol) {
      await knex.schema.alterTable(table, (t) => {
        let colDef;
        if (col.type === "text") colDef = t.text(col.name);
        else if (col.type === "boolean") colDef = t.boolean(col.name);
        else if (col.type === "jsonb") colDef = t.jsonb(col.name);
        else if (col.type === "uuid") {
          colDef = t.uuid(col.name);
          if (col.name === "icp_profile_id") {
            colDef
              .references("id")
              .inTable("lead_intelligence_icp_profiles")
              .onDelete("SET NULL");
          }
        } else if (col.type === "bigint") colDef = t.bigint(col.name);
        else if (col.type === "decimal")
          colDef = t.decimal(col.name, col.precision, col.scale);

        if (col.default !== undefined) colDef.defaultTo(col.default);
      });
    } else if (col.forceUpdate && col.name === "tokens_used") {
      // Ensure it is bigint (current is integer)
      await knex.raw(
        `ALTER TABLE ${table} ALTER COLUMN tokens_used TYPE bigint`,
      );
    }
  }
}

export async function down(knex: Knex): Promise<void> {}
