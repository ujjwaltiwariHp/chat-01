# Claude Project Configuration

This directory contains instructions, conventions, and "skills" for AI agents (Antigravity, Claude, Cursor, etc.) working on the HP Intelligence monorepo.

## Structure

- `README.md`: This file.
- `CLAUDE.md` (Root): The central source of truth for coding standards, tech stack, and conventions.
- `skills/`: Specialized instructions for specific domains.
- `commands/`: Custom slash commands for the development loop.
- `agents/`: Sub-agent definitions.

## Maintenance

**CLAUDE.md** is the single source of truth. Whenever you update it, run:

```bash
pnpm rules:sync
```

This ensures Cursor (`.cursor/rules/always.mdc`), Codex, and other tools always have the latest project context.
