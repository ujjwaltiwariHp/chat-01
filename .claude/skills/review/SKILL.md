---
name: review
description: Adversarial self-review of current changes against CLAUDE.md standards. Use before every commit and after Step 3.
---

# Self-Review

1. Read `CLAUDE.md` sections "Conventions" and "Forbidden patterns".
2. Run `git diff` to get the uncommitted changes.
3. For each changed file, evaluate:
   - **Architecture**: Does it stay in its layer? (e.g. no SQL in routes).
   - **Robustness**: Are off-by-ones, null handling, and race conditions addressed?
   - **Errors**: Are all paths returning `AppError` subclasses?
   - **Security**: Are we exposing PII or sensitive data in logs?
4. Output findings ordered by severity:
   - **BLOCKER**: Violates `CLAUDE.md` or has a bug.
   - **IMPORTANT**: Significant improvement possible.
   - **NIT**: Style or minor logic cleanup.
5. Identify one thing we could **simplify** (the "Simplifier" pattern).
