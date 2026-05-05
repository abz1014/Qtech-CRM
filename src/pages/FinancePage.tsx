import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, AlertCircle, CheckCircle, ArrowRight, Download, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Date range helpers ────────────────────────────────────────────────────────

type Preset = 'this_month' | 'last_3' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'this_month':
      return { from: fmt(new Date(y, m, 1)), to: today };
    case 'last_3':
      return { from: fmt(new Date(y, m - 2, 1)), to: today };
    case 'this_year':
      return { from: fmt(new Date(y, 0, 1)), to: today };
    case 'last_year':
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    case 'all_time':
      return { from: '2000-01-01', to: today };
    default:
      return { from: fmt(new Date(y, m, 1)), to: today };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_3',     label: 'Last 3 Months' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'all_time',   label: 'All Time' },
  { key: 'custom',     label: 'Custom' },
];

// Build monthly buckets between two dates (max 24 months)
function buildMonthBuckets(from: string, to: string) {
  const start = new Date(from);
  const end   = new Date(to);
  const buckets: { label: string; year: number; month: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= endMonth && buckets.length < 24) {
    buckets.push({
      label: cur.toLocaleString('default', { month: 'short', year: '2-digit' }),
      year:  cur.getFullYear(),
      month: cur.getMonth(),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

export default function FinancePage() {
  const { orders, getClientName, getVendorName, getUserName } = useCRM();
  const navigate = useNavigate();

  // ── Date range state ────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  const range = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    if (preset === 'custom') return getPresetRange('this_month');
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── Filter orders by confirmed_date within range ────────────────────────────
  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = (o as any).customer_po_date || o.confirmed_date;
      if (!d) return false;
      return d >= range.from && d <= range.to;
    }),
  [orders, range]);

  // ── KPIs from filtered orders ───────────────────────────────────────────────
  const revenue = filteredOrders.reduce((s, o) => s + (o.order_value || 0), 0);
  const cost    = filteredOrders.reduce((s, o) => s + (o.cost_value  || 0), 0);
  const profit  = revenue - cost;
  const margin  = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
  const orderCount = filteredOrders.length;

  // ── Payment pipeline (not date-filtered — current outstanding regardless of when) ──
  const pendingPayment = orders.filter(o =>
    o.status === 'delivered' || o.status === 'in_transit' || o.status === 'procurement' || o.status === 'po_received'
  );
  const overduePayments = orders.filter(o => {
    if (o.status === 'payment_received') return false;
    const due = (o as any).payment_due_date;
    if (!due) return false;
    return due < todayStr;
  });
  const pendingValue = pendingPayment.reduce((s, o) => s + (o.order_value || 0), 0);
  const overdueValue = overduePayments.reduce((s, o) => s + (o.order_value || 0), 0);

  // ── Bar chart: month buckets within selected range ──────────────────────────
  const buckets = useMemo(() => buildMonthBuckets(range.from, range.to), [range]);
  const monthData = useMemo(() => buckets.map(b => {
    const mo = filteredOrders.filter(o => {
      const d = (o as any).customer_po_date || o.confirmed_date;
      if (!d) return false;
      const od = new Date(d);
      return od.getMonth() === b.month && od.getFullYear() === b.year;
    });
    return {
      label:   b.label,
      revenue: mo.reduce((s, o) => s + (o.order_value || 0), 0),
      cost:    mo.reduce((s, o) => s + (o.cost_value  || 0), 0),
      profit:  mo.reduce((s, o) => s + ((o.order_value || 0) - (o.cost_value || 0)), 0),
      count:   mo.length,
    };
  }), [buckets, filteredOrders]);
  const maxRevenue = Math.max(...monthData.map(m => m.revenue), 1);

  // ── Recently collected in range ─────────────────────────────────────────────
  const recentlyPaid = filteredOrders
    .filter(o => o.status === 'payment_received')
    .slice(0, 5);

  // ── CSV export (filtered) ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    const statusLabels: Record<string, string> = {
      po_received: 'PO Received', procurement: 'Procurement',
      in_transit: 'In Transit', delivered: 'Delivered', payment_received: 'Payment Received',
    };
    const headers = [
      'Client', 'Vendor', 'Product Type', 'Sales Person', 'Status',
      'Customer Approved Amount (PKR)', 'Our Cost (PKR)', 'Profit (PKR)', 'Margin %',
      'Customer PO Number', 'PO Date', 'Payment Terms (days)',
      'Delivery Date', 'Payment Due Date', 'Notes',
    ];
    const rows = filteredOrders.map(o => {
      const p = (o.order_value || 0) - (o.cost_value || 0);
      const mg = o.order_value > 0 ? ((p / o.order_value) * 100).toFixed(1) + '%' : '0%';
      return [
        getClientName(o.client_id), getVendorName(o.vendor_id),
        o.product_type, getUserName(o.sales_person_id),
        statusLabels[o.status] || o.status,
        o.order_value || 0, o.cost_value || 0, p, mg,
        (o as any).customer_po_number || '',
        (o as any).customer_po_date || o.confirmed_date || '',
        (o as any).payment_terms_days ?? '',
        (o as any).delivery_date || '',
        (o as any).payment_due_date || '',
        o.notes || '',
      ];
    });
    downloadCSV(generateCSV(headers, rows), `Finance_${range.from}_to_${range.to}.csv`);
  };

  const rangeLabel = preset === 'all_time'
    ? 'All Orders'
    : `${formatDate(range.from)} – ${formatDate(range.to)}`;

  return (
    <div className="space-y-6">

      {/* ── Header + Export ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-muted-foreground text-sm">{rangeLabel} · {orderCount} order{orderCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ── Date range selector ── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  preset === p.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2 flex-wrap">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground">Revenue</p>
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{formatPKR(revenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{orderCount} order{orderCount !== 1 ? 's' : ''}</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground">Profit</p>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${profit >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPKR(profit)}</p>
          <p className="text-xs text-muted-foreground mt-1">{margin}% margin</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground">Payments Pending</p>
            <div className="w-9 h-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{formatPKR(pendingValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingPayment.length} orders outstanding</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground">Overdue</p>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${overduePayments.length > 0 ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${overduePayments.length > 0 ? 'text-destructive' : 'text-success'}`}>
            {overduePayments.length > 0 ? formatPKR(overdueValue) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overduePayments.length > 0 ? `${overduePayments.length} overdue` : 'All clear'}
          </p>
        </div>
      </div>

      {/* ── Overdue alert ── */}
      {overduePayments.length > 0 && (
        <div className="glass-card p-4 border border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">
              {overduePayments.length} Overdue Payment{overduePayments.length > 1 ? 's' : ''} · {formatPKR(overdueValue)}
            </h2>
          </div>
          <div className="space-y-2">
            {overduePayments.map(o => {
              const daysOverdue = Math.floor((today.getTime() - new Date((o as any).payment_due_date).getTime()) / 86400000);
              return (
                <div key={o.id}
                  className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{getClientName(o.client_id)}</p>
                    <p className="text-xs text-muted-foreground">{o.product_type} · Due {formatDate((o as any).payment_due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{formatPKR(o.order_value)}</p>
                    <p className="text-xs text-destructive font-medium">{daysOverdue}d overdue</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bar chart ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Revenue by Month
          </h2>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        </div>

        {monthData.every(m => m.revenue === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-6">No orders in this period</p>
        ) : (
          <div className="space-y-3">
            {monthData.map(m => (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="w-14 font-semibold text-foreground">{m.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{formatPKR(m.revenue)}</span>
                    <span className={cn('font-semibold', m.profit >= 0 ? 'text-success' : 'text-destructive')}>
                      {m.profit >= 0 ? '+' : ''}{formatPKR(m.profit)}
                    </span>
                    {m.count > 0 && <span className="text-muted-foreground text-[10px]">{m.count} orders</span>}
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-muted flex gap-0.5">
                  <div className="bg-warning/60 rounded-l-full transition-all duration-500"
                    style={{ width: `${(m.cost / maxRevenue) * 100}%` }} />
                  <div className={cn('rounded-r-full transition-all duration-500', m.profit >= 0 ? 'bg-success/70' : 'bg-destructive/70')}
                    style={{ width: `${(Math.abs(m.profit) / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-warning/60 inline-block" /> Cost</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-success/70 inline-block" /> Profit</span>
        </div>
      </div>

      {/* ── Payment pipeline ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" /> Payment Pipeline
          </h2>
          <span className="text-xs text-muted-foreground">{pendingPayment.length} awaiting collection</span>
        </div>

        {pendingPayment.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success py-2">
            <CheckCircle className="w-4 h-4" /> All payments collected
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Client', 'Product', 'Status', 'Order Value', 'Payment Due'].map(h => (
                    <th key={h} className={`py-2 px-3 text-xs text-muted-foreground font-semibold ${h === 'Order Value' || h === 'Payment Due' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingPayment.map(o => {
                  const paymentDue = (o as any).payment_due_date;
                  const isOverdue = paymentDue && paymentDue < todayStr;
                  const statusLabel: Record<string, string> = {
                    po_received: 'PO Received', procurement: 'Procurement',
                    in_transit: 'In Transit', delivered: 'Delivered',
                  };
                  return (
                    <tr key={o.id}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${o.id}`)}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="avatar-xs bg-primary/15 text-primary">{getClientName(o.client_id).slice(0,2).toUpperCase()}</div>
                          <span className="font-medium text-foreground">{getClientName(o.client_id)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{o.product_type}</td>
                      <td className="py-3 px-3">
                        <span className="status-badge bg-warning/15 text-warning">{statusLabel[o.status] || o.status}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">{formatPKR(o.order_value)}</td>
                      <td className={cn('py-3 px-3 text-right text-xs font-semibold', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                        {paymentDue ? formatDate(paymentDue) : '—'}{isOverdue && ' ⚠'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recently collected (in range) ── */}
      {recentlyPaid.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" /> Collected in Period
          </h2>
          <div className="space-y-1">
            {recentlyPaid.map(o => (
              <div key={o.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/orders/${o.id}`)}>
                <div className="flex items-center gap-2.5">
                  <div className="avatar-xs bg-success/15 text-success">{getClientName(o.client_id).slice(0,2).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{getClientName(o.client_id)}</p>
                    <p className="text-xs text-muted-foreground">{o.product_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-success">{formatPKR(o.order_value)}</p>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
