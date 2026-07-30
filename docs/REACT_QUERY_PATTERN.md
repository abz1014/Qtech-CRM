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

## What stays out of scope until later tickets

- Server-side pagination/filtering: not needed for small tables (employees);
  T2-2+ adds it for large ones (RFQs, orders).
- Optimistic updates: invalidate-and-refetch is the default; add optimism
  only where UX demands it and note it in the hook.
