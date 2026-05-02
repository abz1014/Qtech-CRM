import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreateInvoiceInput } from '@/types/bookkeeping';

interface InvoiceFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoiceForm({ onClose, onSuccess }: InvoiceFormProps) {
  const { user } = useAuth();
  const { addInvoice, clients, orders, rfqs, getNextInvoiceNumber } = useCRM();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateInvoiceInput>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (data: CreateInvoiceInput) => {
    try {
      setLoading(true);
      setError('');

      // Generate invoice number if not provided
      let invoiceNumber = data.invoice_number;
      if (!invoiceNumber) {
        invoiceNumber = await getNextInvoiceNumber();
      }

      await addInvoice({
        ...data,
        invoice_number: invoiceNumber,
        order_id: data.order_id || null,
        rfq_id: data.rfq_id || null,
      }, user?.id ?? '');

      reset();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Create Invoice</h2>
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
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Client *</label>
            <select
              {...register('client_id', { required: 'Client is required' })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
          </div>

          {/* Order (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Order (Optional)</label>
            <select
              {...register('order_id')}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select an order...</option>
              {orders.map(o => {
                const client = clients.find(c => c.id === o.client_id);
                return (
                  <option key={o.id} value={o.id}>
                    Order #{o.id.slice(0, 8)} - {client?.company_name ?? 'Unknown Client'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* RFQ (Optional) */}
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

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Invoice Amount (PKR) *</label>
            <input
              type="number"
              {...register('invoice_amount', {
                required: 'Amount is required',
                valueAsNumber: true,
                min: { value: 1, message: 'Amount must be greater than 0' },
              })}
              placeholder="100000"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.invoice_amount && <p className="text-xs text-destructive mt-1">{errors.invoice_amount.message}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Issued Date *</label>
              <input
                type="date"
                {...register('issued_date', { required: 'Issued date is required' })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.issued_date && <p className="text-xs text-destructive mt-1">{errors.issued_date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Due Date *</label>
              <input
                type="date"
                {...register('due_date', { required: 'Due date is required' })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.due_date && <p className="text-xs text-destructive mt-1">{errors.due_date.message}</p>}
            </div>
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
              placeholder="Add any additional notes..."
              rows={3}
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
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
