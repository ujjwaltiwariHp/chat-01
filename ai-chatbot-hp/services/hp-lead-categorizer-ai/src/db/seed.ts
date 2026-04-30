import { db } from './connection.js';
import { icpProfiles, leads } from './schema.js';
import { tenants } from '@hp-intelligence/core';
import { eq } from 'drizzle-orm';
import { createLeadLogger } from '@/logging/logger.js';

const seedLogger = createLeadLogger('db:seed');

export const seed = async () => {
  seedLogger.info('Starting database seed');

  // 1. Get/Create Default Tenant
  let [tenant] = await db.select().from(tenants as any).limit(1);
  if (!tenant) {
    [tenant] = await db.insert(tenants as any).values({
      name: 'HangingPanda Test Tenant',
      slug: 'hp-test',
      status: 'active',
      apiKey: 'hp_test_api_key_123',
    }).returning();
  }

  // 2. Create ICP Profile
  const existingIcp = await db.select().from(icpProfiles).where(eq(icpProfiles.tenantId, tenant.id));
  if (existingIcp.length === 0) {
    await db.insert(icpProfiles).values({
      tenantId: tenant.id,
      targetIndustries: ['Technology', 'E-commerce', 'SaaS', 'Digital Health'],
      companySizeRange: '10-500',
      budgetRangeMin: 5000,
      budgetRangeMax: 100000,
      dealBreakerSignals: ['Under 5 employees', 'No budget mentioned', 'Cryptocurrency focus'],
      strongFitSignals: ['Active marketing spend', 'Series A+ funding', 'Remote-first team'],
      servicesOffered: ['AI Automation', 'Cloud Ingestion', 'Sales Intelligence'],
      additionalContext: 'Primary focus on high-growth startups in North America and EMEA.',
    });
    seedLogger.info({ tenantId: tenant.id }, 'Created ICP profile');
  }

  // 3. Create Sample Leads
  const samples = [
    {
      name: 'John Doe',
      email: 'john@example.com',
      companyName: 'TechFast Inc',
      source: 'form',
      status: 'new',
      rawData: { message: 'Looking for AI automation for our lead pipeline. Budget around $10k/mo.' },
    },
    {
      name: 'Sarah Smith',
      email: 'sarah@healthdigital.io',
      companyName: 'HealthDigital',
      source: 'chatbot',
      status: 'normalizing',
      rawData: { transcript: [{ role: 'user', content: 'Do you offer cloud ingestion services?' }] },
    },
  ];

  for (const sample of samples) {
    const existing = await db.select().from(leads).where(eq(leads.email, sample.email as string));
    if (existing.length === 0) {
      await db.insert(leads).values({
        tenantId: tenant.id,
        ...sample,
      } as any);
    }
  }

  seedLogger.info({ tenantId: tenant.id }, 'Seeded sample leads');
  seedLogger.info('Database seed completed');
};

seed().then(() => {
  process.exit(0);
}).catch((err) => {
  seedLogger.error({ err }, 'Database seed failed');
  process.exit(1);
});
