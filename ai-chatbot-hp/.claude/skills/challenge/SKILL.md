---
name: challenge
description: Acts as a skeptical senior engineer to find holes, edge cases, and architectural flaws in the current PLAN.md. Use during Step 2 of the loop.
---

# Senior Skeptic Review

1. Read `PLAN.md`.
2. Review the plan as a senior engineer who is paid one thousand dollars for every flaw found.
3. Identify:
   - Failure modes not considered.
   - Wrong assumptions about the existing system.
   - Edge cases that could break the logic (nulls, timeouts, race conditions).
   - Violations of the layered architecture in `CLAUDE.md`.
4. Output findings as a numbered list. **Don't be polite — find the holes.**
5. Do NOT modify any files. Surface findings for discussion.
