import { useState, useMemo } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { businessToday } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ArrowDownCircle, Receipt, Wallet, ShieldAlert } from 'lucide-react';

export type Preset = 'this_month' | 'last_3' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getPresetRange(preset: Preset): { from: string; to: string } {
  const today = businessToday();
  const y = parseInt(today.slice(0, 4));
  const m = parseInt(today.slice(5, 7)) - 1;

  // Read calendar parts directly — Date.toISOString() converts to UTC and
  // shifts local dates back a day (e.g. month start became prev month's last day).
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case 'this_month': return { from: fmt(new Date(y, m, 1)), to: today };
    case 'last_3':      return { from: fmt(new Date(y, m - 2, 1)), to: today };
    case 'this_year':   return { from: fmt(new Date(y, 0, 1)), to: today };
    case 'last_year':   return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    case 'all_time':    return { from: '2000-01-01', to: today };
    default:             return { from: fmt(new Date(y, m, 1)), to: today };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_3',     label: 'Last 3 Months' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'all_time',   label: 'All Time' },
  { key: 'custom',     label: 'Custom' },
];

const TABS = [
  { to: '/finance',               label: 'Overview',      icon: LayoutDashboard, end: true,  usesRange: true },
  { to: '/finance/receivables',   label: 'Receivables',   icon: ArrowDownCircle, end: false, usesRange: false },
  { to: '/finance/expenses',      label: 'Expenses',      icon: Receipt,         end: false, usesRange: true },
  { to: '/finance/cashflow',      label: 'Cash Flow & P&L', icon: Wallet,        end: false, usesRange: true },
  { to: '/finance/reconciliation', label: 'Reconciliation', icon: ShieldAlert,   end: false, usesRange: false },
];

export interface FinanceOutletContext {
  range: { from: string; to: string };
  rangeLabel: string;
  isAllTime: boolean;
}

export function useFinanceRange() {
  return useOutletContext<FinanceOutletContext>();
}

export default function FinanceLayout() {
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (preset === 'custom') return getPresetRange('this_month');
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const rangeLabel = preset === 'custom' ? 'Custom range' : (PRESETS.find(p => p.key === preset)?.label ?? 'Selected period');
  const inputCls = 'px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  // The period picker lives once here for the whole section. Receivables and
  // Reconciliation ignore `range` entirely (current-state snapshots, not
  // period reports) — they just don't read it from the outlet context.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Money in, money out, and what's owed — admin only</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                preset === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {preset === 'custom' && (
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {/* ── Section tabs ── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ range, rangeLabel, isAllTime: preset === 'all_time' } satisfies FinanceOutletContext} />
    </div>
  );
}
