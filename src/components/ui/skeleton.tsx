import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-muted/70', className)} />
  );
}

// ── KPI card skeleton ────────────────────────────────────────────────────────
export function KpiCardSkeleton() {
  return (
    <div className="kpi-card space-y-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// ── Table row skeleton ───────────────────────────────────────────────────────
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          {i === 0 ? (
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ) : (
            <Skeleton className={`h-3.5 ${i === cols - 1 ? 'w-16' : 'w-20'}`} />
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Full table skeleton ──────────────────────────────────────────────────────
export function TableSkeleton({ cols = 5, rows = 8, headers }: { cols?: number; rows?: number; headers?: string[] }) {
  return (
    <div className="glass-card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {(headers ?? Array.from({ length: cols }, (_, i) => String(i))).map((h, i) => (
              <th key={i} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                {headers ? h : <Skeleton className="h-3 w-16" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dashboard skeleton ───────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-52" />
      </div>

      {/* Three KPI groups: 4 + 4 + 3 cards */}
      {[4, 4, 3].map((count, gi) => (
        <div key={gi} className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}

      {/* Recent orders table placeholder */}
      <div className="glass-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/40">
              <div className="flex items-center gap-2.5 flex-1">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-3.5 w-24 hidden sm:block" />
              <Skeleton className="h-3.5 w-16 hidden md:block" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
