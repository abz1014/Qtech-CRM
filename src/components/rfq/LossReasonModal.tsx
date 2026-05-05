import { useState } from 'react';
import { X, TrendingDown } from 'lucide-react';
import { LossReason } from '@/types/crm';

interface LossReasonModalProps {
  rfqTitle: string;
  onConfirm: (reason: LossReason, notes: string) => void;
  onCancel: () => void;
}

const LOSS_REASONS: { value: LossReason; label: string; icon: string }[] = [
  { value: 'price_too_high',          label: 'Price too high',               icon: '💰' },
  { value: 'delivery_too_slow',       label: 'Delivery time too slow',        icon: '⏱️' },
  { value: 'competitor_won',          label: 'Competitor won the deal',       icon: '🏆' },
  { value: 'client_budget_cut',       label: 'Client budget cut / cancelled', icon: '❌' },
  { value: 'specs_changed',           label: 'Client specs changed',          icon: '📋' },
  { value: 'went_direct_to_supplier', label: 'Client went direct to supplier',icon: '🔄' },
  { value: 'poor_follow_up',          label: 'Poor follow-up on our end',    icon: '📞' },
  { value: 'other',                   label: 'Other reason',                  icon: '✏️' },
];

export function LossReasonModal({ rfqTitle, onConfirm, onCancel }: LossReasonModalProps) {
  const [selected, setSelected] = useState<LossReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    await onConfirm(selected, notes.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Mark as Lost</h2>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">"{rfqTitle}"</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason selection */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Why did we lose this opportunity?</p>
          <div className="space-y-1.5">
            {LOSS_REASONS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setSelected(r.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                  selected === r.value
                    ? 'border-destructive/50 bg-destructive/10 text-destructive font-medium'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted/60'
                }`}
              >
                <span>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Detailed notes <span className="text-muted-foreground">(what happened? what could we do better?)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Client said our price was 15% higher than competitor XYZ. Need to improve our supplier pricing for this category..."
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected || submitting}
            className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-40"
          >
            {submitting ? 'Saving...' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}
