# HP Intelligence — Workflow Guide

This project uses a "Double-Agent" architecture. Use the right tool for the right job.

## 🧭 Which tool when?

| Task                            | Primary Tool    | Shortcut / Command |
| ------------------------------- | --------------- | ------------------ |
| **Autocomplete / Patterns**     | Cursor Tab      | `Tab`              |
| **Single-file Refactor**        | Cursor Inline   | `Cmd + K`          |
| **Multi-file Implementation**   | Cursor Composer | `Cmd + I`          |
| **Autonomous Feature/Refactor** | Claude Code     | `claude`           |
| **Pull Ticket Context**         | Claude Skill    | `/start-ticket`    |
| **Pre-commit Audit**            | Claude Skill    | `/review`          |
| **PR-time Review**              | Cursor Bugbot   | (Automatic)        |

---

## 🔄 The 6-Step Loop

1.  **CONTEXT**: Use `/start-ticket` in Claude.
2.  **PLAN**: Draft a `PLAN.md`. Use Claude for a "Skeptical Review."
3.  **IMPLEMENT**: Switch to **Cursor Composer** (`Cmd+I`) for the heavy lifting.
4.  **VERIFY**: Use Claude's `/review` and `/test`.
5.  **COMMIT**: Use Claude's `/commit` for perfect messages.
6.  **SHIP**: Use Claude's `/pr-description` or GitHub MCP.

---

## 🧠 Standards Layer

- [**CLAUDE.md**](./CLAUDE.md) — The Master Source of Truth (Root).
- [**.cursor/rules/**](./.cursor/rules/) — File-specific logic (Automatic).
- [**AGENTS.md**](./AGENTS.md) — Universal fallback.

_Managed by `pnpm rules:sync` (and husky hooks)._
