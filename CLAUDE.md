# expense-tracker

Minimal expense tracker. Vue 3 + Vite frontend, Koa API, SQLite storage.

Domain vocabulary lives in [`CONTEXT.md`](./CONTEXT.md). **Read it before naming
anything.** If a word you need is not defined there, stop and ask rather than
invent it.

## Commands

- `npm run dev` — start API (:3000) and web (:5173) together
- `npm test` — run all tests
- `npm run typecheck` — `tsc --noEmit` across every workspace
- `npm run build:shared` — rebuild `packages/shared` (required after editing it)

## Layout

| Path | Role |
|---|---|
| `packages/shared` | Types, zod schemas, money and date helpers. **Source of truth for the API contract.** |
| `apps/api` | Koa HTTP API |
| `apps/web` | Vue 3 SPA |

## Where the rules live

This file holds project-wide rules. Rules that only apply inside one workspace
live in `.claude/rules/`, scoped by a `paths` frontmatter field:

- `.claude/rules/api.md` — `apps/api/**`
- `.claude/rules/web.md` — `apps/web/**`
- `.claude/rules/shared.md` — `packages/shared/**`

Those files load **on demand**, when a matching file is touched. Do not
`@`-import them from here: an import would pull them in at startup for every
task and the scoping would stop meaning anything.

## Architecture

- Shared types come from `@expense/shared`. Never redefine a DTO on one side.
  Both apps and the API tests import the same schema — that is what makes a
  contract drift impossible to miss.
- Each workspace has its own one-way layer rule; see its file in
  `.claude/rules/`.

## Code style

- TypeScript strict everywhere. Every exported function declares its return type.
- No `any`. To extend Koa's context, use `declare module 'koa'` with an explicit
  interface — never cast.
- Composables are named `use*`. Store files are `<domain>Store.ts`.

## Domain rules

- **Money is always an integer number of cents.** Field names end in `Cents`.
  Never use a float for money. Convert yuan↔cents **only** in
  `packages/shared/src/money.ts`. See `docs/adr/0001-money-as-integer-cents.md`.
- **A transaction's direction is its `kind`, never the sign of its amount.**
  `amountCents` is positive for expenses and income alike; the only signed money
  in the system is `netCents` on a summary or a balance. See
  `docs/adr/0002-kind-carries-direction.md`.
- **Only expenses carry a `category`**, and it is the closed enum `CATEGORIES`
  in `packages/shared/src/schemas.ts`. Income carries `null`, so a transaction
  whose kind and category disagree is not representable.
- Dates are ISO 8601 `YYYY-MM-DD` strings. Never store or pass a `Date` object
  across a boundary. `occurredOn` is a date; `recordedAt` is a timestamp and is
  **display only** — it never decides a period or enters a total.
- **Transactions are immutable once recorded.** There is no update operation: to
  fix a mistake, delete the transaction and record it again. Do not add a
  `PATCH` route.
- **Changing `apps/api/src/db/schema.sql` requires a migration.**
  `CREATE TABLE IF NOT EXISTS` cannot alter a database that already exists, so a
  schema edit alone silently leaves old files on the old shape. Bump
  `SCHEMA_VERSION` and append a step in `apps/api/src/db/migrations.ts` in the
  same change.

## Boundaries

- Every value crossing an HTTP boundary is parsed through a zod schema.
- Boundary schemas are **strict**: an unknown field is rejected, never silently
  dropped. A client that misspells `amountCents` must get a 400.
- **`ant-design-vue` is the one permitted UI component library.** It was added
  on 2026-10-05 (reason: the hand-rolled form, month/date inputs and list rows
  needed real components). It is imported from `apps/web` only — never from
  `apps/api`. Do not add a second component library alongside it.
- No axios. `apps/web/src/api/client.ts` remains the only place `fetch` appears.
- **Ask before adding any other dependency**, and say why it is needed.

## Workflow

- Run `npm test` before changing behavior.
- When a rule turns out to be ambiguous while you are writing code, **sharpen
  the rule in the same change** — do not leave the ambiguity for the next task.
