import { db } from '../db/connection.js';
import { icpProfiles, routingRules, leadServiceSettings } from '../db/schema.js';
import { redis } from '@hp-intelligence/core';
import { eq } from 'drizzle-orm';
import { createLeadLogger } from '@/logging/logger.js';

const seedLogger = createLeadLogger('seed');

const tenantId = process.env.TEST_TENANT_ID!;
const userId = process.env.TEST_USER_ID!;

async function seed() {
  seedLogger.info({ tenantId }, 'Starting lead intelligence seed');

  try {
    // 1. Seed ICP Profile
    const [existingIcp] = await db.select().from(icpProfiles).where(eq(icpProfiles.tenantId, tenantId)).limit(1);
    if (!existingIcp) {
      await db.insert(icpProfiles).values({
        tenantId,
        targetIndustries: ['Fintech', 'SaaS', 'Health-tech', 'Real Estate'],
        companySizeRange: '10-500 employees',
        budgetRangeMin: 5000,
        budgetRangeMax: 100000,
        dealBreakerSignals: ['Undergrad student', 'Searching for job', 'Budget < 1000'],
        strong_fit_signals: ['Urgent timeline', 'Venture backed', 'Previous similar project'],
        servicesOffered: ['AI Development', 'Mobile Apps', 'Web Portals', 'ML Models'],
        additionalContext: 'Primary focus on Indian and US markets. Expert-level quality expected.',
      });
      seedLogger.info('Seeded ICP profile');
    }

    // 2. Seed Routing Rules
    const existingRules = await db.select().from(routingRules).where(eq(routingRules.tenantId, tenantId)).limit(1);
    if (existingRules.length === 0) {
      await db.insert(routingRules).values([
        {
          tenantId,
          priority: 1,
          conditionField: 'classification',
          conditionOperator: 'eq',
          conditionValue: 'HOT',
          actionAssignTo: userId,
        },
        {
          tenantId,
          priority: 10,
          conditionField: 'source',
          conditionOperator: 'eq',
          conditionValue: 'chatbot',
          actionAssignTo: userId,
        }
      ]);
      seedLogger.info('Seeded routing rules');
    }

    // 3. Seed Service Settings
    const [existingSettings] = await db.select().from(leadServiceSettings).where(eq(leadServiceSettings.tenantId, tenantId)).limit(1);
    if (!existingSettings) {
      await db.insert(leadServiceSettings).values({
        tenantId,
        slackWebhookUrl: 'https://hooks.slack.com/services/dummy',
      });
      seedLogger.info('Seeded service settings');
    }

    seedLogger.info('Lead intelligence seed completed successfully');
  } catch (error) {
    seedLogger.error({ err: error }, 'Lead intelligence seed failed');
    throw error;
  } finally {
    await redis.disconnect();
  }
}

seed().catch(() => {
  process.exit(1);
});
