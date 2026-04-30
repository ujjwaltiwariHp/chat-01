# HP Intelligence — AI Governance & Hygiene

This document defines how we manage our AI infrastructure and standards.

## 1. Standards as Code

Our Standards Layer (`CLAUDE.md`, `.cursor/rules/`, `.claude/`) is high-leverage infrastructure.

- **PR Required**: Any changes to `CLAUDE.md` must be reviewed in a PR.
- **Explain "Why"**: Every change to a standard must include a rationale (e.g., "Updated to Node 24 because of XYZ").
- **No Cowboy Syncing**: Changes should be made to `CLAUDE.md` first, then synced via `pnpm rules:sync`.

## 2. Maintenance Schedule

We maintain the "AI Sharpness" of this repo through a **Quarterly Prune**:

- **Date**: 1st Monday of every Quarter.
- **Goal**: Remove obsolete rules, update tech stack versions, and vet new skills.
- **Checklist**:
  - [ ] Are all `Forbidden patterns` still relevant?
  - [ ] Does Claude/Cursor now handle any rule correctly without an instruction? (Delete if yes).
  - [ ] Audit the `.claude/settings.json` for redundant MCPs or hooks.

## 3. Security Bar

- **Secret Management**: Never commit secrets. Use the `block-protected-paths` hook to protect `.env`.
- **Skill Vetting**: Before adding a new `.claude/skill`, a human must read the `SKILL.md` and any associated `scripts/`.
- **Read-Only Access**: All DB MCPs must use **Read-Only** users for the development database.

## 4. Onboarding

Every new engineer must pair with a senior on their **first PR** to experience the "Step ④ Verify" enforcement in action.
