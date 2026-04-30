#!/usr/bin/env bash
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "no commits")

# Try to extract a ticket ID from the branch name (e.g. HP-123)
TICKET=$(echo "$BRANCH" | grep -oE '[A-Z]{2,}-[0-9]+' | head -1)

cat <<EOF
{
  "additionalContext": "Current Branch: $BRANCH\nLast Commit: $LAST_COMMIT\nDetected Ticket Tracking: ${TICKET:-none}\nWorkflow Mandate: You MUST follow the 6-step loop in CLAUDE.md."
}
EOF
