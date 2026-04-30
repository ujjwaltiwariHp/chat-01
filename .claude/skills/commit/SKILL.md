---
name: commit
description: Generates a conventional commit message from the staged diff. Use when the user says "commit this", "save my changes", or "create commit".
---

# Smart commit

1. Check current status: `git status --short`.
2. Review recent commits for style: `git log --oneline -10`.
3. Read staged changes: `git diff --cached`.
4. Generate a **Conventional Commits** message (e.g., `feat(bot): add FAQ logic`).
5. Follow the rules in `CLAUDE.md` under "Conventions".
