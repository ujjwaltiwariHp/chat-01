import { db } from '@/db/connection.js';
import { sql } from 'drizzle-orm';
import { leadAnalyses, leads, leadIntelligenceUsageEvents } from '@/db/schema.js';
import { createLeadLogger } from '@/logging/logger.js';

const log = createLeadLogger('audit:performance');

/**
 * Post-launch EXPLAIN ANALYZE
 * Conducts performance profiling on the top 5 most critical queries.
 * Ensures the system remains performant as datasets grow to 100K+ rows.
 */
async function runPerformanceAudit() {
  log.info('Starting Post-launch Database Performance Audit');

  const criticalQueries = [
    {
      name: 'Lead List with Analysis (Primary Dashboard)',
      query: sql`EXPLAIN ANALYZE SELECT * FROM ${leads} l LEFT JOIN ${leadAnalyses} a ON l.id = a.lead_id WHERE l.tenant_id = '00000000-0000-0000-0000-000000000000' ORDER BY l.created_at DESC LIMIT 50`
    },
    {
      name: 'Daily Quota Calculation (Billing Middleware)',
      query: sql`EXPLAIN ANALYZE SELECT sum(cost_usd_cents) FROM ${leadIntelligenceUsageEvents} WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND event_type = 'analysis_completed' AND created_at > NOW() - INTERVAL '24 hours'`
    },
    {
      name: 'Duplicate Lead Detection (ICP Protection)',
      query: sql`EXPLAIN ANALYZE SELECT id FROM ${leads} WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND email = 'test@example.com' AND created_at > NOW() - INTERVAL '30 days'`
    },
    {
      name: 'Lead Decay Sweep (Maintenance Worker)',
      query: sql`EXPLAIN ANALYZE SELECT id FROM ${leads} WHERE deleted_at IS NULL AND stale_at < NOW() AND status = 'analyzed' LIMIT 500`
    },
    {
      name: 'Semantic Cache Lookup (G68)',
      query: sql`EXPLAIN ANALYZE SELECT lead_id FROM lead_intelligence_embeddings WHERE embedding <=> '[0.1, 0.2, ...]'::vector < 0.05 LIMIT 1`
    }
  ];

  for (const item of criticalQueries) {
    log.info(`Auditing Query: ${item.name}`);
    try {
      const result = await db.execute(item.query);
      console.log(`\n--- PLAN FOR: ${item.name} ---\n`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
      log.error({ err: err.message }, `Failed to audit: ${item.name}`);
    }
  }

  log.info('G64: Performance Audit Complete');
  process.exit(0);
}

runPerformanceAudit();
