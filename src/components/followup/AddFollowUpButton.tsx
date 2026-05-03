import { useState } from 'react';
import { Bell, Zap, ChevronDown } from 'lucide-react';
import { FollowUpForm, EntityType } from './FollowUpForm';
import { SequenceModal } from './SequenceModal';
import { getSequencesForEntity } from '@/lib/sequences';

interface AddFollowUpButtonProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  variant?: 'button' | 'icon';
  className?: string;
  onActionCreated?: () => void;
}

export function AddFollowUpButton({
  entityType,
  entityId,
  entityLabel,
  variant = 'button',
  className = '',
  onActionCreated,
}: AddFollowUpButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [showSequence, setShowSequence] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const hasSequences = getSequencesForEntity(entityType).length > 0;

  const handleClose = () => {
    setShowForm(false);
    setShowSequence(false);
    setShowMenu(false);
    onActionCreated?.();
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowForm(true)}
          title="Add Follow-up Action"
          className={`p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ${className}`}
        >
          <Bell className="w-4 h-4" />
        </button>
        {showForm && (
          <FollowUpForm
            onClose={handleClose}
            entityType={entityType}
            entityId={entityId}
            entityLabel={entityLabel}
          />
        )}
      </>
    );
  }

  // Button variant — show dropdown if sequences available
  if (hasSequences) {
    return (
      <>
        <div className="relative flex">
          {/* Main action button */}
          <button
            onClick={() => setShowForm(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors ${className}`}
          >
            <Bell className="w-4 h-4 text-primary" />
            Add Follow-up
          </button>

          {/* Dropdown toggle */}
          <button
            onClick={() => setShowMenu(p => !p)}
            className="flex items-center px-2 py-2 rounded-r-lg text-sm bg-muted text-muted-foreground hover:bg-muted/80 border-l border-border transition-colors"
            title="Apply sequence"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 glass-card border border-border rounded-xl shadow-xl overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); setShowForm(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Bell className="w-4 h-4 text-primary" />
                  Single Action
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowSequence(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                >
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Apply Sequence
                </button>
              </div>
            </>
          )}
        </div>

        {showForm && (
          <FollowUpForm
            onClose={handleClose}
            entityType={entityType}
            entityId={entityId}
            entityLabel={entityLabel}
          />
        )}

        {showSequence && (
          <SequenceModal
            entityType={entityType}
            entityId={entityId}
            entityLabel={entityLabel}
            onClose={() => setShowSequence(false)}
            onApplied={handleClose}
          />
        )}
      </>
    );
  }

  // Simple button — no sequences available
  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors ${className}`}
      >
        <Bell className="w-4 h-4 text-primary" />
        Add Follow-up
      </button>
      {showForm && (
        <FollowUpForm
          onClose={handleClose}
          entityType={entityType}
          entityId={entityId}
          entityLabel={entityLabel}
        />
      )}
    </>
  );
}
