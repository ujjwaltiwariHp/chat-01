#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pnpm new-bot -- --name <bot-name> --port <port> [--rag]
  pnpm new-bot <bot-name> <port> [--rag]

Examples:
  pnpm new-bot -- --name email-writer --port 4003
  pnpm new-bot -- --name hr-policy --port 4003 --rag
  pnpm new-bot hr-policy 4003 --rag
EOF
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

name=""
port=""
scaffold_mode="basic"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name|-n)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1"
        usage
        exit 1
      fi
      name="$2"
      shift 2
      ;;
    --port|-p)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1"
        usage
        exit 1
      fi
      port="$2"
      shift 2
      ;;
    --rag)
      scaffold_mode="rag"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$name" ]]; then
        name="$1"
      elif [[ -z "$port" ]]; then
        port="$1"
      else
        echo "Unknown argument: $1"
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$name" || -z "$port" ]]; then
  usage
  exit 1
fi

if ! [[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Bot name must use lowercase letters, numbers, and hyphens only."
  exit 1
fi

if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "Port must be a number between 1 and 65535."
  exit 1
fi

service_slug="hp-${name}-ai"
package_name="@hp-intelligence/${name}-ai"
service_rel_dir="services/${service_slug}"
service_dir="${repo_root}/${service_rel_dir}"
port_env_key="$(printf '%s' "$name" | tr '[:lower:]-' '[:upper:]_')_PORT"
migration_table="$(printf '%s_migrations' "$name" | tr '-' '_')"

if [[ -e "$service_dir" ]]; then
  echo "Service already exists at ${service_rel_dir}"
  exit 1
fi

write_base_scaffold() {
  mkdir -p "$service_dir/src/routes/v1"
  mkdir -p "$service_dir/src/controllers"
  mkdir -p "$service_dir/src/services"
  mkdir -p "$service_dir/src/prompts"

  cat > "$service_dir/package.json" <<EOF
{
  "name": "${package_name}",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "tsx watch --env-file=../../.env src/server.ts",
    "build": "tsc && tsc-alias"
  },
  "dependencies": {
    "@hp-intelligence/core": "workspace:*",
    "fastify": "^5.8.2",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsc-alias": "^1.8.16",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
EOF

  cat > "$service_dir/tsconfig.json" <<EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@hp-intelligence/core": ["../../packages/hp-ai-core/src"],
      "@hp-intelligence/core/*": ["../../packages/hp-ai-core/src/*"],
      "@/*": ["src/*"]
    }
  },
  "references": [
    { "path": "../../packages/hp-ai-core" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

  cat > "$service_dir/Dockerfile" <<EOF
# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/hp-ai-core ./packages/hp-ai-core
COPY ${service_rel_dir} ./${service_rel_dir}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hp-intelligence/core build
RUN pnpm --filter ${package_name} build

# Stage 2: Runtime
FROM node:24-slim AS runner

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/hp-ai-core/dist ./packages/hp-ai-core/dist
COPY --from=builder /usr/src/app/packages/hp-ai-core/package.json ./packages/hp-ai-core/package.json
COPY --from=builder /usr/src/app/${service_rel_dir}/dist ./${service_rel_dir}/dist
COPY --from=builder /usr/src/app/${service_rel_dir}/package.json ./${service_rel_dir}/package.json

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "fetch('http://localhost:${port}/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENV NODE_ENV=production
ENV ${port_env_key}=${port}

CMD ["node", "${service_rel_dir}/dist/server.js"]
EOF

  cat > "$service_dir/src/config/index.ts" <<EOF
import { z } from 'zod';
import { validateBaseConfig, BaseConfig } from '@hp-intelligence/core';

const serviceEnvSchema = z.object({
  SERVICE_NAME: z.string().default('${service_slug}'),
  ${port_env_key}: z.preprocess((value: unknown) => Number(value), z.number()).default(${port}),
});

export type ServiceConfig = BaseConfig & z.infer<typeof serviceEnvSchema>;

export const config: ServiceConfig = {
  ...validateBaseConfig(),
  ...serviceEnvSchema.parse(process.env),
};
EOF

  cat > "$service_dir/src/prompts/system.v1.ts" <<EOF
export const systemPrompt = [
  'You are the ${name} bot for HP-Intelligence.',
  'Replace this placeholder prompt with production instructions.',
].join('\\n');
EOF

  cat > "$service_dir/src/controllers/invoke.controller.ts" <<EOF
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, logger } from '@hp-intelligence/core';

const controllerLogger = logger.child({ ns: '${name}:controller' });

export const botInvokeController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.body) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Request body is missing');
  }

  controllerLogger.info({
    msg: 'Bot invocation started',
    requestId: request.id,
    authMode: request.authMode,
    tenantId: request.tenantId,
    customerId: request.customerId,
  });

  return reply.send({
    success: true,
    data: {
      bot: '${name}',
      received: request.body,
      timestamp: new Date().toISOString(),
    },
  });
};
EOF

  cat > "$service_dir/src/routes/v1/invoke.ts" <<EOF
