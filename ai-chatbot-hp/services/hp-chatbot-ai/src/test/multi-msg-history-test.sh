#!/bin/bash

# Configuration
GATEWAY_URL="http://localhost:4000/api/v1/bots/chatbot/invoke"
HISTORY_URL="http://localhost:4000/api/v1/bots/chatbot/history"
# Load env relative to root
ENV_PATH="$(dirname "$0")/../../../../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
fi

STATIC_TOKEN="${INTERNAL_SERVICE_TOKEN}"
TEST_TENANT="${TEST_TENANT_ID}"
TEST_USER="multi_test_user_$(date +%s)"

# 1. Generate Secure High-Entropy Session ID
SESSION_ID=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))")

echo "--- 🚀 STARTING MULTI-MESSAGE HISTORY TEST ---"
echo "Session ID: ${SESSION_ID}"
echo "User ID:    ${TEST_USER}"
echo ""

# Messages to send
MESSAGES=(
  "Hey, message number one."
  "This is number two."
  "Third message coming through."
  "Fourth fact: I like pizza."
  "Fifth and final message."
)

# 2. RUN CONVERSATION (5 ROUNDS)
for i in "${!MESSAGES[@]}"; do
  msg="${MESSAGES[$i]}"
  echo "Sending Message #$((i+1)): '${msg}'..."
  
  RESPONSE=$(curl -s -N -X POST "${GATEWAY_URL}" \
    -H "Content-Type: application/json" \
    -H "X-Service-Token: ${STATIC_TOKEN}" \
    -H "X-Tenant-ID: ${TEST_TENANT}" \
    -H "X-Customer-ID: ${TEST_USER}" \
    -H "X-Session-ID: ${SESSION_ID}" \
    -d "{\"message\": \"${msg}\"}")

  if [[ "$RESPONSE" == *'"type":"start"'* ]]; then
    echo "  ✅ Sent."
  else
    echo "  ❌ FAILED to send message $((i+1))."
    echo "$RESPONSE"
    exit 1
  fi
  
  # Brief sleep to ensure sequential processing
  sleep 2
done

echo ""
echo "--- 📊 FETCHING HISTORY & VERIFYING ---"

# 3. FETCH HISTORY
HISTORY_RES=$(curl -s -X GET "${HISTORY_URL}/${SESSION_ID}" \
  -H "X-Service-Token: ${STATIC_TOKEN}" \
  -H "X-Tenant-ID: ${TEST_TENANT}" \
  -H "X-Customer-ID: ${TEST_USER}")

# count messages: each user msg has an AI response, so 5 * 2 = 10
MSG_COUNT=$(echo "$HISTORY_RES" | grep -o '"role":"' | wc -l)

echo "Resulting History JSON Summary:"
echo "$HISTORY_RES" | jq '.data.messages[] | {role: .role, content: .content}' 2>/dev/null || echo "$HISTORY_RES"

if [ "$MSG_COUNT" -ge 10 ]; then
  echo ""
  echo "✅ TEST PASSED: Found ${MSG_COUNT} messages in history (all 5 rounds recorded)!"
  echo "--------------------------------------------------------"
  echo "Status: 10/10 Enterprise Operational 🌟"
  echo "--------------------------------------------------------"
  exit 0
else
  echo ""
  echo "❌ TEST FAILED: Expected at least 10 messages, but found ${MSG_COUNT}."
  exit 1
fi
