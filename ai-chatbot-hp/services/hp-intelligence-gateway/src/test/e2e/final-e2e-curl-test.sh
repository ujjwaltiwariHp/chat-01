#!/bin/bash

# Configuration
GATEWAY_URL="http://localhost:4000/api/v1/bots"
# Load env relative to root
ENV_PATH="$(dirname "$0")/../../../../../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
fi

STATIC_TOKEN="${INTERNAL_SERVICE_TOKEN}"
DYNAMIC_TOKEN="dynamic_token_from_bash"
TEST_TENANT="${TEST_TENANT_ID}"
TEST_USER="${TEST_USER_ID}"

echo "--- 🚀 STARTING FINAL E2E INTEGRATION TEST (CURL) ---"

test_bot() {
  local name=$1
  local bot=$2
  local token=$3
  
  echo -n "[${name}] Testing ${bot}..."
  
  response=$(curl -s -i -N -X POST "${GATEWAY_URL}/${bot}/invoke" \
    -H "Content-Type: application/json" \
    -H "X-Service-Token: ${token}" \
    -H "X-Tenant-ID: ${TEST_TENANT}" \
    -H "X-Customer-ID: ${TEST_USER}" \
    -d "{\"message\": \"hello test bot\"}")

  # 1. Check HTTP Status
  if ! echo "$response" | grep -q "200 OK"; then
    echo " ❌ FAILED (HTTP Status Not 200)"
    echo "$response" | head -n 20
    return 1
  fi
  
  # 2. Check Content-Type (SSE)
  if ! echo "$response" | grep -q "text/event-stream"; then
    echo " ❌ FAILED (Not Event-Stream)"
    return 1
  fi
  
  # 3. Check for specific AI markers (start event)
  if ! echo "$response" | grep -q '"type":"start"'; then
    echo " ❌ FAILED (No 'start' event found)"
    return 1
  fi

  echo " ✅ SUCCESS."
  return 0
}

# 1. Verify Chatbot with Static Token
test_bot "STATIC_CHATBOT" "chatbot" "${STATIC_TOKEN}"
res1=$?

# 2. Verify HR Policy with Static Token
test_bot "STATIC_HR" "hr-policy" "${STATIC_TOKEN}"
res2=$?

# 3. Verify Dynamic Token Rotation via Redis
echo "[DYNAMIC_AUTH] Setting dynamic token in Redis..."
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" SADD hp:auth:internal_tokens "${DYNAMIC_TOKEN}" > /dev/null 2>&1

test_bot "DYNAMIC_HR" "hr-policy" "${DYNAMIC_TOKEN}"
res3=$?

# Cleanup Redis
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" SREM hp:auth:internal_tokens "${DYNAMIC_TOKEN}" > /dev/null 2>&1

echo ""
if [ $res1 -eq 0 ] && [ $res2 -eq 0 ] && [ $res3 -eq 0 ]; then
  echo "🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟"
  echo "🌟 ALL SYSTEMS OPERATIONAL: E2E TESTING COMPLETE 🌟"
  echo "🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟"
  exit 0
else
  echo "❌ TEST FAILED"
  exit 1
fi
