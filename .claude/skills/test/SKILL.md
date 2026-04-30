---
name: test
description: Generates tests for the current uncommitted changes. Uses Vitest + Supertest. Use when the user says "add tests", "test this", or after implementing a new feature in Step 3 of the loop.
argument-hint: [optional file path]
---

# Generate tests

1. Identify changed files (use `$ARGUMENTS` if provided, otherwise `git diff --name-only`).
2. Read `CLAUDE.md` "Tech stack" and "Commands" to understand the test framework (Vitest).
3. For each changed component/route, write a test that covers:
   - Happy path
   - Validation failure (400)
   - Edge cases (null/empty/error paths)
4. Place tests in `tests/` or alongside code if conventional for the specific service.
5. Run the new tests and iterate until they pass.
