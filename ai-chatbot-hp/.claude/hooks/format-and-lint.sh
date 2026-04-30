#!/usr/bin/env bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    pnpm exec prettier --write "$FILE_PATH" >&2
    pnpm exec eslint --fix "$FILE_PATH" >&2 || exit 2
    ;;
  *.json|*.md|*.yml|*.yaml)
    pnpm exec prettier --write "$FILE_PATH" >&2
    ;;
esac

exit 0
