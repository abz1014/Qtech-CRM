import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { X, Zap, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react';
import { SEQUENCES, getSequencesForEntity, Sequence } from '@/lib/sequences';
import { EntityType } from './FollowUpForm';
import { cn } from '@/lib/utils';

interface SequenceModalProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  onClose: () => void;
  onApplied: () => void;
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const PRIORITY_CLS: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/30',
  medium: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30',
  low:    'text-blue-500 bg-blue-500/10 border-blue-500/30',
};

export function SequenceModal({ entityType, entityId, entityLabel, onClose, onApplied }: SequenceModalProps) {
  const { applySequence } = useCRM();
  const { user } = useAuth();

  const sequences = getSequencesForEntity(entityType);
  const [selected, setSelected] = useState<Sequence | null>(sequences[0] ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await applySequence(selected.steps, entityType, entityId, user?.id ?? null);
      setApplied(true);
      setTimeout(onApplied, 1200);
    } catch {
      alert('Failed to apply sequence');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Apply Sequence</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entity badge */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-xs text-muted-foreground capitalize">{entityType}</span>
            <span className="text-sm font-medium text-primary truncate">{entityLabel}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {sequences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sequences available for this entity type.
            </p>
          ) : (
            sequences.map(seq => {
              const isSelected = selected?.id === seq.id;
              const isExpanded = expanded === seq.id;

              return (
                <div
                  key={seq.id}
                  className={cn(
                    'border rounded-xl transition-all cursor-pointer',
                    isSelected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-border/80 hover:bg-muted/30'
                  )}
                  onClick={() => setSelected(seq)}
                >
                  {/* Sequence header */}
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-2xl flex-shrink-0">{seq.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isSelected && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                        <p className="font-semibold text-foreground text-sm">{seq.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{seq.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {seq.steps.length} actions · up to {seq.steps[seq.steps.length - 1].daysFromNow} days
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : seq.id); }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Steps preview */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 space-y-2 mt-1">
                      {seq.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 pt-2">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </div>
                            {i < seq.steps.length - 1 && (
                              <div className="w-px h-4 bg-border mt-1" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{step.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {step.daysFromNow === 0 ? 'Today' : `Day ${step.daysFromNow}`} — due {addDays(step.daysFromNow)}
                              </span>
                              <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium capitalize', PRIORITY_CLS[step.priority])}>
                                {step.priority}
                              </span>
                            </div>
                            {step.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">{step.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selected || applying || applied}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applied ? (
              <><CheckCircle className="w-4 h-4" /> Applied!</>
            ) : applying ? (
              'Applying...'
            ) : (
              <><Zap className="w-4 h-4" /> Apply {selected?.steps.length ?? 0} Actions</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
