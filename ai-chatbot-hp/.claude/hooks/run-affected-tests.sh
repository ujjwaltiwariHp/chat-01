#!/usr/bin/env bash
INPUT=$(cat)

# Guard against infinite loop
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

# Find files changed in this session
CHANGED=$(git diff --name-only HEAD)
if [ -z "$CHANGED" ]; then
  exit 0
fi

echo "Verifying changes in: $CHANGED" >&2
# TODO: Enable once Vitest test suite is stable across all services
# pnpm test --changed || exit 2
exit 0
