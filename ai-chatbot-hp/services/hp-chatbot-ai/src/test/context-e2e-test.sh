#!/bin/bash

# Configuration
GATEWAY_URL="http://localhost:4000/api/v1/bots/chatbot/invoke"
# Load env relative to root
ENV_PATH="$(dirname "$0")/../../../../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
fi

STATIC_TOKEN="${INTERNAL_SERVICE_TOKEN}"
TEST_TENANT="${TEST_TENANT_ID}"
TEST_USER="${TEST_USER_ID}"
UNIQUE_SESSION=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))")

echo "--- 🧠 STARTING CONVERSATION CONTEXT & HISTORY TEST ---"
echo "Session ID: ${UNIQUE_SESSION}"
echo ""

# 1. SEND INITIAL CONTEXT
echo "Step 1: Sending initial fact ('My favorite animal is a Blue Whale')..."
RESPONSE1=$(curl -s -N -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: ${STATIC_TOKEN}" \
  -H "X-Tenant-ID: ${TEST_TENANT}" \
  -H "X-Customer-ID: ${TEST_USER}" \
  -H "X-Session-ID: ${UNIQUE_SESSION}" \
  -d '{"message": "I love Blue Whales. Remember that they are my favorite animal."}')

if [[ "$RESPONSE1" == *'"type":"start"'* ]]; then
  echo "✅ Step 1 Success: AI acknowledged the fact."
else
  echo "❌ Step 1 Failed: Gateway or Bot error."
  echo "$RESPONSE1"
  exit 1
fi

# Give the DB a moment to persist
sleep 3

# 2. ASK FOR RECALL
echo ""
echo "Step 2: Asking for the animal back..."
RESPONSE2=$(curl -s -N -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: ${STATIC_TOKEN}" \
  -H "X-Tenant-ID: ${TEST_TENANT}" \
  -H "X-Customer-ID: ${TEST_USER}" \
  -H "X-Session-ID: ${UNIQUE_SESSION}" \
  -d '{"message": "What is my favorite animal?"}')

echo "AI Response Analysis:"
if [[ "$RESPONSE2" == *"Blue Whale"* ]] || [[ "$RESPONSE2" == *"blue whale"* ]]; then
  echo "✅ SUCCESS: The AI correctly retrieved 'Blue Whale' from the conversation history!"
  echo "--------------------------------------------------------"
  echo "Test Result: PASSED 🌟"
  echo "--------------------------------------------------------"
  exit 0
else
  echo "❌ FAILED: The AI did not remember the animal."
  echo "Full Response Chunks:"
  echo "$RESPONSE2" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | tr -d '\n'
  echo ""
  exit 1
fi
