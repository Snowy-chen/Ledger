---
paths:
  - "packages/shared/**"
---

# Shared rules

Applies to `packages/shared`. Project-wide rules live in `CLAUDE.md`.

This package is the single source of truth for the API contract. Both apps
import from it, so a change here is a breaking change for both — that is the
point, not a problem to route around.

## Money and dates

- `money.ts` is the **only** place in the entire repository where yuan↔cents
  conversion happens. Do not add a second conversion, here or anywhere else.
- `date.ts` owns every date-format decision, including what "today" means. That
  covers **display** formats too (`formatDayTime`), not just parsers: anything
  with a `now` parameter belongs here, because this is the only package with a
  test script behind it.
- `date.ts` must not import from `schemas.ts`. The dependency runs the other way
  (`schemas.ts` imports `isIsoDate`), so importing back would make it circular —
  validate a period with the local pattern instead.
- A formatter that takes "now" must take it as a **parameter**, never read the
  clock itself. That is what keeps "今天" decidable by the caller and testable
  without faking timers.

## Schemas

- Boundary schemas use `z.strictObject`, never `z.object`. An unknown field must
  be rejected, not silently dropped — a client that misspells `amountCents`
  should get a 400, not a mystery.
- Derive types with `z.infer` instead of hand-writing an `interface`. Two
  definitions drift apart; one cannot.
- When the contract changes, both `apps/api` and `apps/web` must be updated in
  the same change. If you cannot, the change is not ready.

## Tests

- Every constraint you add to a schema needs an assertion that it is actually
  enforced. `schemas.test.ts` is where "money is integer cents" is proven, not
  just asserted in prose.
