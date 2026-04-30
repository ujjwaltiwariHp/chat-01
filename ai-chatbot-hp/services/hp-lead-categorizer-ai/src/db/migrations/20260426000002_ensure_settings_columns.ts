// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableName = "lead_intelligence_settings";

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
    const hasCol = await knex.schema.hasColumn(tableName, col.name);
    if (!hasCol) {
      await knex.schema.alterTable(tableName, (t) => {
        let colDef;
        if (col.type === "text") colDef = t.text(col.name);
        else if (col.type === "jsonb") colDef = t.jsonb(col.name);
        else if (col.type === "bigint") colDef = t.bigint(col.name);
        else if (col.type === "timestamp") colDef = t.timestamp(col.name);

        if (col.default !== undefined) colDef.defaultTo(col.default);
      });
    }
  }

  // REPAIR: lead_intelligence_webhook_configs
  const hasIsActive = await knex.schema.hasColumn(
    "lead_intelligence_webhook_configs",
    "is_active",
  );
  if (!hasIsActive) {
    await knex.schema.alterTable("lead_intelligence_webhook_configs", (t) => {
      t.boolean("is_active").notNull().defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {}
