// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Sync lead_intelligence_usage_events
  const hasUsagePromptVersion = await knex.schema.hasColumn(
    "lead_intelligence_usage_events",
    "prompt_version",
  );
  if (!hasUsagePromptVersion) {
    await knex.schema.alterTable("lead_intelligence_usage_events", (t) => {
      t.text("prompt_version");
      t.bigint("cost_usd_cents").defaultTo(0);
    });
    // Ensure tokens_used is bigint
    await knex.raw(
      "ALTER TABLE lead_intelligence_usage_events ALTER COLUMN tokens_used TYPE bigint",
    );
  }

  // 2. Sync lead_intelligence_routing_rules
  const hasRuleGroup = await knex.schema.hasColumn(
    "lead_intelligence_routing_rules",
    "rule_group",
  );
  if (!hasRuleGroup) {
    await knex.schema.alterTable("lead_intelligence_routing_rules", (t) => {
      t.text("rule_group");
      t.text("logical_operator").notNullable().defaultTo("AND");
      t.text("territory");
      t.jsonb("geo_allowlist");
      t.bigint("min_deal_size_cents");
      t.uuid("action_assign_team");
    });
  }

  // 3. Create missing tables
  if (!(await knex.schema.hasTable("lead_intelligence_teams"))) {
    await knex.schema.createTable("lead_intelligence_teams", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("tenant_id")
        .notNullable()
        .references("id")
        .inTable("tenants")
        .onDelete("CASCADE");
      t.text("name").notNullable();
      t.integer("last_assigned_index").notNullable().defaultTo(0);
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("lead_intelligence_team_members"))) {
    await knex.schema.createTable("lead_intelligence_team_members", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("team_id")
        .notNullable()
        .references("id")
        .inTable("lead_intelligence_teams")
        .onDelete("CASCADE");
      t.uuid("user_id")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      t.boolean("is_active").notNullable().defaultTo(true);
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("lead_intelligence_evals"))) {
    await knex.schema.createTable("lead_intelligence_evals", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("tenant_id")
        .notNullable()
        .references("id")
        .inTable("tenants")
        .onDelete("CASCADE");
      t.uuid("lead_id")
        .notNullable()
        .unique()
        .references("id")
        .inTable("lead_intelligence_leads")
        .onDelete("CASCADE");
      t.uuid("analysis_id")
        .references("id")
        .inTable("lead_intelligence_analyses")
        .onDelete("SET NULL");
      t.text("ground_truth_classification").notNullable();
      t.text("ground_truth_intent");
      t.text("labeler_email").notNullable();
      t.text("notes");
      t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("lead_intelligence_request_logs"))) {
    await knex.schema.createTable("lead_intelligence_request_logs", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("tenant_id").notNullable();
      t.text("method").notNullable();
      t.text("path").notNullable();
      t.integer("status_code").notNullable();
      t.integer("latency_ms").notNullable();
      t.text("ip_address");
      t.text("user_agent");
      t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("lead_intelligence_webhook_logs"))) {
    await knex.schema.createTable("lead_intelligence_webhook_logs", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("tenant_id")
        .notNullable()
        .references("id")
        .inTable("tenants")
        .onDelete("CASCADE");
      t.uuid("webhook_config_id")
        .notNullable()
        .references("id")
        .inTable("lead_intelligence_webhook_configs")
        .onDelete("CASCADE");
      t.text("event").notNullable();
      t.jsonb("payload").notNullable();
      t.integer("response_status");
      t.text("response_body");
      t.integer("latency_ms");
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe migrations don't drop tables in this environment usually
}
