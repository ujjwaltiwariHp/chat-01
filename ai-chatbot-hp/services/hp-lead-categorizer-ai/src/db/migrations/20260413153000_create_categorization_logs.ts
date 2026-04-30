// @ts-nocheck
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("categorization_logs"))) {
    await knex.schema.createTable("categorization_logs", (table: any) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("tenant_id").notNull();
      table.string("source", 50).notNull().defaultTo("direct-api");
      table.string("type", 50).notNull().defaultTo("raw");
      table.text("raw_input").notNull();
      table.jsonb("result").notNull();
      table.integer("latency_ms").notNull();
      table.integer("total_tokens").notNull();
      table.string("model", 100).notNull();
      table.timestamp("created_at").defaultTo(knex.fn.now());

      table.index(["tenant_id"], "categorizer_tenant_idx");
      table.index(["created_at"], "categorizer_created_at_idx");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("categorization_logs");
}
