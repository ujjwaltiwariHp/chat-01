// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Update ICP profiles with versioning
  const hasVersion = await knex.schema.hasColumn(
    "lead_intelligence_icp_profiles",
    "version",
  );
  if (!hasVersion) {
    await knex.schema.alterTable("lead_intelligence_icp_profiles", (table) => {
      table.integer("version").notNullable().defaultTo(1);
      table.boolean("is_active").notNullable().defaultTo(true);
      table.index(["is_active"], "lead_icp_profiles_active_idx");
    });
  }

  // Create Usage Events Table
  if (!(await knex.schema.hasTable("lead_intelligence_usage_events"))) {
    await knex.schema.createTable("lead_intelligence_usage_events", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("tenant_id")
        .notNullable()
        .references("id")
        .inTable("tenants")
        .onDelete("CASCADE");
      table.string("event_type", 100).notNullable();
      table.string("model_used", 100).nullable();
      table.integer("tokens_used").defaultTo(0);
      table.decimal("cost_usd", 10, 6).defaultTo(0);
      table.jsonb("metadata").defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamp("created_at").defaultTo(knex.fn.now());

      table.index(["tenant_id"], "lead_usage_events_tenant_idx");
      table.index(["event_type"], "lead_usage_events_type_idx");
      table.index(["created_at"], "lead_usage_events_created_idx");
    });

    // Enable RLS
    await knex.raw(
      `ALTER TABLE lead_intelligence_usage_events ENABLE ROW LEVEL SECURITY;`,
    );
    await knex.raw(
      `ALTER TABLE lead_intelligence_usage_events FORCE ROW LEVEL SECURITY;`,
    );

    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lead_intelligence_usage_events' AND policyname = 'lead_intelligence_usage_events_tenant_policy'
        ) THEN
          CREATE POLICY lead_intelligence_usage_events_tenant_policy ON lead_intelligence_usage_events
          USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::uuid);
        END IF;
      END
      $$;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("lead_intelligence_usage_events");
  await knex.schema.alterTable("lead_intelligence_icp_profiles", (table) => {
    table.dropColumn("version");
    table.dropColumn("is_active");
  });
}
