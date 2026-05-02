import { useState } from 'react';
import { Bell } from 'lucide-react';
import { FollowUpForm, EntityType } from './FollowUpForm';

interface AddFollowUpButtonProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  variant?: 'button' | 'icon'; // button = full text button, icon = small icon only
  className?: string;
}

export function AddFollowUpButton({
  entityType,
  entityId,
  entityLabel,
  variant = 'button',
  className = '',
}: AddFollowUpButtonProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {variant === 'button' ? (
        <button
          onClick={() => setShowForm(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors ${className}`}
        >
          <Bell className="w-4 h-4 text-primary" />
          Add Follow-up
        </button>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          title="Add Follow-up Action"
          className={`p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ${className}`}
        >
          <Bell className="w-4 h-4" />
        </button>
      )}

      {showForm && (
        <FollowUpForm
          onClose={() => setShowForm(false)}
          entityType={entityType}
          entityId={entityId}
          entityLabel={entityLabel}
        />
      )}
    </>
  );
}