import { FastifyPluginAsync } from 'fastify';
import { botInvokeController } from '@/controllers/invoke.controller.js';

const invokeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/invoke', botInvokeController);
};

export default invokeRoutes;
EOF

  cat > "$service_dir/src/routes/v1/index.ts" <<EOF
import { FastifyInstance } from 'fastify';
import invokeRoutes from '@/routes/v1/invoke.js';

export default async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(invokeRoutes);
}
EOF

  cat > "$service_dir/src/server.ts" <<EOF
import Fastify from 'fastify';
import {
  contentGuardPlugin,
  errorHandlerPlugin,
  healthPlugin,
  logger,
  metricsPlugin,
  multiModeAuthPlugin,
  rateLimiterPlugin,
  redis,
  requestContextPlugin
} from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import v1Routes from '@/routes/v1/index.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1024 * 100,
});

const appLogger = logger.child({ ns: '${name}:server' });

fastify.decorate('redis', redis);
fastify.register(requestContextPlugin);
fastify.register(errorHandlerPlugin);
fastify.register(rateLimiterPlugin);

fastify.register(healthPlugin);
fastify.register(metricsPlugin);

fastify.register(async (protectedScope) => {
  protectedScope.register(contentGuardPlugin);
  protectedScope.register(multiModeAuthPlugin);
  protectedScope.register(v1Routes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = config.${port_env_key};

    await fastify.listen({ port, host });
    appLogger.info({ port, host, msg: '${service_slug} started' });
  } catch (err: any) {
    appLogger.error({
      msg: '${service_slug} startup failed',
      error: err.message,
    });
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    appLogger.info({ signal }, 'Closing server gracefully...');

    try {
      await fastify.close();
      appLogger.info('Server closed');
      process.exit(0);
    } catch (err: any) {
      appLogger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
});

start();
EOF
}

write_rag_scaffold() {
  mkdir -p "$service_dir/src/db/migrations"
  mkdir -p "$service_dir/src/lib"
  mkdir -p "$service_dir/src/types"

  cat > "$service_dir/package.json" <<EOF
{
  "name": "${package_name}",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "tsx --env-file=../../.env src/server.ts",
    "build": "tsc && tsc-alias",
    "migrate": "knex migrate:latest --knexfile knexfile.ts",
    "knex": "knex"
  },
  "dependencies": {
    "@hp-intelligence/core": "workspace:*",
    "drizzle-orm": "^0.45.1",
    "fastify": "^5.8.2",
    "knex": "^3.1.0",
    "openai": "^4.104.0",
    "pg": "^8.20.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/pg": "^8.11.11",
    "tsc-alias": "^1.8.16",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
EOF

  cat > "$service_dir/knexfile.ts" <<EOF
import type { Knex } from 'knex';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'hp_intelligence'
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
      tableName: '${migration_table}'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './dist/db/migrations',
      extension: 'js',
      tableName: '${migration_table}'
    },
    pool: { min: 2, max: 10 }
  }
};

export default config;
EOF

  cat > "$service_dir/src/config/index.ts" <<EOF
