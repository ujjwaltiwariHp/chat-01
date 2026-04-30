import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load env relative to root
dotenv.config({ path: path.join(import.meta.dirname, '../../../../../.env') });

const GATEWAY_URL = `http://localhost:${process.env.GATEWAY_PORT || 4000}/api/v1`;
const TEST_EMAIL = 'p6_03_test@example.com';

async function requestMagicLink() {
  console.log(`[1/5] Requesting magic link for ${TEST_EMAIL}...`);
  const response = await fetch(`${GATEWAY_URL}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request magic link: ${await response.text()}`);
  }
  console.log('✅ Magic link requested successfully.');
}

async function verifyMagicLink(token: string) {
  console.log(`[2/5] Verifying magic link with token: ${token}...`);
  const response = await fetch(`${GATEWAY_URL}/auth/verify?token=${token}`, {
    method: 'GET',
    redirect: 'manual' // We want to capture the set-cookie header
  });

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie || !setCookie.includes('hp_jwt=')) {
    throw new Error('Failed to capture session cookie (hp_jwt)');
  }

  const jwt = setCookie.split(';')[0].split('=')[1];
  console.log('✅ Magic link verified. Captured hp_jwt.');
  return jwt;
}

async function checkProtectedPage(jwt: string) {
  console.log('[3/5] Accessing protected dashboard page...');
  const response = await fetch(`${GATEWAY_URL}/dashboard/usage`, {
    method: 'GET',
    headers: {
      'Cookie': `hp_jwt=${jwt}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to access protected page: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  console.log('✅ Successfully accessed protected page. Message:', data.message);
}

async function logout(jwt: string) {
  console.log('[4/5] Logging out...');
  const response = await fetch(`${GATEWAY_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Cookie': `hp_jwt=${jwt}`
    }
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }
  console.log('✅ Logged out successfully.');
}

async function checkSessionExpired(jwt: string) {
  console.log('[5/5] Verify session is expired/blocked after logout...');
  const response = await fetch(`${GATEWAY_URL}/dashboard/usage`, {
    method: 'GET',
    headers: {
      'Cookie': `hp_jwt=${jwt}`
    }
  });

  if (response.status === 401) {
    console.log('✅ Session correctly rejected after logout (401 Unauthorized).');
  } else {
    throw new Error(`Expected 401 after logout, but got ${response.status}`);
  }
}

// Since I can't easily extract token from DB within this script without DB driver, 
// I'll rely on the runner (AI) to pass the token or I'll try to find a way.
// Actually, I can use a shell command to get the token! 
function getTokenFromDb() {
  const cmd = `docker exec hp-intelligence-db psql -U postgres -d hp_intelligence -t -A -c "SELECT token FROM magic_link_tokens WHERE email = '${TEST_EMAIL}' ORDER BY created_at DESC LIMIT 1;"`;
  return execSync(cmd).toString().trim();
}

async function runE2ETest() {
  console.log('--- Magic Link E2E Verification (P6-03) ---');
  try {
    await requestMagicLink();
    const token = getTokenFromDb();
    if (!token) throw new Error('Could not retrieve token from database');
    
    const jwt = await verifyMagicLink(token);
    await checkProtectedPage(jwt);
    await logout(jwt);
    await checkSessionExpired(jwt);
    
    console.log('\n✅ PASSED: Magic-link E2E flow verified successfully.');
  } catch (error: any) {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
  }
}

runE2ETest();
