import { Navigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR } from '@/lib/format';
import { Users, ShoppingCart, Wrench, Target, TrendingUp, ArrowRight, FileText, CheckCircle, BarChart3, Send, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { clients, orders, prospects, rfqs, getClientName, getVendorName, getRFQMetrics } = useCRM();
  const { user, isAdmin, isSales } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin && !isSales) return <Navigate to="/" replace />;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const today = now.toISOString().split('T')[0];
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

      {/* Welcome */}
      <div>
        <p className="text-muted-foreground text-sm font-medium">Welcome back 👋</p>
        <h2 className="text-3xl font-bold text-foreground mt-0.5 tracking-tight">{user?.name}</h2>
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
