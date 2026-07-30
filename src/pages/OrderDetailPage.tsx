import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useClients } from '@/hooks/useClients';
import { useVendors } from '@/hooks/useVendors';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatPKR, formatDate } from '@/lib/format';
import { ArrowLeft, MapPin, Calendar, User, TrendingUp, FileText, Edit2, X, Calculator, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { OrderStatus, CommissioningStatus, ProductType } from '@/types/crm';
import { toast } from 'sonner';
import { useState } from 'react';
import { AddFollowUpButton } from '@/components/followup/AddFollowUpButton';
import { CostingEditor } from '@/components/costing/CostingEditor';

const statusFlow: OrderStatus[] = ['po_received', 'procurement', 'in_transit', 'delivered', 'payment_received'];

const statusLabels: Record<OrderStatus, string> = {
  po_received: 'PO Received',
  procurement: 'Procurement',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  payment_received: 'Payment Received',
};

const statusColors: Record<string, string> = {
  po_received: 'bg-info/15 text-info',
  procurement: 'bg-warning/15 text-warning',
  in_transit: 'bg-primary/15 text-primary',
  delivered: 'bg-success/15 text-success',
  payment_received: 'bg-emerald-500/15 text-emerald-600',
};

const commColors: Record<CommissioningStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, orderEngineers, rfqs, users, updateOrderStatus, addOrderEngineer, getNextOrderStatus, getClientName, getVendorName, getUserName, updateOrder, deleteOrder } = useCRM();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors();
  const { isAdmin, isSales } = useAuth();
  const confirm = useConfirm();

  const order = orders.find(o => o.id === id);
  const assignments = orderEngineers.filter(oe => oe.order_id === id);

  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCosting, setShowCosting] = useState(false);

  const [assignForm, setAssignForm] = useState({
    engineer_id: '', site_location: '', start_date: '', expected_completion: '',
  });
  const [editForm, setEditForm] = useState({
    client_id: '', vendor_id: '', sales_person_id: '',
    product_type: '' as ProductType | string, status: 'po_received' as OrderStatus,
    customer_po_number: '', customer_po_date: '',
    order_value: '', cost_value: '', order_gst_amount: '',
    invoice_number: '', invoice_date: '', delivery_date: '', payment_terms_days: '',
    notes: '',
  });

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Order not found</p>
        <button onClick={() => navigate('/orders')} className="text-primary mt-2 hover:underline">Back to Orders</button>
      </div>
    );
  }

  const currentIdx = statusFlow.indexOf(order.status);
  const nextStatus = getNextOrderStatus(order.status);
  const canAdvance = (isAdmin || isSales) && nextStatus !== null;

  const profit = order.order_value - order.cost_value;
  const profitPct = order.order_value > 0 ? ((profit / order.order_value) * 100).toFixed(1) : '—';

  const originRFQ = order.rfq_id ? rfqs.find(r => r.id === order.rfq_id) : null;

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    addOrderEngineer({
      order_id: order.id,
      engineer_id: assignForm.engineer_id,
      site_location: assignForm.site_location,
      start_date: assignForm.start_date,
      expected_completion: assignForm.expected_completion,
      commissioning_status: 'pending',
    });
    setShowAssign(false);
    setAssignForm({ engineer_id: '', site_location: '', start_date: '', expected_completion: '' });
  };

  const openEdit = () => {
    // Wait for the client/vendor dropdown data -- a controlled required
    // <select> with an empty options list renders blank and blocks Save.
    if (!order || clientsLoading || vendorsLoading) return;
    setEditForm({
      client_id: order.client_id || '',
      vendor_id: order.vendor_id || '',
      sales_person_id: order.sales_person_id || '',
      product_type: order.product_type || '',
      status: order.status,
      customer_po_number: order.customer_po_number || '',
      customer_po_date: order.customer_po_date || '',
      order_value: order.order_value?.toString() || '',
      cost_value: order.cost_value?.toString() || '',
      order_gst_amount: order.order_gst_amount != null ? String(order.order_gst_amount) : '',
      invoice_number: order.invoice_number || '',
      invoice_date: order.invoice_date || '',
      delivery_date: order.delivery_date || '',
      payment_terms_days: order.payment_terms_days != null ? String(order.payment_terms_days) : '',
      notes: order.notes || '',
    });
    setShowEdit(true);
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateOrder(id!, {
        client_id: editForm.client_id,
        vendor_id: editForm.vendor_id,
        product_type: editForm.product_type,
        status: editForm.status,
        customer_po_number: editForm.customer_po_number.trim() || null,
        customer_po_date: editForm.customer_po_date || null,
        order_value: Number(editForm.order_value) || 0,
        cost_value: Number(editForm.cost_value) || 0,
        order_gst_amount: editForm.order_gst_amount === '' ? null : Number(editForm.order_gst_amount),
        invoice_number: editForm.invoice_number.trim() || null,
        invoice_date: editForm.invoice_date || null,
        delivery_date: editForm.delivery_date || null,
        payment_terms_days: editForm.payment_terms_days === '' ? 0 : Number(editForm.payment_terms_days),
        notes: editForm.notes,
        // only reassign salesperson when one is chosen (FK is non-null)
        ...(editForm.sales_person_id ? { sales_person_id: editForm.sales_person_id } : {}),
      });
      toast.success('Order updated');
      setShowEdit(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order');
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!(await confirm({ title: 'Delete order?', message: `Delete this order for ${getClientName(order.client_id)} (${formatPKR(order.order_value)})? This also removes its follow-ups and cannot be undone.`, confirmLabel: 'Delete order' }))) return;
    try {
      await deleteOrder(order.id);
      toast.success('Order deleted');
      navigate('/orders');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  const engineers = users.filter(u => u.role === 'engineer');

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getClientName(order.client_id)}</h1>
          <p className="text-muted-foreground mt-1">{order.product_type} — {getVendorName(order.vendor_id)}</p>
        </div>
        <div className="flex items-center gap-2">
          <AddFollowUpButton
            entityType="order"
            entityId={order.id}
            entityLabel={`${getClientName(order.client_id)} — ${order.product_type}`}
          />
          {(isAdmin || isSales) && (
            <button onClick={openEdit} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDeleteOrder} className="flex items-center gap-1 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <span className={`status-badge text-sm ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>{statusLabels[order.status as OrderStatus] || order.status}</span>
        </div>
      </div>

      {/* Order Info + Financial */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="text-foreground">{getClientName(order.client_id)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span className="text-foreground">{getVendorName(order.vendor_id)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="text-foreground">{order.product_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sales Person</span><span className="text-foreground">{getUserName(order.sales_person_id)}</span></div>
            {order.confirmed_date && (
              <div className="flex justify-between"><span className="text-muted-foreground">PO Date</span><span className="text-foreground">{formatDate(order.confirmed_date)}</span></div>
            )}
            {order.customer_po_number && (
              <div className="flex justify-between"><span className="text-muted-foreground">PO Number</span><span className="text-foreground font-mono text-xs">{order.customer_po_number}</span></div>
            )}
            {order.payment_terms_days != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Terms</span><span className="text-foreground">{order.payment_terms_days} days</span></div>
            )}
            {order.delivery_date && (
              <div className="flex justify-between"><span className="text-muted-foreground">Delivered On</span><span className="text-foreground">{formatDate(order.delivery_date)}</span></div>
            )}
            {order.payment_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Due</span>
                <span className={`font-semibold ${new Date(order.payment_due_date) < new Date() && order.status !== 'payment_received' ? 'text-destructive' : 'text-foreground'}`}>
                  {formatDate(order.payment_due_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Financials</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Value</span><span className="text-foreground font-semibold">{formatPKR(order.order_value)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cost Value</span><span className="text-foreground">{formatPKR(order.cost_value)}</span></div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Profit</span>
              <span className={`font-semibold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPKR(profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margin</span>
              <span className={`font-semibold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{profitPct}%</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="text-sm text-muted-foreground">{order.notes || 'No notes'}</p>

          {originRFQ && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Source RFQ</p>
              <button
                onClick={() => navigate(`/rfqs/${originRFQ.id}`)}
                className="w-full px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                View RFQ Details →
              </button>
              <p className="text-xs text-muted-foreground mt-2">{originRFQ.company_name} • {formatPKR(originRFQ.estimated_value)}</p>
            </div>
          )}

          {canAdvance && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Advance Status</p>
              <button
                onClick={() => updateOrderStatus(order.id, nextStatus!)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Move to {statusLabels[nextStatus as OrderStatus] || nextStatus}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Order Progress</h3>
        <div className="flex items-center gap-1">
          {statusFlow.map((s, i) => {
            const isCompleted = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-center">
                  <div className={`flex-1 h-2 rounded-full transition-colors ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : isCompleted ? 'bg-primary/30 text-primary' : 'bg-border text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <span className={`text-xs text-center ${isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{statusLabels[s] || s}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Breakdown (admin + sales) */}
      {(isAdmin || isSales) && (
        <div className="glass-card p-5">
          <button onClick={() => setShowCosting(s => !s)} className="w-full flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-primary" /> Cost Breakdown — Cost to Complete this PO
            </h3>
            {showCosting ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showCosting && (
            <div className="mt-4">
              <CostingEditor
                parent={{ order_id: order.id }}
                applyLabel="Apply to order value"
                onApply={async (t) => {
                  await updateOrder(order.id, {
                    order_value: t.totalInclGst,
                    order_gst_amount: t.gst,
                    cost_value: t.totalCost,
                  });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Engineering Assignments */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Engineering Assignments</h3>
          {(isAdmin || isSales) && (
            <button onClick={() => setShowAssign(true)} className="text-sm text-primary hover:underline">+ Assign Engineer</button>
          )}
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engineers assigned yet</p>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">{getUserName(a.engineer_id)}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.site_location}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(a.start_date)} — {formatDate(a.expected_completion)}</span>
                  </div>
                </div>
                <span className={`status-badge capitalize ${commColors[a.commissioning_status]}`}>
                  {a.commissioning_status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-md p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Assign Engineer</h2>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Engineer</label>
                <select value={assignForm.engineer_id} onChange={e => setAssignForm(p => ({ ...p, engineer_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
                  <option value="">Select Engineer</option>
                  {engineers.map(eng => <option key={eng.id} value={eng.id}>{eng.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Site Location</label>
                <input value={assignForm.site_location} onChange={e => setAssignForm(p => ({ ...p, site_location: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
                <input type="date" value={assignForm.start_date} onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Expected Completion</label>
                <input type="date" value={assignForm.expected_completion} onChange={e => setAssignForm(p => ({ ...p, expected_completion: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Order</h2>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditOrder} className="space-y-3">
              {(() => {
                const fld = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
                const lb = 'block text-xs font-medium text-muted-foreground mb-1';
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lb}>Client</label>
                        <select value={editForm.client_id} onChange={e => setEditForm(p => ({ ...p, client_id: e.target.value }))} className={fld} required disabled={!isAdmin}>
                          <option value="">— Select client —</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lb}>Vendor</label>
                        <select value={editForm.vendor_id} onChange={e => setEditForm(p => ({ ...p, vendor_id: e.target.value }))} className={fld} disabled={!isAdmin}>
                          <option value="">— Select vendor —</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lb}>Salesperson</label>
                        <select value={editForm.sales_person_id} onChange={e => setEditForm(p => ({ ...p, sales_person_id: e.target.value }))} className={fld}>
                          <option value="">— Unassigned —</option>
                          {users.filter(u => u.role === 'admin' || u.role === 'sales').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lb}>Status</label>
                        <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as OrderStatus }))} className={fld}>
                          {statusFlow.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lb}>Customer PO #</label>
                        <input value={editForm.customer_po_number} onChange={e => setEditForm(p => ({ ...p, customer_po_number: e.target.value }))} className={fld} />
                      </div>
                      <div>
                        <label className={lb}>Customer PO date</label>
                        <input type="date" value={editForm.customer_po_date} onChange={e => setEditForm(p => ({ ...p, customer_po_date: e.target.value }))} className={fld} />
                      </div>
                      <div className="col-span-2">
                        <label className={lb}>Product / item</label>
                        <input value={editForm.product_type} onChange={e => setEditForm(p => ({ ...p, product_type: e.target.value }))} className={fld} required />
                      </div>
                      <div>
                        <label className={lb}>Order value (PKR)</label>
                        <input type="number" step="0.01" value={editForm.order_value} onChange={e => setEditForm(p => ({ ...p, order_value: e.target.value }))} className={fld} required />
                      </div>
                      <div>
                        <label className={lb}>Cost value (PKR)</label>
                        <input type="number" step="0.01" value={editForm.cost_value} onChange={e => setEditForm(p => ({ ...p, cost_value: e.target.value }))} className={fld} />
                      </div>
                      <div>
                        <label className={lb}>GST amount (PKR)</label>
                        <input type="number" step="0.01" value={editForm.order_gst_amount} onChange={e => setEditForm(p => ({ ...p, order_gst_amount: e.target.value }))} placeholder="blank = unknown" className={fld} />
                      </div>
                      <div>
                        <label className={lb}>Payment terms (days)</label>
                        <input type="number" value={editForm.payment_terms_days} onChange={e => setEditForm(p => ({ ...p, payment_terms_days: e.target.value }))} className={fld} />
                      </div>
                      <div>
                        <label className={lb}>Invoice #</label>
                        <input value={editForm.invoice_number} onChange={e => setEditForm(p => ({ ...p, invoice_number: e.target.value }))} className={fld} />
                      </div>
                      <div>
                        <label className={lb}>Invoice date</label>
                        <input type="date" value={editForm.invoice_date} onChange={e => setEditForm(p => ({ ...p, invoice_date: e.target.value }))} className={fld} />
                      </div>
                      <div>
                        <label className={lb}>Delivery date</label>
                        <input type="date" value={editForm.delivery_date} onChange={e => setEditForm(p => ({ ...p, delivery_date: e.target.value }))} className={fld} />
                      </div>
                    </div>
                    <div>
                      <label className={lb}>Notes</label>
                      <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className={`${fld} resize-none`} rows={2} />
                    </div>
                  </>
                );
              })()}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
