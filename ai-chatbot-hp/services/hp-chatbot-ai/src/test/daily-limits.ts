import dotenv from "dotenv";
import path from "path";

// Load env from monorepo root
dotenv.config({ path: path.join(import.meta.dirname, "../../../../.env") });

const GATEWAY_URL =
  process.env.TEST_GATEWAY_URL ||
  "http://localhost:4005/api/v1/bots/chatbot/invoke";
const BIZ_KEY = process.env.HP_BIZ_API_KEY!;
const TENANT_ID = process.env.TEST_TENANT_ID!;
const SESSION_ID = "quota-test-" + Date.now();

async function sendMessage(count: number) {
  console.log(`Sending message #${count}...`);
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BIZ_KEY}`,
        "X-Tenant-ID": TENANT_ID,
        "X-Session-ID": SESSION_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Test message " + count }),
    });

    if (response.ok) {
      console.log(`Response #${count}: OK (Status ${response.status})`);
      return true;
    } else {
      const data = await response.json().catch(() => ({}));
      console.log(`Response #${count}: FAILED (Status ${response.status})`);
      console.log("Error Data:", JSON.stringify(data));
      return false;
    }
  } catch (error: any) {
    console.log(`Response #${count}: ERROR - ${error.message}`);
    return false;
  }
}

async function runTest() {
  console.log("--- Daily Quota Integration Test (Gateway -> Chatbot) ---");
  console.log(`Target: ${GATEWAY_URL}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Session: ${SESSION_ID}`);
  console.log("Total Daily Quota: 20 messages per session");
  console.log(
    "Expected: 21st request fails with 429 SESSION_DAILY_LIMIT_EXCEEDED",
  );

  let successCount = 0;
  for (let i = 1; i <= 25; i++) {
    const success = await sendMessage(i);
    if (success) {
      successCount++;
    } else {
      console.log(`Stopped at message #${i} as expected.`);
      break;
    }
  }

  console.log("\n--- Test Summary ---");
  console.log(`Total Successes: ${successCount}`);
  if (successCount === 20) {
    console.log(
      "✅ PASSED: Daily limit triggered exactly on the 21st request.",
    );
  } else {
    console.log(
      "❌ FAILED: Unexpected success count. Ensure Redis was reset before running.",
    );
  }
}

runTest().catch(console.error);
