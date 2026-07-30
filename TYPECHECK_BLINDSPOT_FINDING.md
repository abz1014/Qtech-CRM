# Finding: `tsc --noEmit` has been checking almost nothing

**Date found:** 2026-07-30
**Severity:** High — affects trust in every past "typecheck clean" claim and in CI's Typecheck gate
**Found during:** T1-2 (part 3/3), investigating a suspected type error in `recordPayablePayment`

## What's wrong

The root `tsconfig.json` is a **composite/references-only config**:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`"files": []` with no `include` means this config, on its own, contains **zero source files to check**. That layout is only meaningful under `tsc --build` (`-b`), which recurses into the referenced projects. Running the plain form:

```bash
npx tsc --noEmit
```

against the root config does not check the app source. It's a near no-op — it succeeds regardless of how many real type errors exist in `src/`.

## Why it matters

This is very likely the exact command developers run locally, and — if `.github/workflows/ci.yml`'s Typecheck step invokes `tsc --noEmit` the same way — the CI gate has been rubber-stamping broken code, possibly for the project's entire history, not just this session.

## How it was found

While working on `recordPayablePayment` in `src/contexts/CRMContext.tsx`, I noticed it reads `payment.reference_number` and `payment.notes`, but `CreatePayablePaymentInput` (`src/types/bookkeeping.ts`) only declares `payable_id`, `amount`, `payment_date`, `payment_method`. That should be a hard `TS2339` compile error. It wasn't showing up under any typecheck run this session.

I built an isolated repro (`scratch_check.ts`, since deleted) with explicit strict flags — it correctly flagged the same property access as an error outside the project's own tsconfig chain. That contradiction is what led to inspecting `tsconfig.json` and finding the `"files": []` issue.

## Proof: the correct invocation

Running the check against the real app project directly:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

surfaces a large number of previously-invisible, genuinely real errors in `src/contexts/CRMContext.tsx`, including:

- `TS2339` — `payment.reference_number` / `payment.notes` accessed on `CreatePayablePaymentInput`, which has neither field (the bug this investigation started from)
- `TS2339` — `Property 'status' does not exist on type 'Payable'` (~line 1525)
- Widespread `TS2352`-style unsafe casts: `Record<string, unknown>` forced into domain types in the data-loading code
- A `.catch()` call chained on a type that doesn't support it
- A final `CRMContextType` assignability error at the bottom of the file

**None of these are regressions from this session's work** — the surrounding lines (e.g. the `autoFollowUp` block at 967–978, touched by T1-1) were checked and predate this session's edits. They are pre-existing, previously-undetected bugs.

## What needs deciding

1. **Fix the invocation**, not just today — in `package.json`'s typecheck script and in `.github/workflows/ci.yml`, change `tsc --noEmit` to either:
   - `tsc --noEmit -p tsconfig.app.json` (and a second pass for `tsconfig.node.json` if that project also needs checking), or
   - `tsc --build` (`-b`), which is what the root config's shape was actually designed for.
2. **Triage the newly-visible errors** once the invocation is fixed — decide which get fixed immediately vs. ticketed. This overlaps directly with the backlog's **T1-4 (enable strict TypeScript incrementally)** and probably should anchor that ticket's starting point, since right now "enable strict mode" would be built on top of a check that isn't even running in loose mode.
3. Until (1) is fixed, treat **every prior "typecheck clean" verification claim in this engagement** (T1-1, T1-2 parts 1 and 2 included) as unverified by typecheck — they were still manually reviewed and live-tested end-to-end, so functionally they're fine, but the compiler never actually looked at them.