import { z } from 'zod';
import { validateBaseConfig, BaseConfig } from '@hp-intelligence/core';

const serviceEnvSchema = z.object({
  SERVICE_NAME: z.string().default('${service_slug}'),
  ${port_env_key}: z.preprocess((value: unknown) => Number(value), z.number()).default(${port}),
  DB_MAX_CONNECTIONS: z.preprocess((value: unknown) => Number(value), z.number()).default(20),
  RAG_TOP_K: z.preprocess((value: unknown) => Number(value), z.number()).default(5),
  RAG_MIN_SCORE: z.preprocess((value: unknown) => Number(value), z.number()).default(0.35),
  RAG_CHUNK_SIZE: z.preprocess((value: unknown) => Number(value), z.number()).default(1200),
  RAG_CHUNK_OVERLAP: z.preprocess((value: unknown) => Number(value), z.number()).default(150),
  RAG_MAX_CONTEXT_CHUNKS: z.preprocess((value: unknown) => Number(value), z.number()).default(6),
  RAG_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  RAG_CHAT_MODEL: z.string().default(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
  VECTOR_DIMENSIONS: z.preprocess((value: unknown) => Number(value), z.number()).default(1536),
});

export type ServiceConfig = BaseConfig & z.infer<typeof serviceEnvSchema>;

export const config: ServiceConfig = {
  ...validateBaseConfig(),
  ...serviceEnvSchema.parse(process.env),
};
EOF

  cat > "$service_dir/src/prompts/system.v1.ts" <<EOF
export const systemPrompt = [
  'You are the ${name} policy assistant for HP-Intelligence.',
  'Answer only from the retrieved policy context provided to you.',
  'If the policy context is missing or insufficient, say that clearly instead of guessing.',
  'Keep answers concise and cite the supporting policy title for each material claim.',
].join('\\n');
EOF

  cat > "$service_dir/src/db/connection.ts" <<EOF
import { drizzle } from 'drizzle-orm/node-postgres';
import { createBasePool, testBaseConnection } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import * as schema from '@/db/schema.js';

export const pool = createBasePool({
  connectionString: config.DATABASE_URL || '',
  max: config.DB_MAX_CONNECTIONS,
});

export const db = drizzle(pool, { schema }) as any;

export const testConnection = () => testBaseConnection({
  execute: (statement: string) => db.execute(statement)
});
EOF

  cat > "$service_dir/src/db/schema.ts" <<EOF
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '@hp-intelligence/core';

export const policyDocuments = pgTable('policy_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  sourceKey: text('source_key').notNull(),
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  status: text('status').notNull().default('ready'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('policy_documents_tenant_source_idx').on(table.tenantId, table.sourceKey),
  index('policy_documents_tenant_idx').on(table.tenantId),
  index('policy_documents_status_idx').on(table.status),
]);

// The pgvector embedding column is managed through the raw SQL migration for now.
export const policyChunks = pgTable('policy_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => policyDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  embeddingModel: text('embedding_model').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('policy_chunks_document_chunk_idx').on(table.documentId, table.chunkIndex),
  index('policy_chunks_document_idx').on(table.documentId),
]);

export const retrievalLogs = pgTable('retrieval_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => (tenants as any).id),
  query: text('query').notNull(),
  topK: integer('top_k').notNull(),
  matches: jsonb('matches').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('retrieval_logs_tenant_idx').on(table.tenantId),
]);
EOF

  cat > "$service_dir/src/db/migrations/20260402120000_create_policy_rag_tables.ts" <<EOF
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
EOF

  cat > "$service_dir/src/lib/pgvector.ts" <<EOF
import { ApiError } from '@hp-intelligence/core';

export const formatVector = (values: number[]): string => {
  if (!values.length) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Embedding cannot be empty');
  }

  return '[' + values
    .map((value) => (Number.isFinite(value) ? value.toFixed(8) : '0'))
    .join(',') + ']';
};

