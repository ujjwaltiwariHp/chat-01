---
name: pr-description
description: Generates a professional PR description from PLAN.md and commit history. Use when the user says "ready to ship", "done with this ticket", or "generate PR".
---

# PR description

1. Read `PLAN.md` and the commit history of the current branch.
2. Compose a PR description with:
   - **What**: User-visible changes.
   - **Why**: Link to ticket context.
   - **How**: Summary of the architectural approach.
   - **Tests**: Evidence of verification (lint/test results).
3. Output markdown ready for GitHub.
