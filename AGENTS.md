# expense-tracker

Minimal expense tracker: Vue 3 + Vite frontend, Koa API, SQLite storage.
Monorepo, npm workspaces (`packages/shared`, `apps/api`, `apps/web`).

Domain vocabulary is defined in `CONTEXT.md`. Read it before naming anything.
If a word you need is not defined there, stop and ask rather than invent it.

> **Note on this file.** Claude Code reads `AGENTS.md` only when the working
> directory and its ancestors contain no `CLAUDE.md`. This repository has one,
> so this file exists as the **portable** form of the same rules for other
> agents — see `RULES.md` for what it loses compared with `.claude/rules/`.

## Commands

- `npm run dev` — start API (:3000) and web (:5173) together
- `npm test` — run all tests
- `npm run typecheck` — type-check every workspace
- `npm run build:shared` — rebuild `packages/shared` (required after editing it)

## Layout

| Path | Role |
|---|---|
| `packages/shared` | Types, zod schemas, money and date helpers. Source of truth for the API contract. |
| `apps/api` | Koa HTTP API |
| `apps/web` | Vue 3 SPA |

## Architecture

- Shared types come from `@expense/shared`. Never redefine a DTO on one side.
- **API layers run one way only: route → service → repository.** A route must
  not import a repository. A service must not import Koa's `ctx`.
- **Web layers run one way only: component → composable → store → api client.**
  A component must not call the api client directly.

## Code style

- TypeScript strict everywhere. Every exported function declares its return type.
- No `any`. To extend Koa's context, use `declare module 'koa'` with an explicit
  interface — never cast.
- Composables are named `use*`. Store files are `<domain>Store.ts`.
- Components are `PascalCase.vue` and named after the domain, not the layout.

## Domain rules

- **Money is always an integer number of cents.** Field names end in `Cents`.
  Never use a float for money. Convert yuan↔cents only in
  `packages/shared/src/money.ts`.
- **A transaction's direction is its `kind`, never the sign of its amount.**
  `amountCents` is positive for expenses and income alike; the only signed money
  is `netCents` on a summary or a balance.
- **Only expenses carry a `category`**, drawn from the closed enum `CATEGORIES`
  in `packages/shared/src/schemas.ts`. Income carries `null`.
- Dates are ISO 8601 `YYYY-MM-DD` strings. Never store or pass a `Date` object
  across a boundary. `recordedAt` is display-only: it never decides a period or
  enters a total.
- **Transactions are immutable once recorded.** There is no update operation: to
  fix a mistake, delete the transaction and record it again. Do not add a
  `PATCH` route.
- **Editing `apps/api/src/db/schema.sql` requires a migration.** `CREATE TABLE
  IF NOT EXISTS` cannot alter an existing database; bump `SCHEMA_VERSION` and
  append a step in `apps/api/src/db/migrations.ts` in the same change.

## Boundaries

- Every value crossing an HTTP boundary is parsed through a zod schema.
- Boundary schemas are **strict**: an unknown field is rejected, never silently
  dropped. A client that misspells `amountCents` must get a 400.
- In `apps/web`, `api/client.ts` is the only place `fetch` may appear. A store
  must never call `fetch` directly.
- Parse request bodies with `parseBody` from `middleware/validate.ts`.
- `ant-design-vue` is the one permitted UI component library, imported from
  `apps/web` only. Do not add a second one. No axios.
- **Ask before adding a dependency**, and say why it is needed.

## API-specific

- **Every Koa middleware must `await next()`** unless it deliberately terminates
  the response. A middleware that returns without calling `next()` silently
  disables everything registered after it, and nothing in the code will look
  wrong.
- `errorHandler` must be the first `app.use(...)`.
- Translate `ZodError` into 400. Everything else becomes a 500.
- Only the repository layer writes SQL. The repository translates rows by
  parsing them with the shared schema — never by casting.

## Web-specific

- The **store** owns global state and its mutations. It may call the API, but
  only through `api/client.ts`.
- The **composable** owns what the store structurally cannot: loading on
  `onMounted`, aborting in-flight requests on `onUnmounted`, and local UI state.
- Local UI state must not go into the global store. The active tab, whether the
  record sheet is open, and its preselected category all belong to the
  composable.
- Tab switching is local state, not a route: there is no router dependency, and
  the panels switch with `v-if` (never `<KeepAlive>`, which would replace
  `onUnmounted` with `onDeactivated` and break the abort contract).
- Parse every response with the schema from `@expense/shared`.

## Workflow

- Run `npm test` before changing behavior.
- When a rule turns out to be ambiguous while you are writing code, sharpen the
  rule in the same change — do not leave the ambiguity for the next task.
