// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableName = "lead_intelligence_leads";

  await knex.schema.alterTable(tableName, (table) => {
    // Add columns if they don't exist
  });

  // Since Knex.schema.hasColumn is async, we do it safely via raw SQL or helper
  const columns = [
    { name: "lifecycle_stage", type: "text", default: "lead" },
    { name: "confidence", type: "decimal(3,2)", default: "1.00" },
    { name: "needs_human_review", type: "boolean", default: false },
    { name: "review_reason", type: "text" },
    { name: "classification", type: "text" },
    { name: "classification_history", type: "jsonb", default: "[]" },
    { name: "external_id", type: "text" },
    { name: "assigned_to", type: "uuid" },
    { name: "freeze_until", type: "timestamp" },
    { name: "stale_at", type: "timestamp" },
    { name: "deleted_at", type: "timestamp" },
    { name: "updated_at", type: "timestamp", default: "now()" },
  ];

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn(tableName, col.name);
    if (!hasCol) {
      await knex.schema.alterTable(tableName, (t) => {
        let colDef;
        if (col.type === "text") colDef = t.text(col.name);
        else if (col.type === "boolean") colDef = t.boolean(col.name);
        else if (col.type === "jsonb") colDef = t.jsonb(col.name);
        else if (col.type === "uuid") colDef = t.uuid(col.name);
        else if (col.type === "timestamp") colDef = t.timestamp(col.name);
        else if (col.type === "decimal(3,2)")
          colDef = t.decimal(col.name, 3, 2);

        if (col.default !== undefined) {
          if (col.default === "now()") colDef.defaultTo(knex.fn.now());
          else colDef.defaultTo(col.default);
        }
      });
    }
  }

  // REPAIR: lead_intelligence_analyses
  const analysisCols = [
    { name: "intent", type: "text", default: "UNKNOWN" },
    { name: "prompt_version", type: "text", default: "1.0.0" },
    { name: "schema_version", type: "text", default: "1.0.0" },
    { name: "citations", type: "jsonb", default: "[]" },
    { name: "tokens_used", type: "bigint", default: 0 },
    { name: "cost_estimate_cents", type: "bigint", default: 0 },
  ];

  for (const col of analysisCols) {
    const hasCol = await knex.schema.hasColumn(
      "lead_intelligence_analyses",
      col.name,
    );
    if (!hasCol) {
      await knex.schema.alterTable("lead_intelligence_analyses", (t) => {
        let colDef;
        if (col.type === "text") colDef = t.text(col.name);
        else if (col.type === "jsonb") colDef = t.jsonb(col.name);
        else if (col.type === "bigint") colDef = t.bigint(col.name);

        if (col.default !== undefined) colDef.defaultTo(col.default);
      });
    }
  }

  // REPAIR: lead_intelligence_settings
  const settingCols = [
    { name: "slack_webhook_url", type: "text" },
    { name: "openai_api_key_encrypted", type: "text" },
    { name: "previous_openai_api_key_encrypted", type: "text" },
    { name: "rotated_at", type: "timestamp" },
    {
      name: "consent_data",
      type: "jsonb",
      default: '{"enabled": false, "text": ""}',
    },
    { name: "cost_limit_daily_cents", type: "bigint", default: 1000 },
    {
      name: "decay_config",
      type: "jsonb",
      default: '{"overrides": [], "defaultDays": 30}',
    },
    { name: "timezone", type: "text", default: "UTC" },
  ];

  for (const col of settingCols) {
    const hasCol = await knex.schema.hasColumn(
      "lead_intelligence_settings",
      col.name,
    );
    if (!hasCol) {
      await knex.schema.alterTable("lead_intelligence_settings", (t) => {
        let colDef;
        if (col.type === "text") colDef = t.text(col.name);
        else if (col.type === "jsonb") colDef = t.jsonb(col.name);
        else if (col.type === "bigint") colDef = t.bigint(col.name);
        else if (col.type === "timestamp") colDef = t.timestamp(col.name);

        if (col.default !== undefined) colDef.defaultTo(col.default);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe migrations usually don't drop columns in down() to prevent data loss
}