export const assertVectorDimensions = (values: number[], expected: number): number[] => {
  if (values.length !== expected) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Embedding dimensions do not match VECTOR_DIMENSIONS');
  }

  return values;
};
EOF

  cat > "$service_dir/src/types/rag.ts" <<EOF
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  sourceUrl: string | null;
  chunkIndex: number;
}

export interface PolicyCitation {
  chunkId: string;
  documentId: string;
  title: string;
  sourceUrl: string | null;
  score: number;
}

export interface PolicyAnswer {
  answer: string;
  citations: PolicyCitation[];
  matches: RetrievedChunk[];
}

export interface PolicyDocumentInput {
  sourceKey: string;
  title: string;
  content: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}
EOF

  cat > "$service_dir/src/services/embedding.service.ts" <<EOF
import OpenAI from 'openai';
import { ApiError, logger } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { assertVectorDimensions } from '@/lib/pgvector.js';

const embeddingLogger = logger.child({ ns: '${name}:embeddings' });

let client: OpenAI | null = null;

const getClient = () => {
  if (!config.OPENAI_API_KEY) {
    throw new ApiError('LLM_EMPTY_RESPONSE', 'OPENAI_API_KEY is required for policy embeddings');
  }

  if (!client) {
    client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60 * 1000,
    });
  }

  return client;
};

export const embedText = async (input: string): Promise<number[]> => {
  const text = input.trim();

  if (!text) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Input text is required for embeddings');
  }

  const response = await getClient().embeddings.create({
    model: config.RAG_EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0]?.embedding ?? [];

  if (!embedding.length) {
    throw new ApiError('LLM_EMPTY_RESPONSE', 'Embedding provider returned an empty vector');
  }

  embeddingLogger.debug({
    msg: 'Embedding generated',
    model: config.RAG_EMBEDDING_MODEL,
    dimensions: embedding.length,
  });

  return assertVectorDimensions(embedding, config.VECTOR_DIMENSIONS);
};
EOF

  cat > "$service_dir/src/services/retrieval.service.ts" <<EOF
import { logger } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { pool } from '@/db/connection.js';
import { formatVector } from '@/lib/pgvector.js';
import { embedText } from '@/services/embedding.service.js';
import { RetrievedChunk } from '@/types/rag.js';

const retrievalLogger = logger.child({ ns: '${name}:retrieval' });

interface RetrievedChunkRow {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: string | number;
  sourceUrl: string | null;
  chunkIndex: number;
}

