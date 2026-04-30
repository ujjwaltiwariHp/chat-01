import dotenv from 'dotenv';
import path from 'path';

// Load env relative to root
dotenv.config({ path: path.join(import.meta.dirname, '../../../../.env') });

const WIDGET_URL = `http://localhost:${process.env.WIDGET_PORT || 4010}/api/v1/widget/chat`;
const API_KEY = process.env.HP_WIDGET_TEST_TOKEN!;

async function sendChat(sessionId: string) {
  try {
    const response = await fetch(WIDGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-Session-ID': sessionId,
        'Origin': 'http://localhost'
      },
      body: JSON.stringify({ message: 'test reset' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, status: response.status, message: errorText };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function runResetTest() {
  console.log(`--- Widget Reset Verification (P6-02) ---`);
  
  console.log('Sending request after reset...');
  const res = await sendChat('p6_02_post_reset_session');
  if (res.success) {
    console.log('✅ SUCCESS: Request allowed after reset.');
  } else {
    console.error('❌ FAILED: Request still blocked after reset.', res);
    process.exit(1);
  }
}

runResetTest().catch(console.error);
