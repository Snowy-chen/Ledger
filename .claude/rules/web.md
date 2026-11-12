---
paths:
  - "apps/web/**"
---

# Web rules

Applies to `apps/web`. Project-wide rules live in `CLAUDE.md`.

## Layering

- Layers run one way only: **component → composable → store → api client**.
- A component must not call `api/client.ts` directly. It goes through a
  composable or a store action.

## Store vs composable

The store lives for the whole app and cannot know when a screen appears or
disappears. That one fact draws the entire line:

- **Store** (`stores/<domain>Store.ts`) — global state and the operations that
  change it. It **may** call the API, but only through `api/client.ts`, never
  `fetch` directly.
- **Composable** (`composables/use*.ts`) — everything the store structurally
  cannot do: loading on `onMounted`, aborting in-flight requests on
  `onUnmounted`, and owning local UI state.
- **Local UI state must not go into the global store.** A search keyword or a
  dialog toggle that nothing outside the screen reads belongs in the composable,
  and should die with the component.

If a composable only forwards `storeToRefs(store)`, it is a shell. Either give
it one of the responsibilities above, or delete it.

## The mobile shell

The app is a 390px mobile layout with a bottom nav, not a routed multi-page site.

- **There is no router, and adding one needs approval like any other
  dependency.** Two tabs do not justify it: the active tab is local UI state on
  the composable, and `App.vue` switches panels with `v-if`.
- Use `v-if`, never `<KeepAlive>`. Keeping a panel alive swaps `onUnmounted` for
  `onDeactivated`, which silently disables the abort-on-unmount contract above.
- The active tab, whether the record sheet is open, and the category it opens on
  are all local UI state. They belong to the composable, not the store.
- Formatting comes from `@expense/shared`, not from the component: money via
  `formatYuanGrouped`, dates via `formatDayTime`. `apps/web` has no test script,
  so a formatter written here would have no assertions behind it.

## Network

- `api/client.ts` is the only place in the app where `fetch` may appear.
- Parse every response with the schema from `@expense/shared`. That is what turns
  a contract drift into an immediate error instead of a silently broken screen.

## UI components (ant-design-vue)

`ant-design-vue` is the one permitted component library (see `CLAUDE.md`). It is
registered once, in `main.ts`. Two of its widgets hand back values that are
**not** in domain form, and those values must never leave the component:

| Widget | Hands back | Must become, before it leaves the component |
|---|---|---|
| `a-date-picker` / `a-month-picker` | a `dayjs` object | an ISO string — `YYYY-MM-DD` for `occurredOn`, `YYYY-MM` for a period |
| `a-input-number` | a yuan `number` (float) | integer cents, via `toCents` from `@expense/shared` |

So the rule is: **a `dayjs` object, a `Date`, or a yuan float is component-local
UI state.** It may not be emitted, stored, or put in a store. Convert it at the
component edge — the `v-model` binding is where that conversion lives. This is
the same money and date rule from `CLAUDE.md`, restated for these widgets;
`toCents` in `packages/shared/src/money.ts` stays the only yuan↔cents conversion.

## Naming

- Components are `PascalCase.vue` and named after the domain, not the layout:
  `ExpenseForm.vue`, not `Form.vue`.
