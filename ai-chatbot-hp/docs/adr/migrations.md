# ADR: Database Migrations

## Context

We use `knex` for migrations and `drizzle-orm` for runtime access.

## Strategy

1. Use `pnpm db:generate` (via drizzle-kit) to create SQL/TS diffs.
2. Ensure every migration has a `down` or `rollback` path.
3. Migrations must be idempotent.
4. Large table migrations (indexes, column drops) should be planned for low-traffic windows.