export const retrievePolicyContext = async (
  tenantId: string,
  query: string,
  limit = config.RAG_TOP_K,
): Promise<RetrievedChunk[]> => {
  const embedding = await embedText(query);
  const vectorLiteral = formatVector(embedding);

  const similarityQuery = [
    'SELECT',
    'pc.id AS "chunkId",',
    'pc.document_id AS "documentId",',
    'pd.title AS "title",',
    'pc.content AS "content",',
    '1 - (pc.embedding <=> \$2::vector) AS "score",',
    'pd.source_url AS "sourceUrl",',
    'pc.chunk_index AS "chunkIndex"',
    'FROM policy_chunks pc',
    'INNER JOIN policy_documents pd ON pd.id = pc.document_id',
    'WHERE pd.tenant_id = \$1::uuid',
    "AND pd.status = 'ready'",
    'ORDER BY pc.embedding <=> \$2::vector',
    'LIMIT \$3',
  ].join(' ');

  const result = await pool.query<RetrievedChunkRow>(similarityQuery, [tenantId, vectorLiteral, limit]);

  const matches = result.rows
    .map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      title: row.title,
      content: row.content,
      score: Number(row.score),
      sourceUrl: row.sourceUrl,
      chunkIndex: Number(row.chunkIndex),
    }))
    .filter((row) => row.score >= config.RAG_MIN_SCORE)
    .slice(0, config.RAG_MAX_CONTEXT_CHUNKS);

  retrievalLogger.info({
    msg: 'Policy retrieval completed',
    tenantId,
    requestedTopK: limit,
    matchedChunks: matches.length,
  });

  await pool.query(
    'INSERT INTO retrieval_logs (tenant_id, query, top_k, matches) VALUES (\$1::uuid, \$2, \$3, \$4::jsonb)',
    [
      tenantId,
      query,
      limit,
      JSON.stringify(matches.map((match) => ({
        chunkId: match.chunkId,
        documentId: match.documentId,
        title: match.title,
        score: match.score,
      }))),
    ],
  ).catch((error) => {
    retrievalLogger.warn({
      msg: 'Failed to persist retrieval log',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return matches;
};
EOF

  cat > "$service_dir/src/services/document-ingestion.service.ts" <<EOF
import { ApiError, logger } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { pool } from '@/db/connection.js';
import { formatVector } from '@/lib/pgvector.js';
import { embedText } from '@/services/embedding.service.js';
import { PolicyDocumentInput } from '@/types/rag.js';

const ingestionLogger = logger.child({ ns: '${name}:ingestion' });

interface IngestPolicyDocumentInput extends PolicyDocumentInput {
  tenantId: string;
}

interface DocumentRow {
  id: string;
}

export const ingestPolicyDocument = async (input: IngestPolicyDocumentInput) => {
  const title = input.title.trim();
  const content = input.content.trim();
  const sourceKey = input.sourceKey.trim();

  if (!title || !content || !sourceKey) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'title, content, and sourceKey are required');
  }

  const chunks = splitIntoChunks(content, config.RAG_CHUNK_SIZE, config.RAG_CHUNK_OVERLAP);

  if (!chunks.length) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'No policy chunks were generated from the provided content');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const documentUpsertQuery = [
      'INSERT INTO policy_documents (tenant_id, source_key, title, source_url, status, metadata, updated_at)',
      'VALUES (\$1::uuid, \$2, \$3, \$4, \$5, \$6::jsonb, NOW())',
      'ON CONFLICT (tenant_id, source_key)',
      'DO UPDATE SET',
      'title = EXCLUDED.title,',
      'source_url = EXCLUDED.source_url,',
      'status = EXCLUDED.status,',
      'metadata = EXCLUDED.metadata,',
      'updated_at = NOW()',
      'RETURNING id',
    ].join(' ');

    const documentResult = await client.query<DocumentRow>(documentUpsertQuery, [
      input.tenantId,
      sourceKey,
      title,
      input.sourceUrl ?? null,
      'ready',
      JSON.stringify(input.metadata ?? {}),
    ]);

    const documentId = documentResult.rows[0]?.id;

    if (!documentId) {
      throw new ApiError('DB_QUERY_FAILED', 'Document ingestion failed to create or update the policy record');
    }

    await client.query('DELETE FROM policy_chunks WHERE document_id = \$1::uuid', [documentId]);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = await embedText(chunk);

      await client.query(
        [
          'INSERT INTO policy_chunks (document_id, chunk_index, content, token_count, embedding_model, embedding)',
          'VALUES (\$1::uuid, \$2, \$3, \$4, \$5, \$6::vector)',
        ].join(' '),
        [
          documentId,
          index,
          chunk,
          estimateTokenCount(chunk),
          config.RAG_EMBEDDING_MODEL,
          formatVector(embedding),
        ],
      );
    }

    await client.query('COMMIT');

    ingestionLogger.info({
      msg: 'Policy document ingested',
      tenantId: input.tenantId,
      sourceKey,
      documentId,
      chunks: chunks.length,
    });

    return {
      documentId,
      chunksIngested: chunks.length,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const splitIntoChunks = (content: string, chunkSize: number, overlap: number): string[] => {
  const normalized = content.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + chunkSize, normalized.length);
    const slice = normalized.slice(cursor, end).trim();

    if (slice) {
      chunks.push(slice);
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
};

const estimateTokenCount = (content: string): number => Math.ceil(content.length / 4);
EOF

  cat > "$service_dir/src/services/policy-chat.service.ts" <<EOF
import { openaiClient } from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { systemPrompt } from '@/prompts/system.v1.js';
import { retrievePolicyContext } from '@/services/retrieval.service.js';
import { PolicyAnswer } from '@/types/rag.js';

interface PolicyQuestionInput {
  tenantId: string;
  message: string;
  signal?: AbortSignal;
}

export const answerPolicyQuestion = async (input: PolicyQuestionInput): Promise<PolicyAnswer> => {
  const matches = await retrievePolicyContext(input.tenantId, input.message);

  if (!matches.length) {
    return {
      answer: 'I could not find matching policy context yet. Ingest policy documents for this tenant before asking questions.',
      citations: [],
      matches: [],
    };
  }

  const contextBlock = matches
    .map((match, index) => [
      'Source ' + String(index + 1) + ': ' + match.title,
      'Score: ' + match.score.toFixed(4),
      match.sourceUrl ? 'URL: ' + match.sourceUrl : 'URL: not provided',
      'Excerpt:',
      match.content,
    ].join('\n'))
    .join('\n\n');

  const completion = await openaiClient.complete({
    model: config.RAG_CHAT_MODEL || config.OPENAI_MODEL,
    systemPrompt,
    userMessage: [
      'Use only the retrieved policy context below to answer the question.',
      'If the context is insufficient, say so clearly and do not invent policy.',
      '',
      'Question:',
      input.message,
      '',
      'Retrieved policy context:',
      contextBlock,
      '',
      'Respond with a concise answer and cite the supporting policy title inline.',
    ].join('\n'),
    maxTokens: config.MAX_MESSAGE_TOKENS,
    temperature: 0.1,
    signal: input.signal,
  });

  return {
    answer: completion.content || 'I could not generate an answer from the retrieved policy context.',
    citations: matches.map((match) => ({
      chunkId: match.chunkId,
      documentId: match.documentId,
      title: match.title,
      sourceUrl: match.sourceUrl,
      score: match.score,
    })),
    matches,
  };
};
EOF

  cat > "$service_dir/src/controllers/invoke.controller.ts" <<EOF
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, ApiResponse, HttpStatusCode, logger } from '@hp-intelligence/core';
import { answerPolicyQuestion } from '@/services/policy-chat.service.js';

