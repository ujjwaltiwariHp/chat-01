import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // P6-07: Optimized indices for high-volume chat history retrieval
  await knex.schema.alterTable('messages', (table) => {
    table.index(['conversation_id', 'created_at'], 'messages_conv_created_idx');
  });

  await knex.schema.alterTable('conversations', (table) => {
    table.index(['tenant_id', 'session_id'], 'conv_tenant_session_idx');
    table.index(['tenant_id', 'user_id'], 'conv_tenant_user_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (table) => {
    table.dropIndex(['conversation_id', 'created_at'], 'messages_conv_created_idx');
  });

  await knex.schema.alterTable('conversations', (table) => {
    table.dropIndex(['tenant_id', 'session_id'], 'conv_tenant_session_idx');
    table.dropIndex(['tenant_id', 'user_id'], 'conv_tenant_user_idx');
  });
}
