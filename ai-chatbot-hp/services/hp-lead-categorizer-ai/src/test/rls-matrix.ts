import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import { tenants, users } from '@hp-intelligence/core';
import {
  leads,
  icpProfiles,
  leadAnalyses,
  leadEmailDrafts,
  leadActivities,
  routingRules,
  webhookConfigs,
  leadServiceSettings,
  leadIntelligenceUsageEvents,
  categorizationLogs,
} from '../db/schema.js';

async function runRlsTests() {
  console.log('🧪 Starting RLS Matrix Tests');

  // 1. Create two tenants for the test
  console.log('Inserting tenants...');
  const [t1, t2] = await db.insert(tenants as any).values([
    { name: `RLS Tenant 1 ${Date.now()}`, slug: `rls-1-${Date.now()}`, apiKey: `rls_key_1_${Date.now()}`, status: 'active' },
    { name: `RLS Tenant 2 ${Date.now()}`, slug: `rls-2-${Date.now()}`, apiKey: `rls_key_2_${Date.now()}`, status: 'active' },
  ]).returning();
  console.log('Tenants inserted');

  const id1 = t1.id;
  const id2 = t2.id;

  // Create Users
  console.log('Inserting users...');
  const [u1, u2] = await db.insert(users as any).values([
    { tenantId: id1, name: 'User 1', email: `u1-${Date.now()}@test.com`, role: 'admin' },
    { tenantId: id2, name: 'User 2', email: `u2-${Date.now()}@test.com`, role: 'admin' },
  ]).returning();
  console.log('Users inserted');

  // Leads
  console.log('Inserting leads...');
  const [l1] = await db.insert(leads).values({ tenantId: id1, source: 'test', rawData: {}, status: 'new' }).returning();
  const [l2] = await db.insert(leads).values({ tenantId: id2, source: 'test', rawData: {}, status: 'new' }).returning();
  console.log('Leads inserted');

  // Analyses
  console.log('Inserting analyses...');
  await db.insert(leadAnalyses).values([
    { 
      tenantId: id1, leadId: l1.id, modelUsed: 'test', analysisTier: 'basic', analysisDepth: 'shallow', 
      summary: 'test', classification: 'HOT', intent: 'UNKNOWN', classificationReasoning: 'test', 
      scoringFactors: [], extractedAttributes: {}, riskFlags: [], suggestedAction: 'test' 
    },
    { 
      tenantId: id2, leadId: l2.id, modelUsed: 'test', analysisTier: 'basic', analysisDepth: 'shallow', 
      summary: 'test', classification: 'HOT', intent: 'UNKNOWN', classificationReasoning: 'test', 
      scoringFactors: [], extractedAttributes: {}, riskFlags: [], suggestedAction: 'test' 
    },
  ]);
  console.log('Analyses inserted');

  // ICP
  console.log('Inserting ICP...');
  await db.insert(icpProfiles).values([
    { tenantId: id1, targetIndustries: [], companySizeRange: '', budgetRangeMin: 0, budgetRangeMax: 0, dealBreakerSignals: [], strongFitSignals: [], servicesOffered: [] },
    { tenantId: id2, targetIndustries: [], companySizeRange: '', budgetRangeMin: 0, budgetRangeMax: 0, dealBreakerSignals: [], strongFitSignals: [], servicesOffered: [] }
  ]);
  console.log('ICP inserted');

  // Routing Rules
  console.log('Inserting routing rules...');
  await db.insert(routingRules).values([
    { tenantId: id1, priority: 1, conditionField: 'a', conditionOperator: 'b', conditionValue: 'c', actionAssignTo: u1.id },
    { tenantId: id2, priority: 1, conditionField: 'a', conditionOperator: 'b', conditionValue: 'c', actionAssignTo: u2.id }
  ]);
  console.log('Routing rules inserted');

  // 3. RLS Test Runner
  const tableNames = [
    'lead_intelligence_leads',
    'lead_intelligence_analyses',
    'lead_intelligence_icp_profiles',
    'lead_intelligence_routing_rules',
  ];

  let passed = 0;
  let failed = 0;

  await db.execute(sql`DROP ROLE IF EXISTS rls_tester;`);
  await db.execute(sql`CREATE ROLE rls_tester NOLOGIN NOINHERIT;`);
  await db.execute(sql`GRANT USAGE ON SCHEMA public TO rls_tester;`);
  await db.execute(sql`GRANT SELECT ON ALL TABLES IN SCHEMA public TO rls_tester;`);

  for (const tName of tableNames) {
    for (const tenantId of [id1, id2]) {
      const otherTenantId = tenantId === id1 ? id2 : id1;
      try {
        await db.transaction(async (tx: any) => {
          await tx.execute(sql`SET LOCAL ROLE rls_tester;`);
          await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true);`);
          const res = await tx.execute(sql.raw(`SELECT tenant_id FROM ${tName}`)) as any;
          const rows = res.rows || res;
          
          let hasOther = false;
          for (const row of rows) {
            if (row.tenant_id === otherTenantId) hasOther = true;
          }

          if (hasOther) {
            console.error(`❌ FAILED: ${tName} for tenant ${tenantId} leaked data`);
            failed++;
          } else {
            console.log(`✅ PASSED: ${tName} for tenant ${tenantId}`);
            passed++;
          }
        });
      } catch (e: any) {
         console.error(`❌ FAILED: ${tName} error: ${e.message}`);
         failed++;
      }
    }
  }

  // Cleanup
  await db.execute(sql`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rls_tester;`).catch(() => {});
  await db.execute(sql`DROP ROLE IF EXISTS rls_tester;`).catch(() => {});

  console.log(`\n📊 Results: ✅ ${passed} Passed, ❌ ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runRlsTests().catch(console.error);
