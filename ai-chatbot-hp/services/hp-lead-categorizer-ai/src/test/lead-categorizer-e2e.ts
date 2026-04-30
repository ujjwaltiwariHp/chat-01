import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(import.meta.dirname, '../../../../.env') });

const GATEWAY_URL = `http://localhost:${process.env.GATEWAY_PORT || 4000}/api/v1/bots/lead-categorizer/invoke`;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN!;
const TEST_TENANT = process.env.TEST_TENANT_ID!;
const TEST_USER = process.env.TEST_USER_ID!;

async function testLeadCategorizationE2E() {
  console.log('--- 🚀 STARTING GATEWAY E2E TEST: LEAD CATEGORIZER ---');

  const payload = {
    meta: {
      source: 'e2e-suite',
      type: 'form',
      priority: 'high'
    },
    payload: {
      company: 'Stealth Startup',
      message: 'Need a prototype of a real-time AI trading bot in 2 weeks. We have seed funding and need high technical excellence. Can HP deliver?',
    },
    options: {
      language: 'en'
    }
  };

  try {
    console.log(`📡 Sending request to Gateway: ${GATEWAY_URL}`);
    
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': INTERNAL_TOKEN,
        'X-Tenant-ID': TEST_TENANT,
        'X-Customer-ID': TEST_USER
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error('❌ Gateway returned error:', response.status, data);
      return;
    }

    console.log('✅ Gateway Response Received (200 OK)');
    console.log('--- Categorization result ---');
    console.log('Summary:', data.data.summary);
    console.log('Category:', data.data.category);
    console.log('Urgency:', data.data.urgency);
    console.log('Timeline:', data.data.timeline);
    console.log('Next Steps:', data.data.nextSteps.join(' -> '));
    console.log('Reasoning:', data.data.internal_reasoning);
    console.log('-----------------------------\n');
    
    if (data.data.internal_reasoning && data.data.category) {
       console.log('🌟 E2E TEST PASSED: Full Intelligence Loop Verified through Gateway.');
    }

  } catch (err: any) {
    console.error('❌ E2E Connection Failed:', err.message);
    console.log('💡 TIP: Ensure Docker containers are running and port 4000 is open.');
  }
}

testLeadCategorizationE2E();
