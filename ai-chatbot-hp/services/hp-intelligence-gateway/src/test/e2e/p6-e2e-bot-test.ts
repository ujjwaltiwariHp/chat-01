import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { createClient } from 'redis';

// Load env relative to root
dotenv.config({ path: path.join(import.meta.dirname, '../../../../../.env') });

const GATEWAY_URL = `http://localhost:${process.env.PORT || 4000}/api/v1/bots`;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN!;
const TEST_TENANT = process.env.TEST_TENANT_ID!;
const TEST_USER = process.env.TEST_USER_ID!;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function testBotInvoke(name: string, bot: string, headers: any, body: any) {
  console.log(`[${name}] Testing bot: ${bot}...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${GATEWAY_URL}/${bot}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${name}] ❌ FAILED: HTTP ${response.status} - ${errorText}`);
      return false;
    }

    // Expect SSE
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('event-stream')) {
      console.error(`[${name}] ❌ FAILED: Response is not SSE (Content-Type: ${contentType})`);
      return false;
    }

    // Check custom headers returned by gateway
    const returnedSession = response.headers.get('x-session-id');
    if (headers['X-Session-ID'] && !returnedSession) {
       console.warn(`[${name}] ⚠️ WARNING: Header X-Session-ID not returned by gateway.`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body in response');

    let receivedContent = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      if (chunk.includes('data:')) receivedContent = true;
      if (chunk.includes('"done": true')) break; 
    }
    
    if (receivedContent) {
      console.log(`[${name}] ✅ SUCCESS: Interaction complete in ${Date.now() - startTime}ms.`);
      return true;
    } else {
      console.error(`[${name}] ❌ FAILED: No data received in SSE stream.`);
      return false;
    }

  } catch (error: any) {
    console.error(`[${name}] ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runE2ETest() {
  console.log('--- HP-Intelligence Bot E2E Integration Verification ---');
  
  const commonHeaders = {
    'X-Service-Token': INTERNAL_TOKEN,
    'X-Tenant-ID': TEST_TENANT,
    'X-Customer-ID': TEST_USER,
    'X-Session-ID': `e2e_test_session_${Date.now()}`,
    'X-Request-ID': `req_${Date.now()}`
  };

  // 1. Test Chatbot AI via Gateway
  const bot1 = await testBotInvoke('STATIC_TOKEN_CHATBOT', 'chatbot', commonHeaders, { message: 'hello bot' });
  
  // 2. Test HR Policy AI via Gateway
  const bot2 = await testBotInvoke('STATIC_TOKEN_HR_POLICY', 'hr-policy', commonHeaders, { message: 'what is the leave policy?' });

  // 3. Test Zero-Downtime Token Rotation via Redis
  console.log('[DYNAMIC_TOKEN_TEST] Adding new rotational token to Redis...');
  const dynamicToken = 'rotating_secret_' + crypto.randomBytes(4).toString('hex');
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  await redis.sAdd('hp:auth:internal_tokens', dynamicToken);
  
  const dynamicHeaders = {
    ...commonHeaders,
    'X-Service-Token': dynamicToken, // Using the new rotational token
    'X-Session-ID': `e2e_test_dynamic_${Date.now()}`
  };

  const bot3 = await testBotInvoke('DYNAMIC_TOKEN_TEST', 'hr-policy', dynamicHeaders, { message: 'test dynamic token' });
  
  // Cleanup Redis
  await redis.sRem('hp:auth:internal_tokens', dynamicToken);
  await redis.disconnect();

  if (bot1 && bot2 && bot3) {
    console.log('\n🌟 ALL E2E BOT TESTS PASSED 🌟');
    process.exit(0);
  } else {
    console.error('\n❌ E2E INTEGRATION FAILED');
    process.exit(1);
  }
}

runE2ETest().catch(console.error);
