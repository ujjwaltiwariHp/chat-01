#!/usr/bin/env bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

# Convert to absolute path for matching
ABS_PATH=$(realpath -m "$FILE_PATH")

# List of protected patterns
PROTECTED=(
  ".env"
  "pnpm-lock.yaml"
  ".git/"
  ".cursorrules"
)

for pattern in "${PROTECTED[@]}"; do
  if [[ "$ABS_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $pattern is protected. Use the sync script or manual edits for this file." >&2
    exit 2
  fi
done

exit 0
