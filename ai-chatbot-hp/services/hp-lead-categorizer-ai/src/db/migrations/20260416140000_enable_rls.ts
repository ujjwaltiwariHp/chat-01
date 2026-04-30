// @ts-nocheck
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tables = [
    'lead_intelligence_icp_profiles',
    'lead_intelligence_leads',
    'lead_intelligence_analyses',
    'lead_intelligence_email_drafts',
    'lead_intelligence_activities',
    'lead_intelligence_routing_rules',
    'lead_intelligence_webhook_configs',
    'lead_intelligence_settings',
  ];

  for (const table of tables) {
    // Enable RLS
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);

    // Create Policy: Access only if tenant_id matches app.current_tenant session variable
    // We use COALESCE to avoid errors if the session variable is unset (it will deny access)
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = '${table}_tenant_policy'
        ) THEN
          CREATE POLICY ${table}_tenant_policy ON ${table}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::uuid);
        END IF;
      END
      $$;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'lead_intelligence_icp_profiles',
    'lead_intelligence_leads',
    'lead_intelligence_analyses',
    'lead_intelligence_email_drafts',
    'lead_intelligence_activities',
    'lead_intelligence_routing_rules',
    'lead_intelligence_webhook_configs',
    'lead_intelligence_settings',
  ];

  for (const table of tables) {
    await knex.raw(`DROP POLICY IF EXISTS ${table}_tenant_policy ON ${table};`);
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
  }
}
