import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector');

  await knex.schema.createTable('policy_documents', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable();
    table.string('source_key').notNullable();
    table.text('title').notNullable();
    table.text('source_url');
    table.string('status').notNullable().defaultTo('ready');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'source_key']);
    table.index(['tenant_id'], 'policy_documents_tenant_idx');
    table.index(['status'], 'policy_documents_status_idx');
  });

  await knex.schema.createTable('policy_chunks', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('document_id')
      .references('id')
      .inTable('policy_documents')
      .onDelete('CASCADE')
      .notNullable();
    table.integer('chunk_index').notNullable();
    table.text('content').notNullable();
    table.integer('token_count').notNullable().defaultTo(0);
    table.string('embedding_model').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['document_id', 'chunk_index']);
    table.index(['document_id'], 'policy_chunks_document_idx');
  });

  await knex.raw('ALTER TABLE policy_chunks ADD COLUMN embedding vector(1536) NOT NULL');
  await knex.raw('CREATE INDEX policy_chunks_embedding_idx ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');

  await knex.schema.createTable('retrieval_logs', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable();
    table.text('query').notNullable();
    table.integer('top_k').notNullable();
    table.jsonb('matches').notNullable().defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id'], 'retrieval_logs_tenant_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('retrieval_logs');
  await knex.schema.dropTableIfExists('policy_chunks');
  await knex.schema.dropTableIfExists('policy_documents');
}
