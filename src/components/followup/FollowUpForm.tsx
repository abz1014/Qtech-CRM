import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { X, Link2 } from 'lucide-react';

export type EntityType = 'rfq' | 'order' | 'client' | 'prospect' | 'vendor';

interface FollowUpFormProps {
  onClose: () => void;
  // When opened from an entity page — pre-linked, no selection needed
  entityType?: EntityType;
  entityId?: string;
  entityLabel?: string; // human-readable name shown in the form
}

const ACTION_TYPES_BY_ENTITY: Record<EntityType, { value: string; label: string }[]> = {
  rfq: [
    { value: 'rfq_followup', label: '📋 Client Follow-up on RFQ' },
    { value: 'supplier_response', label: '📬 Supplier Response Follow-up' },
    { value: 'custom', label: '✏️ Custom Action' },
  ],
  order: [
    { value: 'order_status', label: '📦 Order Status Check' },
    { value: 'supplier_response', label: '📬 Vendor Delivery Follow-up' },
    { value: 'custom', label: '✏️ Custom Action' },
  ],
  client: [
    { value: 'rfq_followup', label: '📋 Client Engagement' },
    { value: 'overdue_invoice', label: '💰 Payment Follow-up' },
    { value: 'custom', label: '✏️ Custom Action' },
  ],
  prospect: [
    { value: 'rfq_followup', label: '📞 Outreach Call' },
    { value: 'custom', label: '✏️ Custom Action' },
  ],
  vendor: [
    { value: 'supplier_response', label: '📬 Supplier Follow-up' },
    { value: 'custom', label: '✏️ Custom Action' },
  ],
};

const DEFAULT_TITLES: Record<string, string> = {
  rfq_followup: 'Follow up with client on quote',
  supplier_response: 'Follow up with supplier on response',
  overdue_invoice: 'Follow up on outstanding payment',
  order_status: 'Check order/delivery status',
  custom: '',
};

const QUICK_DUE_DATES = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '2 Days', days: 2 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
];

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function FollowUpForm({ onClose, entityType, entityId, entityLabel }: FollowUpFormProps) {
  const { createFollowUp } = useCRM();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedEntityType: EntityType = entityType || 'rfq';
  const actionTypes = ACTION_TYPES_BY_ENTITY[resolvedEntityType];

  const [form, setForm] = useState({
    action_type: actionTypes[0].value,
    title: DEFAULT_TITLES[actionTypes[0].value] || '',
    description: '',
    due_date: addDays(2),
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  const handleActionTypeChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      action_type: value,
      title: DEFAULT_TITLES[value] || prev.title,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) {
      alert('Please fill in Title and Due Date');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFollowUp({
        action_type: form.action_type,
        entity_type: resolvedEntityType,
        entity_id: entityId || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date,
        priority: form.priority,
        assigned_to: user?.id,
      });
      onClose();
    } catch (error) {
      alert('Error creating action: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Follow-up Action</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Linked entity badge — shown when pre-linked from entity page */}
        {entityLabel && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg mb-4">
            <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground capitalize">{resolvedEntityType}</p>
              <p className="text-sm font-medium text-primary">{entityLabel}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Action Type</label>
            <select
              value={form.action_type}
              onChange={e => handleActionTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {actionTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes <span className="text-muted-foreground">(Optional)</span></label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add any context or details..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              rows={2}
            />
          </div>

          {/* Due Date with quick-select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {QUICK_DUE_DATES.map(q => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, due_date: addDays(q.days) }))}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    form.due_date === addDays(q.days)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value || addDays(2) }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    form.priority === p
                      ? p === 'high'
                        ? 'bg-red-500 text-white'
                        : p === 'medium'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-blue-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
