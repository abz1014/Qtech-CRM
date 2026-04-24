import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';

interface FollowUpFormProps {
  onClose: () => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
}

export function FollowUpForm({ onClose, defaultEntityType, defaultEntityId }: FollowUpFormProps) {
  const { createFollowUp } = useCRM();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    action_type: 'rfq_followup' as const,
    entity_type: defaultEntityType || 'rfq',
    entity_id: defaultEntityId || '',
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date || !form.entity_id) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFollowUp({
        action_type: form.action_type,
        entity_type: form.entity_type,
        entity_id: form.entity_id,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date,
        priority: form.priority,
        assigned_to: user?.id,
      });
      onClose();
    } catch (error) {
      alert('Error creating follow-up: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Create Follow-Up Action</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Action Type</label>
            <select
              value={form.action_type}
              onChange={(e) => setForm(prev => ({ ...prev, action_type: e.target.value as any }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="rfq_followup">RFQ Follow-up</option>
              <option value="supplier_response">Supplier Response</option>
              <option value="overdue_invoice">Overdue Invoice</option>
              <option value="order_status">Order Status</option>
            </select>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Entity Type</label>
            <select
              value={form.entity_type}
              onChange={(e) => setForm(prev => ({ ...prev, entity_type: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="rfq">RFQ</option>
              <option value="order">Order</option>
              <option value="invoice">Invoice</option>
              <option value="supplier_inquiry">Supplier Inquiry</option>
            </select>
          </div>

          {/* Entity ID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Entity ID (UUID)</label>
            <input
              type="text"
              value={form.entity_id}
              onChange={(e) => setForm(prev => ({ ...prev, entity_id: e.target.value }))}
              placeholder="Paste the ID or leave blank"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: You can copy the ID from the URL when viewing the entity
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Follow up with supplier on quote"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description (Optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add any details or notes..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              rows={3}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
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
