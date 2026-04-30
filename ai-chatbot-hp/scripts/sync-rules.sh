#!/bin/bash

# Configuration (Single Source of Truth)
SOURCE="CLAUDE.md"
TARGETS=(".cursorrules" ".cursor/rules/always.mdc" "AGENTS.md" ".clauderules" ".agent/instructions.md")

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔄 Syncing AI Standards Layer..."

# Check if source exists
if [ ! -f "$SOURCE" ]; then
    echo "❌ Error: Source file $SOURCE not found!"
    exit 1
fi

# Propagate changes
for target in "${TARGETS[@]}"; do
    # Ensure parent directory exists
    mkdir -p "$(dirname "$target")"

    # For .mdc files, we wrap the source in YAML frontmatter safely
    if [[ "$target" == *.mdc ]]; then
        {
          echo "---"
          echo "alwaysApply: true"
          echo "---"
          echo "# Auto-generated from CLAUDE.md — do not edit"
          echo ""
          cat "$SOURCE"
        } > "$target"
    else
        # For standard files, a direct copy is safest
        cp "$SOURCE" "$target"
    fi
    echo -e "  ${GREEN}✓${NC} $SOURCE -> $target"
done

echo -e "${GREEN}✨ All AI Standard files are now in sync!${NC}"
