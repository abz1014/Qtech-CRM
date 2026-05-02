import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { ArrowLeft, MapPin, Calendar, User, TrendingUp, FileText, Edit2, X, DollarSign, AlertCircle } from 'lucide-react';
import { OrderStatus, CommissioningStatus, ProductType } from '@/types/crm';
import { useState, useEffect } from 'react';
import { CostInputCard } from '@/components/orders/CostInputCard';
import { ProfitabilityBadge } from '@/components/orders/ProfitabilityBadge';
import { cn } from '@/lib/utils';

const statusFlow: OrderStatus[] = ['quotation', 'confirmed', 'procurement', 'installation', 'completed'];

const statusColors: Record<OrderStatus, string> = {
  quotation: 'bg-muted text-muted-foreground',
  confirmed: 'bg-info/15 text-info',
  procurement: 'bg-warning/15 text-warning',
  installation: 'bg-primary/15 text-primary',
  completed: 'bg-success/15 text-success',
};

const commColors: Record<CommissioningStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, clients, vendors, orderEngineers, rfqs, users, updateOrderStatus, addOrderEngineer, getNextOrderStatus, getClientName, getVendorName, getUserName, updateOrder, updateOrderCosts, getOrderWithProfitability } = useCRM();
  const { isAdmin, isSales } = useAuth();

  const order = orders.find(o => o.id === id);
  const assignments = orderEngineers.filter(oe => oe.order_id === id);

  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCostManager, setShowCostManager] = useState(false);
  const [orderWithCosts, setOrderWithCosts] = useState<any>(null);
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);

  const [assignForm, setAssignForm] = useState({
    engineer_id: '', site_location: '', start_date: '', expected_completion: '',
  });
  const [editForm, setEditForm] = useState({
    product_type: order?.product_type || '' as ProductType,
    order_value: order?.order_value?.toString() || '',
    cost_value: order?.cost_value?.toString() || '',
    notes: order?.notes || '',
  });

  // Load order with profitability/cost data
  useEffect(() => {
    if (id) {
      loadOrderCosts();
    }
  }, [id]);

  const loadOrderCosts = async () => {
    setIsLoadingCosts(true);
    const data = await getOrderWithProfitability(id!);
    setOrderWithCosts(data);
    setIsLoadingCosts(false);
  };

  const handleSaveCosts = async (_orderId: string, costs: any) => {
    setIsLoadingCosts(true);
    await updateOrderCosts(id!, costs);
    await loadOrderCosts();
    setIsLoadingCosts(false);
  };

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

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOrder(id!, {
      product_type: editForm.product_type,
      order_value: Number(editForm.order_value),
      cost_value: Number(editForm.cost_value),
      notes: editForm.notes,
    });
    setShowEdit(false);
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
          {isAdmin && (
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          <span className={`status-badge capitalize text-sm ${statusColors[order.status]}`}>{order.status}</span>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Confirmed</span><span className="text-foreground">{formatDate(order.confirmed_date)}</span></div>
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
                Move to {nextStatus}
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
                <span className={`text-xs capitalize ${isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Management & Profitability Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cost Summary */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost Management
            </h3>
            {(isAdmin || isSales) && (
              <button
                onClick={() => setShowCostManager(true)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Edit Costs
              </button>
            )}
          </div>

          {/* Cost Breakdown Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Material Cost</p>
              <p className="text-2xl font-bold text-foreground">Rs {(orderWithCosts?.material_cost || 0).toLocaleString('en-PK')}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2">Engineering Cost</p>
              <p className="text-2xl font-bold text-foreground">Rs {(orderWithCosts?.engineering_cost || 0).toLocaleString('en-PK')}</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">Logistics Cost</p>
              <p className="text-2xl font-bold text-foreground">Rs {(orderWithCosts?.logistics_cost || 0).toLocaleString('en-PK')}</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">Overhead Cost</p>
              <p className="text-2xl font-bold text-foreground">Rs {(orderWithCosts?.overhead_cost || 0).toLocaleString('en-PK')}</p>
            </div>
          </div>

          {/* Total Cost */}
          <div className="p-5 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30">
            <p className="text-sm font-semibold text-primary mb-2">Total Cost (Sum of all expenses)</p>
            <p className="text-3xl font-bold text-primary">Rs {(orderWithCosts?.total_cost || 0).toLocaleString('en-PK')}</p>
          </div>
        </div>

        {/* Profitability Analysis */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Profitability</h3>

          {orderWithCosts && (
            <ProfitabilityBadge
              profit={orderWithCosts.profit || 0}
              margin={orderWithCosts.profit_margin || 0}
              orderValue={orderWithCosts.order_value || order?.order_value || 0}
              size="lg"
            />
          )}

          {/* Margin Status Indicator */}
          {orderWithCosts && (
            <div className={cn(
              'p-4 rounded-lg border-l-4 flex items-start gap-3',
              orderWithCosts.profit_margin >= 20
                ? 'bg-green-500/10 border-l-green-500'
                : orderWithCosts.profit_margin >= 10
                  ? 'bg-yellow-500/10 border-l-yellow-500'
                  : 'bg-red-500/10 border-l-red-500'
            )}>
              <AlertCircle className={cn(
                'w-5 h-5 mt-0.5 flex-shrink-0',
                orderWithCosts.profit_margin >= 20
                  ? 'text-green-600 dark:text-green-400'
                  : orderWithCosts.profit_margin >= 10
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              )} />
              <p className={cn(
                'text-sm font-semibold',
                orderWithCosts.profit_margin >= 20
                  ? 'text-green-700 dark:text-green-300'
                  : orderWithCosts.profit_margin >= 10
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-red-700 dark:text-red-300'
              )}>
                {orderWithCosts.profit_margin >= 20
                  ? '✓ Excellent margin - Strong profitability'
                  : orderWithCosts.profit_margin >= 10
                    ? '⚠ Acceptable margin - Monitor performance'
                    : '✗ Low margin - Review cost structure'}
              </p>
            </div>
          )}
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 m-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Order</h2>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditOrder} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Product Type</label>
                <input value={editForm.product_type} onChange={e => setEditForm(p => ({ ...p, product_type: e.target.value as ProductType }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Order Value (PKR)</label>
                <input type="number" value={editForm.order_value} onChange={e => setEditForm(p => ({ ...p, order_value: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cost Value (PKR)</label>
                <input type="number" value={editForm.cost_value} onChange={e => setEditForm(p => ({ ...p, cost_value: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cost Manager Modal */}
      {showCostManager && orderWithCosts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/95">
              <h2 className="text-2xl font-bold text-foreground">
                Manage Costs - Order #{id?.slice(0, 8).toUpperCase()}
              </h2>
              <button onClick={() => setShowCostManager(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <CostInputCard
                orderId={id!}
                costs={{
                  material_cost: orderWithCosts.material_cost || 0,
                  engineering_cost: orderWithCosts.engineering_cost || 0,
                  logistics_cost: orderWithCosts.logistics_cost || 0,
                  overhead_cost: orderWithCosts.overhead_cost || 0,
                }}
                onSave={handleSaveCosts}
                isLoading={isLoadingCosts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
