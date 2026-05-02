import { useState } from 'react';
import { CheckCircle, X, PhoneCall, PhoneMissed, MessageSquare, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OutcomeResult = 'reached' | 'no_answer' | 'left_message' | 'not_required';

interface OutcomeModalProps {
  actionTitle: string;
  onConfirm: (outcome: OutcomeResult, note: string, createNextAction: boolean) => void;
  onCancel: () => void;
}

const OUTCOMES: { value: OutcomeResult; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'reached',
    label: 'Reached them',
    icon: <PhoneCall className="w-4 h-4" />,
    color: 'border-green-500/50 bg-green-500/10 text-green-600 data-[selected]:border-green-500 data-[selected]:bg-green-500/20',
  },
  {
    value: 'no_answer',
    label: 'No answer',
    icon: <PhoneMissed className="w-4 h-4" />,
    color: 'border-red-500/50 bg-red-500/10 text-red-500 data-[selected]:border-red-500 data-[selected]:bg-red-500/20',
  },
  {
    value: 'left_message',
    label: 'Left message',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 data-[selected]:border-yellow-500 data-[selected]:bg-yellow-500/20',
  },
];

export function OutcomeModal({ actionTitle, onConfirm, onCancel }: OutcomeModalProps) {
  const [outcome, setOutcome] = useState<OutcomeResult | null>(null);
  const [note, setNote] = useState('');
  const [createNext, setCreateNext] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!outcome) return;
    setSubmitting(true);
    await onConfirm(outcome, note.trim(), createNext);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-foreground">Complete Action</h2>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">"{actionTitle}"</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outcome selection */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">What happened?</p>
          <div className="grid grid-cols-3 gap-2">
            {OUTCOMES.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                data-selected={outcome === o.value ? '' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all',
                  o.color,
                  outcome === o.value ? 'ring-2 ring-offset-1 ring-offset-background' : 'opacity-70 hover:opacity-100'
                )}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Note <span className="text-muted-foreground">(Optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={
              outcome === 'reached'
                ? 'e.g. Client confirmed interest, will review by Friday...'
                : outcome === 'no_answer'
                ? 'e.g. Tried twice, will try again tomorrow...'
                : 'Add any context...'
            }
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            rows={3}
          />
        </div>

        {/* Create next action toggle */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted transition-colors">
          <div
            onClick={() => setCreateNext(p => !p)}
            className={cn(
              'w-10 h-5 rounded-full transition-colors flex-shrink-0 relative',
              createNext ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm',
              createNext ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Schedule next follow-up</p>
            <p className="text-xs text-muted-foreground">Opens the form to create a follow-up action after completing this one</p>
          </div>
        </label>

        {/* Action buttons */}
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
            disabled={!outcome || submitting}
            className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              'Completing...'
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
