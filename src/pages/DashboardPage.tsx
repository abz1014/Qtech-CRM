import { Navigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR } from '@/lib/format';
import { Users, ShoppingCart, Wrench, Target, TrendingUp, ArrowRight, FileText, CheckCircle, BarChart3, Send, MessageSquare, AlertTriangle, Clock, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { clients, orders, prospects, rfqs, followUpActions, getClientName, getVendorName, getRFQMetrics, getUserName, loading } = useCRM();
  const { user, isAdmin, isSales } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin && !isSales) return <Navigate to="/" replace />;

  // ── All hooks MUST be before any early return ────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  // Team-wide pending actions — everyone sees everything
  const myActions = followUpActions.filter(a => a.status === 'pending');
  const overdueActions  = myActions.filter(a => a.due_date < today);
  const todayActions    = myActions.filter(a => a.due_date === today);

  const briefingGroups = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    myActions.forEach(a => {
      const label =
        a.action_type === 'supplier_response' ? 'supplier follow-ups' :
        a.action_type === 'rfq_followup'      ? 'client follow-ups' :
        a.action_type === 'overdue_invoice'   ? 'payment follow-ups' :
        a.action_type === 'order_status'      ? 'order checks' : 'tasks';
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([label, count]) => ({ label, count }));
  }, [myActions]);

  if (loading) return <DashboardSkeleton />;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const rfqMetrics = getRFQMetrics(today);

  const totalClients = clients.length;
  const totalOrders = orders.length;
  const installationOrders = orders.filter(o => o.status === 'in_transit' || o.status === 'procurement').length;
  const activeProspects = prospects.filter(p => !p.converted_client_id).length;

  // Monthly revenue: confirmed + completed orders
  const monthlyRevenue = orders
    .filter(o => (o.status === 'payment_received' || o.status === 'delivered') && o.confirmed_date)
    .filter(o => {
      const d = new Date(o.confirmed_date!);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((s, o) => s + o.order_value, 0);

  const confirmedThisMonth = orders.filter(o => {
    if (o.status !== 'po_received') return false;
    if (!o.confirmed_date) return false;
    const d = new Date(o.confirmed_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const rfqsThisMonth = rfqs.filter(r => {
    const d = new Date(r.rfq_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const totalRevenue = orders.reduce((s, o) => s + o.order_value, 0);
  const totalProfit = orders.reduce((s, o) => s + (o.order_value - (o.cost_value || 0)), 0);

  // Top clients by RFQ count
  const rfqCountByClient: Record<string, number> = {};
  rfqs.forEach(r => { rfqCountByClient[r.client_id] = (rfqCountByClient[r.client_id] || 0) + 1; });
  const topRFQClients = Object.entries(rfqCountByClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([clientId, count]) => ({ name: getClientName(clientId), count }));

  const rfqKpis = [
    { label: 'RFQs Received Today', value: rfqMetrics.receivedToday, icon: FileText, color: 'text-primary' },
    { label: 'Not Floated', value: rfqMetrics.notFloated, icon: Target, color: 'text-warning' },
    { label: 'Floated to Suppliers', value: rfqMetrics.floated, icon: Send, color: 'text-info' },
    { label: 'Got Responses', value: rfqMetrics.responded, icon: MessageSquare, color: 'text-success' },
  ];

  const kpis = [
    { label: 'Total Clients', value: totalClients, icon: Users, color: 'text-primary' },
    { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-info' },
    { label: 'In Procurement/Transit', value: installationOrders, icon: Wrench, color: 'text-warning' },
    { label: 'Active Prospects', value: activeProspects, icon: Target, color: 'text-hot' },
  ];

  const monthlyKpis = [
    { label: 'Monthly Revenue', value: formatPKR(monthlyRevenue), icon: TrendingUp, color: 'text-primary' },
    { label: 'POs Received This Month', value: confirmedThisMonth, icon: CheckCircle, color: 'text-info' },
    { label: 'RFQs This Month', value: rfqsThisMonth, icon: FileText, color: 'text-warning' },
  ];

  const recentOrders = [...orders].reverse().slice(0, 5);

  const statusColors: Record<string, string> = {
    po_received: 'bg-info/15 text-info',
    procurement: 'bg-warning/15 text-warning',
    in_transit: 'bg-primary/15 text-primary',
    delivered: 'bg-success/15 text-success',
    payment_received: 'bg-emerald-500/15 text-emerald-600',
  };
  const statusLabels: Record<string, string> = {
    po_received: 'PO Received',
    procurement: 'Procurement',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    payment_received: 'Payment Received',
  };

  // Icon background colours per kpi
  const iconBg: Record<string, string> = {
    'text-primary': 'bg-primary/15 text-primary',
    'text-warning': 'bg-warning/15 text-warning',
    'text-info':    'bg-info/15 text-info',
    'text-success': 'bg-success/15 text-success',
    'text-hot':     'bg-hot/15 text-hot',
  };

  return (
    <div className="space-y-8">

      {/* ════ OVERDUE ALERT — bold, glowing, animated ════ */}
      {overdueActions.length > 0 && (
        <div
          className="alert-overdue relative overflow-hidden rounded-2xl p-5 cursor-pointer group"
          onClick={() => navigate('/actions')}
        >
          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 opacity-30 pointer-events-none alert-shimmer" />

          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              {/* Big glowing icon */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-red-500 blur-xl opacity-50 animate-pulse" />
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(0 80% 55%), hsl(0 75% 42%))', boxShadow: '0 4px 16px hsl(0 80% 45% / 0.5)' }}>
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md text-white"
                    style={{ background: 'hsl(0 75% 50%)' }}>
                    URGENT
                  </span>
                  <span className="text-2xl font-extrabold text-white tracking-tight">
                    {overdueActions.length}
                  </span>
                  <span className="font-bold text-white text-base">
                    Overdue Action{overdueActions.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {overdueActions.slice(0, 2).map(a => (
                    <span key={a.id}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md text-white/90 truncate max-w-[280px]"
                      style={{ background: 'hsl(0 60% 30% / 0.6)', border: '1px solid hsl(0 60% 45% / 0.4)' }}>
                      {a.title}
                    </span>
                  ))}
                  {overdueActions.length > 2 && (
                    <span className="text-[11px] font-semibold text-white/80">
                      +{overdueActions.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-white hover:scale-105 active:scale-95 transition-transform shadow-lg">
              Resolve Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ════ TODAY ALERT — amber, prominent ════ */}
      {overdueActions.length === 0 && todayActions.length > 0 && (
        <div
          className="alert-today relative overflow-hidden rounded-2xl p-5 cursor-pointer group"
          onClick={() => navigate('/actions')}
        >
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-amber-400 blur-xl opacity-40" />
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(40 95% 55%), hsl(30 90% 48%))', boxShadow: '0 4px 16px hsl(35 90% 45% / 0.5)' }}>
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md text-white"
                    style={{ background: 'hsl(35 90% 45%)' }}>
                    TODAY
                  </span>
                  <span className="text-2xl font-extrabold text-white tracking-tight">
                    {todayActions.length}
                  </span>
                  <span className="font-bold text-white text-base">
                    Action{todayActions.length > 1 ? 's' : ''} Due
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {todayActions.slice(0, 2).map(a => (
                    <span key={a.id}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md text-white/90 truncate max-w-[280px]"
                      style={{ background: 'hsl(30 70% 25% / 0.6)', border: '1px solid hsl(35 60% 45% / 0.4)' }}>
                      {a.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-amber-700 bg-white hover:scale-105 active:scale-95 transition-transform shadow-lg">
              View Actions <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ════ WELCOME + DAILY BRIEFING ════ */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-muted-foreground text-sm font-medium">Welcome back 👋</p>
          <h2 className="text-3xl font-bold text-foreground mt-0.5 tracking-tight">{user?.name}</h2>
        </div>

        {briefingGroups.length > 0 && (
          <div
            className="relative overflow-hidden rounded-2xl px-5 py-3 cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.06))',
              border: '1px solid hsl(var(--primary) / 0.35)',
              boxShadow: '0 4px 24px hsl(var(--primary) / 0.15)',
            }}
            onClick={() => navigate('/actions')}
          >
            <div className="flex items-center gap-3 relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(158 60% 30%))', boxShadow: '0 0 16px hsl(var(--primary) / 0.5)' }}>
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  Today's Briefing
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {briefingGroups.map(g => `${g.count} ${g.label}`).join(' · ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RFQ Metrics */}
      <div>
        <p className="section-title mb-3">Today's RFQ Pipeline</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rfqKpis.map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">{kpi.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg[kpi.color] || 'bg-muted text-muted-foreground'}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-4xl font-extrabold text-foreground tracking-tight">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overall KPIs */}
      <div>
        <p className="section-title mb-3">Overall</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">{kpi.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg[kpi.color] || 'bg-muted text-muted-foreground'}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-4xl font-extrabold text-foreground tracking-tight">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly KPIs */}
      <div>
        <p className="section-title mb-3">This Month</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthlyKpis.map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">{kpi.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg[kpi.color] || 'bg-muted text-muted-foreground'}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue + Top RFQ Clients - Admin Only */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Order Value</p>
                <p className="text-3xl font-bold text-primary mt-1">{formatPKR(totalRevenue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary/40" />
            </div>
          </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Clients by RFQs</h3>
          {topRFQClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RFQs yet</p>
          ) : (
            <div className="space-y-2">
              {topRFQClients.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">{c.count} RFQs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="glass-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
          <button onClick={() => navigate('/orders')} className="text-sm text-primary flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Vendor</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Product</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Value</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="avatar-xs bg-primary/15 text-primary">
                        {getClientName(order.client_id).slice(0,2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{getClientName(order.client_id)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{getVendorName(order.vendor_id)}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{order.product_type}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{formatPKR(order.order_value)}</td>
                  <td className="px-5 py-3">
                    <span className={`status-badge ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
