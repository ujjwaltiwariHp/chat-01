// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Add external_id to leads if it doesn't exist
  const hasExternalId = await knex.schema.hasColumn(
    "lead_intelligence_leads",
    "external_id",
  );
  if (!hasExternalId) {
    await knex.schema.alterTable("lead_intelligence_leads", (table) => {
      table.text("external_id").nullable();
    });
    // Create index separately to be safe
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS "lead_intelligence_leads_external_id_idx" ON "lead_intelligence_leads" ("external_id")',
    );
  }

  // 2. Ensure RLS policies are active and up to date for all service tables
  // This block ensures that even if tables were created manually or via Drizzle,
  // the standard Knex-managed RLS policies are applied.
  await knex.raw(`
    DO $$ 
    DECLARE
        t text;
        tables text[] := ARRAY[
            'lead_intelligence_icp_profiles',
            'lead_intelligence_usage_events',
            'lead_intelligence_leads',
            'lead_intelligence_analyses',
            'lead_intelligence_email_drafts',
            'lead_intelligence_activities',
            'lead_intelligence_routing_rules',
            'lead_intelligence_webhook_configs',
            'lead_intelligence_settings',
            'categorization_logs'
        ];
    BEGIN
        FOREACH t IN ARRAY tables
        LOOP
            -- Check if table exists before altering
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
                EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
                EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
                EXECUTE format('DROP POLICY IF EXISTS %I_tenant_policy ON %I', t, t);
                EXECUTE format('CREATE POLICY %I_tenant_policy ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant'', TRUE), '''')::uuid)', t, t);
            END IF;
        END LOOP;
    END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasExternalId = await knex.schema.hasColumn(
    "lead_intelligence_leads",
    "external_id",
  );
  if (hasExternalId) {
    await knex.schema.alterTable("lead_intelligence_leads", (table) => {
      table.dropColumn("external_id");
    });
  }
}
