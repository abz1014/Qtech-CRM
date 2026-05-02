import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreateExpenseInput, ExpenseCategory } from '@/types/bookkeeping';

interface ExpenseFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Salaries',
  'Office Expenses',
  'Travel',
  'Equipment',
  'Software Subscriptions',
  'Utilities',
  'Marketing',
  'Inventory/Procurement',
  'Misc',
];

export function ExpenseForm({ onClose, onSuccess }: ExpenseFormProps) {
  const { user } = useAuth();
  const { addExpense, vendors, rfqs, orders } = useCRM();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateExpenseInput>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (data: CreateExpenseInput) => {
    try {
      setLoading(true);
      setError('');

      await addExpense({
        ...data,
        vendor_id: data.vendor_id || null,
        rfq_id: data.rfq_id || null,
        order_id: data.order_id || null,
      }, user?.id ?? '');

      reset();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add Expense</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date *</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.date && <p className="text-xs text-destructive mt-1">{errors.date.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Category *</label>
            <select
              {...register('category', { required: 'Category is required' })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a category...</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description *</label>
            <input
              type="text"
              {...register('description', { required: 'Description is required' })}
              placeholder="e.g., Flight tickets, Office supplies..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Amount (PKR) *</label>
            <input
              type="number"
              {...register('amount', {
                required: 'Amount is required',
                valueAsNumber: true,
                min: { value: 1, message: 'Amount must be greater than 0' },
              })}
              placeholder="50000"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
          </div>

          {/* Vendor (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Vendor (Optional)</label>
            <select
              {...register('vendor_id')}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a vendor...</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* RFQ/Project (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">RFQ/Project (Optional)</label>
            <select
              {...register('rfq_id')}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select an RFQ...</option>
              {rfqs.map(r => (
                <option key={r.id} value={r.id}>{r.notes || r.company_name}</option>
              ))}
            </select>
          </div>

          {/* Order (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Order (Optional)</label>
            <select
              {...register('order_id')}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select an order...</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>Order #{o.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea
              {...register('notes')}
              placeholder="Add any additional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
