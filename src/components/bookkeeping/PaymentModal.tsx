import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice, CreatePaymentInput } from '@/types/bookkeeping';

interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
  const { user } = useAuth();
  const { recordPayment } = useCRM();
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<CreatePaymentInput>({
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      amount: invoice.invoice_amount - invoice.amount_paid,
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const watchAmount = watch('amount');
  const remainingAmount = invoice.invoice_amount - invoice.amount_paid;

  const onSubmit = async (data: CreatePaymentInput) => {
    try {
      setLoading(true);
      setError('');

      await recordPayment({
        ...data,
        invoice_id: invoice.invoice_id,
      }, user?.id ?? '');

      reset();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Record Payment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Invoice Summary */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Invoice #</p>
              <p className="font-medium text-foreground">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Amount</p>
              <p className="font-medium text-foreground">
                PKR {new Intl.NumberFormat('en-PK').format(invoice.invoice_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Already Paid</p>
              <p className="font-medium text-green-600">
                PKR {new Intl.NumberFormat('en-PK').format(invoice.amount_paid)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-medium text-orange-600">
                PKR {new Intl.NumberFormat('en-PK').format(remainingAmount)}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Amount (PKR) *</label>
            <input
              type="number"
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 1, message: 'Amount must be greater than 0' },
                max: {
                  value: remainingAmount,
                  message: `Cannot exceed remaining amount (PKR ${remainingAmount})`,
                },
              })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            {watchAmount && (
              <p className="text-xs text-muted-foreground mt-2">
                Remaining after: PKR {new Intl.NumberFormat('en-PK').format(Math.max(0, remainingAmount - watchAmount))}
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Date *</label>
            <input
              type="date"
              {...register('payment_date', { required: 'Payment date is required' })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.payment_date && <p className="text-xs text-destructive mt-1">{errors.payment_date.message}</p>}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
            <select
              {...register('payment_method')}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select method...</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Online Payment">Online Payment</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea
              {...register('notes')}
              placeholder="Reference number, check number, etc..."
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
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