const controllerLogger = logger.child({ ns: '${name}:invoke' });

export const botInvokeController = async (request: FastifyRequest, reply: FastifyReply) => {
  const payload = (request.body as { message?: string } | undefined) ?? {};
  const message = payload.message?.trim();

  if (!message) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Message is required');
  }

  if (!request.tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Tenant context is required');
  }

  const abortController = new AbortController();
  request.raw.on('close', () => abortController.abort());

  controllerLogger.info({
    msg: 'Policy question received',
    requestId: request.id,
    tenantId: request.tenantId,
  });

  const result = await answerPolicyQuestion({
    tenantId: request.tenantId,
    message,
    signal: abortController.signal,
  });

  return reply.status(HttpStatusCode.OK).send(
    new ApiResponse(HttpStatusCode.OK, {
      bot: '${name}',
      message,
      answer: result.answer,
      citations: result.citations,
      retrievedChunks: result.matches,
    }, 'Policy response generated')
  );
};
EOF

  cat > "$service_dir/src/controllers/documents.controller.ts" <<EOF
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, ApiResponse, HttpStatusCode } from '@hp-intelligence/core';
import { ingestPolicyDocument } from '@/services/document-ingestion.service.js';
import { PolicyDocumentInput } from '@/types/rag.js';

export const ingestDocumentController = async (request: FastifyRequest, reply: FastifyReply) => {
  const body: Partial<PolicyDocumentInput> = (request.body as PolicyDocumentInput | undefined) ?? {};

  if (!request.tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Tenant context is required');
  }

  const title = body.title?.trim();
  const content = body.content?.trim();
  const sourceKey = body.sourceKey?.trim();

  if (!title || !content || !sourceKey) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'title, content, and sourceKey are required');
  }

  const result = await ingestPolicyDocument({
    tenantId: request.tenantId,
    title,
    content,
    sourceKey,
    sourceUrl: body.sourceUrl,
    metadata: body.metadata,
  });

  return reply.status(HttpStatusCode.OK).send(
    new ApiResponse(HttpStatusCode.OK, {
      bot: '${name}',
      ...result,
    }, 'Policy document ingested')
  );
};
EOF

  cat > "$service_dir/src/routes/v1/invoke.ts" <<EOF
