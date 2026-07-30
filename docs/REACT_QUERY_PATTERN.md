# React Query domain pattern (established in T2-1)

The HR domain (`employees` + `attendance`) is the pilot: its state, CRUD, and
realtime subscription were removed from `CRMContext.tsx` and now live in
[src/hooks/useEmployees.ts](../src/hooks/useEmployees.ts) and
[src/hooks/useAttendance.ts](../src/hooks/useAttendance.ts). T2-2/T2-3/T2-4
migrate the remaining domains using this same shape.

## The pattern, per domain

One file per domain in `src/hooks/`, exporting:

1. **A query key constant** — `export const X_QUERY_KEY = ['x'] as const;`
   Exported so *other* domains can invalidate it (e.g. deleting an employee
   invalidates attendance, because the DB cascades).

2. **One read hook** (`useX()`) wrapping `useQuery`:
   - `queryFn` does the same `supabase.from(...).select(...)` the context did.
   - A `useEffect` opens a realtime channel for the table and, on ANY
     `postgres_changes` event, calls
     `queryClient.invalidateQueries({ queryKey })` — no hand-written
     INSERT/UPDATE/DELETE cache surgery. Invalidation refetches; at this
     app's data sizes that is simpler and safer than patching the cache.
   - The channel is **subscribed on mount, removed on unmount** (cleanup
     returns `supabase.removeChannel(channel)`). This is the key win over
     CRMContext: the app no longer holds ~24 always-on subscriptions; each
     domain listens only while a page actually using it is open.

3. **One mutation hook per write** (`useAddX`, `useUpdateX`, `useDeleteX`)
   wrapping `useMutation`:
   - `mutationFn` contains the same Supabase write the context function had,
     including its error wrapping (`throw new Error(\`Failed to ...\`)`) so
     existing `toast.error(err.message)` call sites keep working.
   - `onSuccess` invalidates the domain's query key (plus any other domain
     the write affects — see `useDeleteEmployee` invalidating attendance).
   - Multi-arg context functions become a single object arg:
     `addEmployee(input, createdBy)` → `mutateAsync({ input, createdBy })`.

## Consumer changes

- `const { x, addX, loading } = useCRM()` becomes:
  ```ts
  const { data: x = [], isLoading } = useX();
  const addX = useAddX();
  // call sites: await addX.mutateAsync({ ... })
  ```
- Default `data` to `[]` at the destructure so downstream `.filter/.map`
  code is untouched.

## Removing the domain from CRMContext

Delete, for the migrated domain: the interface fields, the `useState`, its
two lines in the initial `Promise.all` load (destructure + query), its
realtime `channel.on(...)` block, its CRUD `useCallback`s, and its entries
in BOTH the context value object and the `useMemo` dependency array (they
must stay in sync — typecheck catches a mismatch).

Leave a one-line comment pointing to the new hook file so nobody reintroduces
the state out of habit.

## Additions from T2-2 (clients / prospects / vendors)

- **Query-only variant for context-internal reads.** When CRMContext itself
  still needs a migrated domain's data (name lookups, validation, follow-up
  titles), it consumes a `useXQuery()` variant that has NO realtime channel —
  otherwise mounting it in the app-lifetime provider would recreate the
  always-on subscription the migration exists to remove. Freshness comes from
  the shared cache (any mounted `useX()` keeps it live) plus refetch-on-focus.
- **Cross-domain functions stay in the context** and invalidate the domain's
  query key instead of setting removed state: `addProspect` (fires
  autoFollowUp into context-held follow-up state) and `deleteClient` (unlinks
  context-held RFQs/orders). They move out only when their other domain
  migrates too.
- **Truly cross-domain mutations between two MIGRATED domains** become a
  hook invalidating both keys (`useConvertProspect` → prospects + clients),
  and read their inputs fresh from the DB, not from a cached copy.

## Additions from T2-3 (rfqs / orders / orderEngineers / supplierInquiries / supplierQuotes / rfqLineItems)

The RFQ/order domain took the "cross-domain stays in context" exception from
T2-2 much further: **every mutation stayed in `CRMContext`**, not just one or
two. Only the six arrays' state, initial load, and realtime subscriptions
moved out.

Why: `addOrder`, `updateOrderStatus`, `addRFQ`, `updateRFQStatus`,
`convertRFQToOrder`, `addSupplierInquiry`, and the rest all read across
multiple domains in one function body (`vendors.find(...)`,
`clients.find(...)`, `rfqs.find(...)`, `orders.find(...)`) and fire
`autoFollowUp(...)`, which itself owns `followUpActions` state. Splitting
these into per-domain mutation hooks would mean either (a) threading five
other domains' data into six new hook files as parameters, which just moves
the coupling rather than removing it, or (b) a real redesign of the
auto-follow-up engine — out of scope for a data-layer migration.

**The resulting shape differs from T2-1/T2-2:**
- `useOrders.ts` / `useRFQs.ts` / etc. export only a query-only variant
  (`useXQuery()`, no realtime — used internally by `CRMContext`) and a
  view-scoped realtime variant (`useX()` — used by every page). No mutation
  hooks in these files at all.
- `CRMContext` reads all six via the query-only variants (replacing their old
  `useState`), and every mutation function that used to call `setOrders`/
  `setRFQs`/etc. now calls `queryClient.invalidateQueries({ queryKey: ... })`
  instead — same function, same call sites for every consumer, zero
  `.mutate`/`.mutateAsync` conversions needed anywhere (unlike T2-2).
- The context's own `loading` flag became an aggregate:
  `baseLoading || ordersLoading || rfqsLoading || ...` for these six queries,
  so every existing `if (loading) return <Skeleton />` consumer kept working
  without modification — the six domains used to load as part of the same
  `Promise.all` `loading` already covered.

**Loading-gate rule of thumb, applied per consumer page:** if the array is
the page's core render content (the table body, the KPI math, the dropdown
whose absence blocks a required `<select>`), merge the hook's `isLoading`
into that page's own loading gate. If it's a supplementary lookup (a label
on a follow-up card, a linked-order info panel) that degrades gracefully to
an empty/zero state while loading, don't — gating the whole page on a
side lookup just delays the page for no user benefit. Get this wrong and
either the page flashes empty/zero data it used to load synchronously, or a
required dropdown briefly renders with no options.

## What stays out of scope until later tickets

- Server-side pagination/filtering: not needed for small tables (employees);
  T2-2+ adds it for large ones (RFQs, orders).
- Optimistic updates: invalidate-and-refetch is the default; add optimism
  only where UX demands it and note it in the hook.
