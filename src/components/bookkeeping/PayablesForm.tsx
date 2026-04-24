import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { CreatePayableInput } from '@/types/bookkeeping';

interface PayablesFormProps {
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function PayablesForm({ onClose, onSuccess, userId }: PayablesFormProps) {
  const { vendors, expenses, addPayable } = useCRM();
  const { register, handleSubmit, formState: { errors }, watch } = useForm<CreatePayableInput>({
    defaultValues: {
      vendor_id: '',
      amount: 0,
      due_date: '',
      payment_date: null,
      linked_expense_id: null,
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedVendorId = watch('vendor_id');
  const vendorExpenses = selectedVendorId
    ? expenses.filter(exp => exp.vendor_id === selectedVendorId)
    : [];

  const onSubmit = async (data: CreatePayableInput) => {
    try {
      setError(null);
      setLoading(true);

      if (!data.vendor_id) {
        throw new Error('Vendor is required');
      }
      if (data.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!data.due_date) {
        throw new Error('Due date is required');
      }

      await addPayable(
        {
          ...data,
          vendor_id: data.vendor_id,
          amount: Number(data.amount),
        },
        userId
      );

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to create payable');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Create Payable</h2>
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

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Vendor *
            </label>
            <select
              {...register('vendor_id', { required: true })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a vendor</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            {errors.vendor_id && (
              <p className="text-xs text-red-500 mt-1">Vendor is required</p>
            )}
          </div>

          {/* Linked Expense */}
          {vendorExpenses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Link to Expense (Optional)
              </label>
              <select
                {...register('linked_expense_id')}
                className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">None</option>
                {vendorExpenses.map(exp => (
                  <option key={exp.expense_id} value={exp.expense_id}>
                    {exp.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount (PKR) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('amount', { required: true, min: 0.01 })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">Amount must be greater than 0</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Due Date *
            </label>
            <input
              type="date"
              {...register('due_date', { required: true })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.due_date && (
              <p className="text-xs text-red-500 mt-1">Due date is required</p>
            )}
          </div>

          {/* Invoice Reference */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Invoice Reference (Optional)
            </label>
            <input
              type="text"
              {...register('invoice_reference')}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., VENDOR-INV-001"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Method (Optional)
            </label>
            <select
              {...register('payment_method')}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select method</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Online Payment">Online Payment</option>
            </select>
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
              {loading ? 'Creating...' : 'Create Payable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
