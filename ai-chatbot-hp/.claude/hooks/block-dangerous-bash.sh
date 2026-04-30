#!/usr/bin/env bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

# Block destructive patterns
if echo "$COMMAND" | grep -qE 'rm -rf (/|~|\$HOME|\*)'; then
  echo "Blocked: 'rm -rf' against root, home, or wildcard. Use a more specific path." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE 'DROP\s+(TABLE|DATABASE|SCHEMA)'; then
  echo "Blocked: SQL DROP detected. Use Drizzle migrations instead." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE 'git push.*--force.*(main|master|production)'; then
  echo "Blocked: force-push to protected branch is forbidden by project rules." >&2
  exit 2
fi

exit 0
