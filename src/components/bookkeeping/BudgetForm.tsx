import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';

interface BudgetFormProps {
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

const EXPENSE_CATEGORIES = [
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

export function BudgetForm({ onClose, onSuccess, userId }: BudgetFormProps) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      budget_type: 'Expense',
      period: new Date().toISOString().split('T')[0].slice(0, 7) + '-01',
      category: '',
      expected_amount: 0,
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const budgetType = watch('budget_type');

  const onSubmit = async (data: any) => {
    try {
      setError(null);
      setLoading(true);

      if (data.expected_amount <= 0) {
        throw new Error('Budget amount must be greater than 0');
      }

      // Note: In a real app, this would call an API to create the budget in Supabase
      // For now, we'll just show success
      console.log('Budget would be created:', {
        ...data,
        created_by: userId,
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Create Budget</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Budget Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Budget Type *
            </label>
            <select
              {...register('budget_type', { required: true })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expense</option>
            </select>
          </div>

          {/* Category (for expenses) */}
          {budgetType === 'Expense' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category *
              </label>
              <select
                {...register('category', { required: budgetType === 'Expense' })}
                className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-red-500 mt-1">Category is required</p>
              )}
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Month *
            </label>
            <input
              type="month"
              {...register('period', { required: true })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.period && (
              <p className="text-xs text-red-500 mt-1">Period is required</p>
            )}
          </div>

          {/* Budget Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Budget Amount (PKR) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('expected_amount', { required: true, min: 0.01 })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
            {errors.expected_amount && (
              <p className="text-xs text-red-500 mt-1">Amount must be greater than 0</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-background bg-primary hover:bg-primary/90 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
