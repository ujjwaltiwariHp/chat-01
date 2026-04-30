// @ts-nocheck
import type { Knex } from "knex";

/**
 * Migration to add the shared ai_billing_events table.
 * This table is used by all AI services (chatbot, hr-policy, categorizer)
 * via the shared @hp-intelligence/core billing logic.
 */
export async function up(knex: Knex): Promise<void> {
  const hasSharedBillingTable = await knex.schema.hasTable("ai_billing_events");

  if (!hasSharedBillingTable) {
    await knex.schema.createTable("ai_billing_events", (table: any) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("request_id").notNullable().unique();
      table.uuid("tenant_id").notNullable().references("id").inTable("tenants");
      table.string("service", 100).notNullable();
      table.string("operation", 50).notNullable().defaultTo("invoke");
      table.string("model", 100).notNullable();
      table.string("status", 30).notNullable().defaultTo("reserved");
      table.string("request_outcome", 30).notNullable().defaultTo("pending");
      table.integer("estimated_prompt_tokens").notNullable().defaultTo(0);
      table.integer("requested_completion_tokens").notNullable().defaultTo(0);
      table.integer("requested_token_budget").notNullable().defaultTo(0);
      table.integer("reserved_tokens").notNullable().defaultTo(0);
      table.integer("actual_prompt_tokens").notNullable().defaultTo(0);
      table.integer("actual_completion_tokens").notNullable().defaultTo(0);
      table.integer("actual_total_tokens").notNullable().defaultTo(0);
      table.integer("refunded_tokens").notNullable().defaultTo(0);
      table.integer("additional_charged_tokens").notNullable().defaultTo(0);
      table.integer("uncollected_tokens").notNullable().defaultTo(0);
      table.text("error_message");
      table.jsonb("metadata");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table.index(["tenant_id"], "ai_billing_tenant_idx");
      table.index(["created_at"], "ai_billing_created_at_idx");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ai_billing_events");
}
