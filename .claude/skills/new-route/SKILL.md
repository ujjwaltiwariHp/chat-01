---
name: new-route
description: Scaffolds a new HTTP route following project conventions. Use when the user says "add a route", "create endpoint", or "new api".
argument-hint: [METHOD] [path] [resource-name]
---

# New route

Args: $ARGUMENTS (e.g., `POST /api/v1/bot/:id/status status`)

Create or update:

1. `services/<service>/src/routes/v1/<resource>.route.ts`
2. `services/<service>/src/services/<resource>.service.ts`
3. `services/<service>/src/controllers/<resource>.controller.ts`
4. `services/<service>/src/schemas/<resource>.schema.ts` (Zod)

Follow conventions in `CLAUDE.md` and `.cursor/rules/`.
Add an integration test covering the happy path.
