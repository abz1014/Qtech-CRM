import { useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SnoozePopoverProps {
  onSnooze: (date: string) => void;
  onClose: () => void;
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow',  days: 1 },
  { label: '2 Days',    days: 2 },
  { label: '3 Days',    days: 3 },
  { label: '1 Week',    days: 7 },
  { label: '2 Weeks',   days: 14 },
];

export function SnoozePopover({ onSnooze, onClose }: SnoozePopoverProps) {
  const [custom, setCustom] = useState('');

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-52 glass-card p-3 shadow-xl border border-border rounded-xl space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <AlarmClock className="w-3 h-3" /> Snooze until
      </p>

      {QUICK_OPTIONS.map(o => (
        <button
          key={o.days}
          onClick={() => onSnooze(addDays(o.days))}
          className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
        >
          {o.label}
          <span className="text-muted-foreground ml-1 text-xs">({addDays(o.days)})</span>
        </button>
      ))}

      <div className="border-t border-border pt-2">
        <p className="text-xs text-muted-foreground mb-1">Custom date</p>
        <div className="flex gap-1">
          <input
            type="date"
            value={custom}
            min={addDays(1)}
            onChange={e => setCustom(e.target.value || '')}
            className="flex-1 px-2 py-1 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => custom && onSnooze(custom)}
            disabled={!custom}
            className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full text-xs text-muted-foreground hover:text-foreground text-center pt-1"
      >
        Cancel
      </button>
    </div>
  );
}
