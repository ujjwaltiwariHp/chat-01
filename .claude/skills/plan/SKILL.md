---
name: plan
description: Drafts a PLAN.md based on the current CONTEXT and project conventions. Use in Step 2 of the loop.
---

# Write the plan

1. Read `CLAUDE.md`.
2. Read the current `CONTEXT` (from /start-ticket or chat history).
3. Draft a `PLAN.md` with:
   - **What**: User-visible change.
   - **Why**: Why this matters.
   - **Approach**: Bulleted file-by-file changes.
   - **Out of scope**: What we are NOT doing.
   - **Risks**: Potential technical debt or breakages.
   - **Tests**: Specific proof of work.
4. Save to `PLAN.md` and wait for the `/challenge` command. **Do NOT write code yet.**
