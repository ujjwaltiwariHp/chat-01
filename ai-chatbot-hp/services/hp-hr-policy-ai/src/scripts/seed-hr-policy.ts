import { logger, redis, UUID_REGEX } from '@hp-intelligence/core';
import { HR_POLICY_DOCUMENTS } from '@/data/hr-policy.documents.js';
import { pool } from '@/db/connection.js';
import { ingestPolicyDocument } from '@/services/document-ingestion.service.js';

const seedLogger = logger.child({ ns: 'hr-policy:seed' });

const resolveTenantId = (): string => {
  const args = process.argv.slice(2);
  const inlineArg = args.find((arg) => arg.startsWith('--tenant-id='));
  const inlineValue = inlineArg?.split('=')[1]?.trim();

  if (inlineValue) {
    if (!UUID_REGEX.test(inlineValue)) {
      throw new Error(`Invalid tenant ID format: ${inlineValue}`);
    }
    return inlineValue;
  }

  const tenantFlagIndex = args.findIndex((arg) => arg === '--tenant-id');
  const tenantId = tenantFlagIndex >= 0 ? args[tenantFlagIndex + 1]?.trim() : undefined;

  if (!tenantId) {
    throw new Error('Missing required --tenant-id argument. Example: pnpm --filter @hp-intelligence/hr-policy-ai seed:hr-policy -- --tenant-id <tenant-uuid>');
  }

  if (!UUID_REGEX.test(tenantId)) {
    throw new Error(`Invalid tenant ID format: ${tenantId}`);
  }

  return tenantId;
};

const tenantId = resolveTenantId();

const run = async () => {
  seedLogger.info({
    msg: 'Starting HR policy seed',
    tenantId,
    documents: HR_POLICY_DOCUMENTS.length,
  });

  try {
    for (const document of HR_POLICY_DOCUMENTS) {
      const result = await ingestPolicyDocument({
        tenantId,
        ...document,
      });

      seedLogger.info({
        msg: 'Seeded HR policy document',
        tenantId,
        sourceKey: document.sourceKey,
        title: document.title,
        chunksIngested: result.chunksIngested,
        documentId: result.documentId,
      });
    }

    seedLogger.info({
      msg: 'HR policy seed completed successfully',
      tenantId,
      documents: HR_POLICY_DOCUMENTS.length,
    });
  } finally {
    redis.disconnect();
    await pool.end();
  }
};

run().catch((error) => {
  seedLogger.error({
    msg: 'HR policy seed failed',
    tenantId,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