import { FastifyPluginAsync } from 'fastify';
import { botInvokeController } from '@/controllers/invoke.controller.js';

const invokeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/invoke', {
    schema: {
      description: 'Answer policy questions using RAG and vector search',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
        }
      }
    }
  }, botInvokeController);
};

export default invokeRoutes;
EOF

  cat > "$service_dir/src/routes/v1/documents.ts" <<EOF
import { FastifyPluginAsync } from 'fastify';
import { ingestDocumentController } from '@/controllers/documents.controller.js';

const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/documents/ingest', {
    schema: {
      description: 'Ingest a policy document and generate vector embeddings for retrieval',
      body: {
        type: 'object',
        required: ['sourceKey', 'title', 'content'],
        properties: {
          sourceKey: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          sourceUrl: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        }
      }
    }
  }, ingestDocumentController);
};

export default documentRoutes;
EOF

  cat > "$service_dir/src/routes/v1/index.ts" <<EOF
import { FastifyInstance } from 'fastify';
import documentRoutes from '@/routes/v1/documents.js';
import invokeRoutes from '@/routes/v1/invoke.js';

export default async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(invokeRoutes);
  await fastify.register(documentRoutes);
}
EOF

  cat > "$service_dir/src/server.ts" <<EOF
import Fastify from 'fastify';
import {
  contentGuardPlugin,
  errorHandlerPlugin,
  healthPlugin,
  logger,
  metricsPlugin,
  multiModeAuthPlugin,
  rateLimiterPlugin,
  redis,
  requestContextPlugin
} from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { pool } from '@/db/connection.js';
import v1Routes from '@/routes/v1/index.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1024 * 1024 * 2,
});

const appLogger = logger.child({ ns: '${name}:server' });

fastify.decorate('redis', redis);
fastify.register(errorHandlerPlugin);
fastify.register(requestContextPlugin);
fastify.register(rateLimiterPlugin);

fastify.register(healthPlugin);
fastify.register(metricsPlugin);

fastify.register(async (protectedScope) => {
  protectedScope.register(contentGuardPlugin);
  protectedScope.register(multiModeAuthPlugin);
  protectedScope.register(v1Routes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = config.${port_env_key};

    await fastify.listen({ port, host });
    appLogger.info({ port, host, msg: '${service_slug} started' });
  } catch (err: any) {
    appLogger.error({
      msg: '${service_slug} startup failed',
      error: err.message,
    });
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    appLogger.info({ signal }, 'Closing server gracefully...');

    try {
      await fastify.close();
      await pool.end();
      appLogger.info('Server closed');
      process.exit(0);
    } catch (err: any) {
      appLogger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
});

start();
EOF
}

echo "Scaffolding ${service_slug} on port ${port} (${scaffold_mode} template)"

write_base_scaffold

if [[ "$scaffold_mode" == "rag" ]]; then
  write_rag_scaffold
fi

echo "Scaffold created at ${service_rel_dir}"
echo "Next steps:"

if [[ "$scaffold_mode" == "rag" ]]; then
  echo "  1. Run pnpm install"
  echo "  2. Run pnpm --filter ${package_name} migrate"
  echo "  3. Ingest tenant policy documents via POST /api/v1/documents/ingest"
  echo "  4. Register the bot in services/hp-intelligence-gateway/src/config/bots.json when you are ready"
  echo "  5. Start it with pnpm --filter ${package_name} dev"
else
  echo "  1. Run pnpm install"
  echo "  2. Implement AI logic in ${service_rel_dir}/src/controllers/invoke.controller.ts"
  echo "  3. Optionally register the bot in services/hp-intelligence-gateway/src/config/bots.json"
  echo "  4. Optionally wire it into widget routing and docker-compose"
  echo "  5. Start it with pnpm --filter ${package_name} dev"
fi
