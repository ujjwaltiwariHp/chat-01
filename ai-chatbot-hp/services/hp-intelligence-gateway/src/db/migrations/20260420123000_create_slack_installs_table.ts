import type { Knex } from 'knex';

/**
 * P10: Migration to create slack_team_installs table
 * This table maps Slack Workspaces to internal Tenants and stores bot tokens.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('slack_team_installs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('team_id').unique().notNullable();
    table.uuid('tenant_id').references('id').inTable('tenants').notNullable().onDelete('CASCADE');
    table.text('bot_token').notNullable(); 
    table.string('bot_user_id').nullable();
    table.string('team_name').nullable();
    table.string('installed_by').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indices for performance
    table.index(['team_id'], 'idx_slack_team_id');
    table.index(['tenant_id'], 'idx_slack_tenant_id');
  });

  // Re-use the update_updated_at_column function created in earlier migrations
  await knex.raw(`
    CREATE TRIGGER update_slack_installs_updated_at
    BEFORE UPDATE ON slack_team_installs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('slack_team_installs');
}
