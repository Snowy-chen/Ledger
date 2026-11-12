---
paths:
  - "apps/api/**"
---

# API rules

Applies to `apps/api`. Project-wide rules live in `CLAUDE.md`.

## Layering

- Layers run one way only: **route → service → repository**. A route must not
  import a repository. A service must not import Koa's `ctx`.
- Only the repository layer writes SQL. Nothing above it knows a table exists.
- The repository translates rows into domain types by **parsing** them with the
  schema from `@expense/shared` — never by casting. A row that breaks the
  contract should fail loudly at the boundary, not leak upward.

## Koa

- **Every middleware must `await next()`** unless it deliberately terminates the
  response. A middleware that returns without calling `next()` silently
  disables everything registered after it — and nothing in the code will look
  wrong. See `docs/verify-rules.md`, scenario C.
- `errorHandler` must be the **first** `app.use(...)`. It is the outer layer of
  the onion; registered anywhere else, thrown errors escape it unhandled.
- Translate `ZodError` into 400. Everything else is ours and becomes a 500.

## Boundaries

- Parse request bodies with `parseBody` from `middleware/validate.ts`. Do not
  read `ctx.request.body` directly.
- Validate `ctx.query` and `ctx.params` with a schema too — query strings arrive
  as `string | string[] | undefined`, never as the type you expect.
- The database schema in `db/schema.sql` repeats the domain invariants as `CHECK`
  constraints on purpose. Keep them in sync when the rules change.

## Schema changes

- **`schema.sql` alone cannot change an existing database.** It is applied with
  `CREATE TABLE IF NOT EXISTS`, so editing a `CHECK` or adding a column is a
  no-op on any file that already exists — the old shape survives silently and
  the first offending write fails as a 500. Bump `SCHEMA_VERSION` in
  `db/migrations.ts` and append a step in the same change.
- `migrate()` runs **after** `db.exec(schema.sql)`, never before: the step moves
  rows into the current tables, so those tables have to exist first. `api.md`'s
  `db/migrations.test.ts` opens a real v0 file and is the guard on this.
- Never rename `DATABASE_PATH`. A new filename is a new empty database, and the
  rows in the old one are orphaned with no error.

## Aggregates

- `GET /api/balance` deliberately reads no `period` query parameter. The balance
  is all-time; the endpoint's shape is what encodes that, so do not add one.
- The trend's zero-fill is the **service's** job, not SQL's. A `GROUP BY` only
  returns months that have rows, and a chart that silently drops the quiet
  months is a chart that lies.
