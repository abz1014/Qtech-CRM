import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { Payable } from '@/types/bookkeeping';

interface PayablePaymentModalProps {
  payable: Payable;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function PayablePaymentModal({
  payable,
  onClose,
  onSuccess,
  userId,
}: PayablePaymentModalProps) {
  const { recordPayablePayment, getVendorName } = useCRM();
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      amount: payable.amount - payable.amount_paid,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amount = watch('amount');
  const remaining = payable.amount - payable.amount_paid;

  const onSubmit = async (data: any) => {
    try {
      setError(null);
      setLoading(true);

      if (data.amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }
      if (data.amount > remaining) {
        throw new Error(`Payment cannot exceed remaining amount of ${remaining}`);
      }

      await recordPayablePayment(
        {
          payable_id: payable.payable_id,
          amount: Number(data.amount),
          payment_date: data.payment_date,
          payment_method: data.payment_method,
        },
        userId
      );

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Record Payment</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Payable Summary */}
          <div className="bg-muted/50 p-4 rounded space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendor:</span>
              <span className="font-medium text-foreground">{getVendorName(payable.vendor_id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-medium text-foreground">
                {new Intl.NumberFormat('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                }).format(payable.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid:</span>
              <span className="font-medium text-foreground">
                {new Intl.NumberFormat('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                }).format(payable.amount_paid)}
              </span>
            </div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <span className="text-muted-foreground font-medium">Remaining:</span>
              <span className={`font-bold ${remaining === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {new Intl.NumberFormat('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                }).format(remaining)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Amount (PKR) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={remaining}
              {...register('amount', {
                required: true,
                min: 0.01,
                max: remaining,
              })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">
                Invalid amount. Must be between 0.01 and {remaining}
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Date *
            </label>
            <input
              type="date"
              {...register('payment_date', { required: true })}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.payment_date && (
              <p className="text-xs text-red-500 mt-1">Payment date is required</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Method
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
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
