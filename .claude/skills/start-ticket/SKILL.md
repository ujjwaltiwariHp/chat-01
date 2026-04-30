---
name: start-ticket
description: Pulls ticket data, gathers context, and interviews the user to build a perfect mental model. Use when starting ANY new task.
argument-hint: [TICKET-ID or brief description]
---

# Start ticket

1. Use the **Linear MCP** to fetch ticket "$ARGUMENTS". Get the full description and all comments.
2. Output a **CONTEXT block**:
   - The user-facing change (1 sentence)
   - Acceptance criteria (numbered)
3. **Interview Pattern**: Use the `AskUserQuestion` tool to ask the developer 3-5 high-leverage questions about:
   - Technical implementation details
   - Edge cases or legacy code concerns
   - Tradeoffs or out-of-scope items
4. Once answered, suggest creating `PLAN.md` based on the template.
