import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load env relative to root
dotenv.config({ path: path.join(import.meta.dirname, '../../../../.env') });

const CHATBOT_URL = `http://localhost:${process.env.CHATBOT_PORT || 4001}/api/v1/chat/invoke`;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN!;
const GW_SECRET = process.env.GATEWAY_SERVICE_SECRET!;
const WIDGET_SECRET = process.env.WIDGET_SERVICE_SECRET!;

const TEST_TENANT = process.env.TEST_TENANT_ID!;

async function generateStandaloneJwt(tenantId: string, customerId?: string) {
  return jwt.sign(
    {
      tid: tenantId,
      cid: customerId,
      sub: 'test_user_123',
    },
    INTERNAL_TOKEN,
    { algorithm: 'HS256' }
  );
}

async function testMode(name: string, headers: any, body: any) {
  console.log(`[${name}] Starting test...`);
  try {
    const response = await fetch(CHATBOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${name}] FAILED: HTTP ${response.status} - ${errorText}`);
      return null;
    }

    // Expect SSE stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body in response');

    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    
    // SSE chunks can have multiple lines starting with "data: "
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.replace('data: ', '').trim();
        try {
          const payload = JSON.parse(jsonStr);
          if (payload.data?.type === 'start') {
            const conversationId = payload.data.conversationId;
            console.log(`[${name}] SUCCESS: ConversationID = ${conversationId}`);
            reader.cancel();
            return conversationId;
          }
        } catch (e) {
          // Skip malformed or incomplete JSON lines
          continue;
        }
      }
    }

    console.error(`[${name}] FAILED: Expected start chunk in: ${chunk}`);
    reader.cancel();
    return null;

  } catch (error: any) {
    console.error(`[${name}] ERROR: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  const standaloneJwt = await generateStandaloneJwt(TEST_TENANT, 'standalone_cust');
  const sharedSessionId = 'p6_shared_session_123';
  
  const tests = [
    {
      name: 'GATEWAY_MODE',
      headers: {
        'X-Service-Token': GW_SECRET,
        'X-Tenant-ID': TEST_TENANT,
        'X-Session-ID': sharedSessionId,
        'X-Request-ID': 'gw_test_req_001',
      },
      body: { message: 'hello from gateway' },
    },
    {
      name: 'WIDGET_MODE',
      headers: {
        'X-Service-Token': WIDGET_SECRET,
        'X-Customer-ID': 'widget_cust_123',
        'X-Tenant-ID': TEST_TENANT,
        'X-Session-ID': sharedSessionId,
        'X-Request-ID': 'widget_test_req_001',
      },
      body: { message: 'hello from widget' },
    },
    {
      name: 'STANDALONE_MODE',
      headers: {
        'Authorization': `Bearer ${standaloneJwt}`,
        'X-Tenant-ID': TEST_TENANT,
        'X-Session-ID': sharedSessionId,
        'X-Request-ID': 'standalone_test_req_001',
      },
      body: { message: 'hello from standalone' },
    },
  ];

  console.log('--- Parallel Multi-Mode Auth Verification with Shared Session (P6-01) ---');
  
  const conversationIds = await Promise.all(
    tests.map(t => testMode(t.name, t.headers, t.body))
  );

  const allPassed = conversationIds.every(id => id !== null);
  if (!allPassed) {
    console.error('❌ FAILED: One or more multi-mode tests failed.');
    process.exit(1);
  }

  // Check for isolation
  const uniqueIds = new Set(conversationIds);
  if (uniqueIds.size === 3) {
    console.log('✅ PASSED: All 3 modes are correctly isolated (unique conversations for same session ID).');
  } else {
    console.error(`❌ FAILED: Isolation check failed. Expected 3 unique conversation IDs, got ${uniqueIds.size}.`);
    console.log('Conversation IDs:', conversationIds);
    process.exit(1);
  }
}

runAllTests().catch(console.error);
