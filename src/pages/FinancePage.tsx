import { useCRM } from '@/contexts/CRMContext';
import { formatPKR, formatDate } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

export default function FinancePage() {
  const { orders, getClientName } = useCRM();
  const navigate = useNavigate();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // ── Revenue & profit from all orders ──────────────────────────────────────
  const allRevenue = orders.reduce((s, o) => s + (o.order_value || 0), 0);
  const allCost    = orders.reduce((s, o) => s + (o.cost_value  || 0), 0);
  const allProfit  = allRevenue - allCost;
  const allMargin  = allRevenue > 0 ? ((allProfit / allRevenue) * 100).toFixed(1) : '0';

  // ── This month ────────────────────────────────────────────────────────────
  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.confirmed_date || o.rfq_id || '');
    // use confirmed_date as proxy for when the deal was struck
    if (!o.confirmed_date) return false;
    const d2 = new Date(o.confirmed_date);
    return d2.getMonth() === currentMonth && d2.getFullYear() === currentYear;
  });
  const monthRevenue = thisMonthOrders.reduce((s, o) => s + (o.order_value || 0), 0);
  const monthCost    = thisMonthOrders.reduce((s, o) => s + (o.cost_value  || 0), 0);
  const monthProfit  = monthRevenue - monthCost;

  // ── Payment pipeline ─────────────────────────────────────────────────────
  // Orders that are delivered but payment not yet received
  const pendingPayment = orders.filter(o =>
    o.status === 'delivered' || o.status === 'in_transit' || o.status === 'procurement'
  );

  const overduePayments = orders.filter(o => {
    if (o.status === 'payment_received') return false;
    const due = (o as any).payment_due_date;
    if (!due) return false;
    return due < todayStr;
  });

  const pendingValue  = pendingPayment.reduce((s, o) => s + (o.order_value || 0), 0);
  const overdueValue  = overduePayments.reduce((s, o) => s + (o.order_value || 0), 0);

  // ── Monthly breakdown (last 6 months) ────────────────────────────────────
  const months: { label: string; revenue: number; cost: number; profit: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const mo = orders.filter(o => {
      if (!o.confirmed_date) return false;
      const od = new Date(o.confirmed_date);
      return od.getMonth() === m && od.getFullYear() === y;
    });
    months.push({
      label,
      revenue: mo.reduce((s, o) => s + (o.order_value || 0), 0),
      cost:    mo.reduce((s, o) => s + (o.cost_value  || 0), 0),
      profit:  mo.reduce((s, o) => s + ((o.order_value || 0) - (o.cost_value || 0)), 0),
    });
  }

  const maxRevenue = Math.max(...months.map(m => m.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance</h1>
        <p className="text-muted-foreground mt-1">Revenue, profit and payment tracking — all from your orders</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-foreground">{formatPKR(allRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">all orders</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Profit</p>
          <p className={`text-2xl font-bold ${allProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPKR(allProfit)}</p>
          <p className="text-xs text-muted-foreground mt-1">{allMargin}% margin</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">This Month Revenue</p>
          <p className="text-2xl font-bold text-foreground">{formatPKR(monthRevenue)}</p>
          <p className={`text-xs mt-1 ${monthProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPKR(monthProfit)} profit
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Payments Due</p>
          <p className="text-2xl font-bold text-warning">{formatPKR(pendingValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingPayment.length} orders in pipeline</p>
        </div>
      </div>

      {/* Overdue alert */}
      {overduePayments.length > 0 && (
        <div className="glass-card p-4 border border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Overdue Payments — {overduePayments.length} order{overduePayments.length > 1 ? 's' : ''} ({formatPKR(overdueValue)})</h2>
          </div>
          <div className="space-y-2">
            {overduePayments.map(o => {
              const daysOverdue = Math.floor((today.getTime() - new Date((o as any).payment_due_date).getTime()) / 86400000);
              return (
                <div key={o.id}
                  className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{getClientName(o.client_id)}</p>
                    <p className="text-xs text-muted-foreground">{o.product_type} · Due {formatDate((o as any).payment_due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{formatPKR(o.order_value)}</p>
                    <p className="text-xs text-destructive">{daysOverdue}d overdue</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment Pipeline */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" /> Payment Pipeline
          </h2>
          <span className="text-xs text-muted-foreground">{pendingPayment.length} orders awaiting payment</span>
        </div>

        {pendingPayment.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="w-4 h-4" /> All payments collected — great work!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Client</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Product</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Order Value</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Payment Due</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayment.map(o => {
                  const paymentDue = (o as any).payment_due_date;
                  const isOverdue = paymentDue && paymentDue < todayStr;
                  const statusLabel: Record<string, string> = {
                    po_received: 'PO Received',
                    procurement: 'Procurement',
                    in_transit: 'In Transit',
                    delivered: 'Delivered',
                  };
                  return (
                    <tr key={o.id}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${o.id}`)}>
                      <td className="py-2.5 px-3 font-medium">{getClientName(o.client_id)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{o.product_type}</td>
                      <td className="py-2.5 px-3">
                        <span className="status-badge bg-warning/15 text-warning">{statusLabel[o.status] || o.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">{formatPKR(o.order_value)}</td>
                      <td className={`py-2.5 px-3 text-right text-xs font-medium ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {paymentDue ? formatDate(paymentDue) : '—'}
                        {isOverdue && ' ⚠'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly bar chart */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Last 6 Months
        </h2>
        <div className="space-y-3">
          {months.map(m => (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="w-12 font-medium text-foreground">{m.label}</span>
                <span>{formatPKR(m.revenue)}</span>
                <span className={m.profit >= 0 ? 'text-success' : 'text-destructive'}>
                  {m.profit >= 0 ? '+' : ''}{formatPKR(m.profit)} profit
                </span>
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                {/* Cost bar */}
                <div
                  className="bg-warning/60 rounded-l-full transition-all"
                  style={{ width: `${(m.cost / maxRevenue) * 100}%` }}
                />
                {/* Profit bar */}
                <div
                  className={`rounded-r-full transition-all ${m.profit >= 0 ? 'bg-success/70' : 'bg-destructive/70'}`}
                  style={{ width: `${(Math.abs(m.profit) / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-warning/60 inline-block" /> Cost</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-success/70 inline-block" /> Profit</span>
        </div>
      </div>

      {/* Recently paid */}
      {(() => {
        const paid = orders.filter(o => o.status === 'payment_received').slice(0, 5);
        if (paid.length === 0) return null;
        return (
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" /> Recently Collected
            </h2>
            <div className="space-y-2">
              {paid.map(o => (
                <div key={o.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{getClientName(o.client_id)}</p>
                    <p className="text-xs text-muted-foreground">{o.product_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-success">{formatPKR(o.order_value)}</p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
