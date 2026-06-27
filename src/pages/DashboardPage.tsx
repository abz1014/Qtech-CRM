import { Navigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR } from '@/lib/format';
import { Users, ShoppingCart, Wrench, Target, TrendingUp, ArrowRight, FileText, CheckCircle, Send, MessageSquare, AlertTriangle, Clock, Zap, Edit2, X } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const { clients, orders, prospects, rfqs, supplierInquiries, supplierQuotes, followUpActions, getClientName, getVendorName, getUserName, loading } = useCRM();
  const { user, isAdmin, isSales } = useAuth();
  const navigate = useNavigate();

  // ══════════════════════════════════════════════════════════════════════════
  // ALL HOOKS MUST BE ABOVE EVERY EARLY RETURN — React rules of hooks
  // ══════════════════════════════════════════════════════════════════════════

  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => now.toISOString().split('T')[0], [now]);
  const currentQuarter = useMemo(() => Math.floor(now.getMonth() / 3) + 1, [now]);
  const currentYear = useMemo(() => now.getFullYear(), [now]);
  const currentMonth = useMemo(() => now.getMonth(), [now]);

  // State
  const [quarterlyTarget, setQuarterlyTarget] = useState<number>(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [editingSelectedTarget, setEditingSelectedTarget] = useState(false);
  const [selectedTargetInput, setSelectedTargetInput] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const cq = Math.floor(new Date().getMonth() / 3) + 1;
    const cy = new Date().getFullYear();
    return `${cq === 1 ? cy - 1 : cy}-Q${cq === 1 ? 4 : cq - 1}`;
  });
  const [selectedQuarterTarget, setSelectedQuarterTarget] = useState<number>(0);

  // Actions derived data
  const myActions = useMemo(() => followUpActions.filter(a =>
    a.status === 'pending' && (!a.assigned_to || a.assigned_to === user?.id)
  ), [followUpActions, user?.id]);

  const overdueActions = useMemo(() => myActions.filter(a => a.due_date < today), [myActions, today]);
  const todayActions = useMemo(() => myActions.filter(a => a.due_date === today), [myActions, today]);

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

  // Available quarters for dropdown
  const availableQuarters = useMemo(() => {
    const quarters: { value: string; label: string }[] = [];
    let q = currentQuarter === 1 ? 4 : currentQuarter - 1;
    let y = currentQuarter === 1 ? currentYear - 1 : currentYear;
    for (let i = 0; i < 8; i++) {
      quarters.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` });
      q = q === 1 ? 4 : q - 1;
      if (q === 4) y--;
    }
    return quarters;
  }, [currentQuarter, currentYear]);

  // Selected quarter parsed values
  const { selectedYear, selectedQtr } = useMemo(() => {
    const [yStr, qStr] = selectedQuarter.split('-Q');
    return { selectedYear: parseInt(yStr), selectedQtr: parseInt(qStr) };
  }, [selectedQuarter]);

  // Pipeline metrics helper (stable via useCallback)
  const getPipelineMetrics = useCallback((startDate: string, endDate: string) => {
    const rangeRfqs = rfqs.filter(r => r.rfq_date >= startDate && r.rfq_date <= endDate);
    const received = rangeRfqs.length;
    const quoteReceived = rangeRfqs.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id)).length;
    const quotedToClient = rangeRfqs.filter(r => r.status === 'quoted' || r.status === 'converted').length;
    const poReceived = rangeRfqs.filter(r => r.status === 'converted').length;
    return { received, quoteReceived, quotedToClient, poReceived };
  }, [rfqs, supplierQuotes]);

  // Last 10 days metrics
  const { last10Metrics } = useMemo(() => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysStart = tenDaysAgo.toISOString().split('T')[0];
    const last10Rfqs = rfqs.filter(r => r.rfq_date >= tenDaysStart && r.rfq_date <= today);
    return {
      last10Metrics: {
        received: last10Rfqs.length,
        floated: last10Rfqs.filter(r => supplierInquiries.some(si => si.rfq_id === r.id)).length,
        notFloated: last10Rfqs.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted' && r.status !== 'lost').length,
        responded: last10Rfqs.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id)).length,
      }
    };
  }, [rfqs, supplierInquiries, supplierQuotes, today]);

  // Monthly pipeline
  const { monthStart, monthlyPipeline } = useMemo(() => {
    const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    return { monthStart: start, monthlyPipeline: getPipelineMetrics(start, today) };
  }, [currentYear, currentMonth, today, getPipelineMetrics]);

  // Quarterly pipeline
  const { quarterStart, quarterlyPipeline } = useMemo(() => {
    const startMonth = (currentQuarter - 1) * 3;
    const start = `${currentYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    return { quarterStart: start, quarterlyPipeline: getPipelineMetrics(start, today) };
  }, [currentQuarter, currentYear, today, getPipelineMetrics]);

  // Selected quarter pipeline
  const { selectedStart, selectedEnd, selectedQuarterPipeline } = useMemo(() => {
    const startMonth = (selectedQtr - 1) * 3;
    const start = `${selectedYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const end = `${selectedYear}-${String(startMonth + 3).padStart(2, '0')}-01`;
    const adjustedEnd = new Date(end);
    adjustedEnd.setDate(adjustedEnd.getDate() - 1);
    const adjustedEndStr = adjustedEnd.toISOString().split('T')[0];
    return { selectedStart: start, selectedEnd: adjustedEndStr, selectedQuarterPipeline: getPipelineMetrics(start, adjustedEndStr) };
  }, [selectedYear, selectedQtr, getPipelineMetrics]);

  // Get the best available date for an order
  const getOrderDate = useCallback((o: any): string | null => {
    if (o.customer_po_date) return o.customer_po_date;
    if (o.confirmed_date) return o.confirmed_date;
    if (o.delivery_date) return o.delivery_date;
    // Fallback: use linked RFQ date
    if (o.rfq_id) {
      const rfq = rfqs.find(r => r.id === o.rfq_id);
      if (rfq) return rfq.rfq_date;
    }
    return null;
  }, [rfqs]);

  // Target achieved = all orders by best available date in the quarter
  const selectedTargetAchieved = useMemo(() => {
    return orders
      .filter(o => {
        const d = getOrderDate(o);
        return d && d >= selectedStart && d <= selectedEnd;
      })
      .reduce((s, o) => s + o.order_value, 0);
  }, [orders, selectedStart, selectedEnd, getOrderDate]);

  const targetAchieved = useMemo(() => {
    return orders
      .filter(o => {
        const d = getOrderDate(o);
        return d && d >= quarterStart && d <= today;
      })
      .reduce((s, o) => s + o.order_value, 0);
  }, [orders, quarterStart, today, getOrderDate]);

  // Overall KPIs
  const totalClients = useMemo(() => clients.length, [clients]);
  const totalOrders = useMemo(() => orders.length, [orders]);
  const installationOrders = useMemo(() => orders.filter(o => o.status === 'in_transit' || o.status === 'procurement').length, [orders]);
  const activeProspects = useMemo(() => prospects.filter(p => !p.converted_client_id).length, [prospects]);
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.order_value, 0), [orders]);

  const topRFQClients = useMemo(() => {
    const rfqCountByClient: Record<string, number> = {};
    rfqs.forEach(r => { rfqCountByClient[r.client_id] = (rfqCountByClient[r.client_id] || 0) + 1; });
    return Object.entries(rfqCountByClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([clientId, count]) => ({ name: getClientName(clientId), count }));
  }, [rfqs, getClientName]);

  // Fetch current quarter target
  const fetchTarget = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quarterly_targets')
        .select('target_value')
        .eq('year', currentYear)
        .eq('quarter', currentQuarter)
        .maybeSingle();
      if (error) { setQuarterlyTarget(0); }
      else if (data) { setQuarterlyTarget(Number(data.target_value)); }
      else { setQuarterlyTarget(0); }
    } catch { setQuarterlyTarget(0); }
  }, [currentYear, currentQuarter]);

  useEffect(() => { fetchTarget(); }, [fetchTarget]);

  // Fetch selected quarter target
  const fetchSelectedTarget = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quarterly_targets')
        .select('target_value')
        .eq('year', selectedYear)
        .eq('quarter', selectedQtr)
        .maybeSingle();
      if (error) { setSelectedQuarterTarget(0); }
      else if (data) { setSelectedQuarterTarget(Number(data.target_value)); }
      else { setSelectedQuarterTarget(0); }
    } catch { setSelectedQuarterTarget(0); }
  }, [selectedYear, selectedQtr]);

  useEffect(() => { fetchSelectedTarget(); }, [fetchSelectedTarget]);

  const saveTarget = async () => {
    const val = Number(targetInput) || 0;
    await supabase.from('quarterly_targets').upsert(
      { year: currentYear, quarter: currentQuarter, target_value: val, updated_at: new Date().toISOString() },
      { onConflict: 'year,quarter' }
    );
    setQuarterlyTarget(val);
    setEditingTarget(false);
  };

  const saveSelectedTarget = async () => {
    const val = Number(selectedTargetInput) || 0;
    await supabase.from('quarterly_targets').upsert(
      { year: selectedYear, quarter: selectedQtr, target_value: val, updated_at: new Date().toISOString() },
      { onConflict: 'year,quarter' }
    );
    setSelectedQuarterTarget(val);
    setEditingSelectedTarget(false);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // EARLY RETURNS — safe now, all hooks are above
  // ══════════════════════════════════════════════════════════════════════════

  if (!isAdmin && !isSales) return <Navigate to="/" replace />;
  if (loading) return <DashboardSkeleton />;

  const todayKpis = [
    { label: 'RFQs Received', value: last10Metrics.received, icon: FileText, color: 'text-primary' },
    { label: 'Floated to Suppliers', value: last10Metrics.floated, icon: Send, color: 'text-info' },
    { label: 'Not Floated', value: last10Metrics.notFloated, icon: Target, color: 'text-warning' },
    { label: 'Got Responses', value: last10Metrics.responded, icon: MessageSquare, color: 'text-success' },
  ];

  const monthlyKpis = [
    { label: 'RFQs Received', value: monthlyPipeline.received, icon: FileText, color: 'text-primary' },
    { label: 'Quote from Supplier', value: monthlyPipeline.quoteReceived, icon: MessageSquare, color: 'text-info' },
    { label: 'Quoted to Client', value: monthlyPipeline.quotedToClient, icon: Send, color: 'text-warning' },
    { label: 'PO Received', value: monthlyPipeline.poReceived, icon: CheckCircle, color: 'text-success' },
  ];

  const quarterlyKpis = [
    { label: 'RFQs Received', value: quarterlyPipeline.received, icon: FileText, color: 'text-primary' },
    { label: 'Quote from Supplier', value: quarterlyPipeline.quoteReceived, icon: MessageSquare, color: 'text-info' },
    { label: 'Quoted to Client', value: quarterlyPipeline.quotedToClient, icon: Send, color: 'text-warning' },
    { label: 'PO Received', value: quarterlyPipeline.poReceived, icon: CheckCircle, color: 'text-success' },
  ];

  const lastQuarterKpis = [
    { label: 'RFQs Received', value: selectedQuarterPipeline.received, icon: FileText, color: 'text-primary' },
    { label: 'Quote from Supplier', value: selectedQuarterPipeline.quoteReceived, icon: MessageSquare, color: 'text-info' },
    { label: 'Quoted to Client', value: selectedQuarterPipeline.quotedToClient, icon: Send, color: 'text-warning' },
    { label: 'PO Received', value: selectedQuarterPipeline.poReceived, icon: CheckCircle, color: 'text-success' },
  ];

  const overallKpis = [
    { label: 'Total Clients', value: totalClients, icon: Users, color: 'text-primary' },
    { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-info' },
    { label: 'In Procurement/Transit', value: installationOrders, icon: Wrench, color: 'text-warning' },
    { label: 'Active Prospects', value: activeProspects, icon: Target, color: 'text-hot' },
  ];

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

      {/* ════ TODAY'S PIPELINE ════ */}
      <div>
        <p className="section-title mb-3">Last 10 Days Pipeline</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {todayKpis.map(kpi => (
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

      {/* ════ MONTHLY RFQ PIPELINE ════ */}
      <div>
        <p className="section-title mb-3">Monthly RFQ Pipeline</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {monthlyKpis.map(kpi => (
            <div key={`m-${kpi.label}`} className="kpi-card">
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

      {/* ════ QUARTERLY RFQ PIPELINE ════ */}
      <div>
        <p className="section-title mb-3">Quarterly RFQ Pipeline (Q{currentQuarter} {currentYear})</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quarterlyKpis.map(kpi => (
            <div key={`q-${kpi.label}`} className="kpi-card">
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

      {/* ════ LAST QUARTER RESULTS ════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Previous Quarter Performance</p>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer"
          >
            {availableQuarters.map(q => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {lastQuarterKpis.map(kpi => (
            <div key={`lq-${kpi.label}`} className="kpi-card opacity-80">
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

      {/* ════ CURRENT QUARTER TARGET ════ */}
      <div>
        <p className="section-title mb-3">Current Quarter Target (Q{currentQuarter} {currentYear})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="kpi-card">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">Quarter Target</p>
              <div className="flex items-center gap-1.5">
                {isAdmin && !editingTarget && (
                  <button onClick={() => { setTargetInput(String(quarterlyTarget)); setEditingTarget(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Set Target">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
                  <Target className="w-4 h-4" />
                </div>
              </div>
            </div>
            {editingTarget ? (
              <div className="flex items-center gap-2">
                <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="Enter target value"
                  className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
                <button onClick={saveTarget} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Save</button>
                <button onClick={() => setEditingTarget(false)} className="p-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-4xl font-extrabold text-foreground tracking-tight">{formatPKR(quarterlyTarget)}</p>
            )}
          </div>
          <div className="kpi-card">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">Target Achieved</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${quarterlyTarget > 0 && targetAchieved >= quarterlyTarget ? 'bg-success/15 text-success' : 'bg-info/15 text-info'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-4xl font-extrabold text-foreground tracking-tight">{formatPKR(targetAchieved)}</p>
            {quarterlyTarget > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{Math.min(100, Math.round((targetAchieved / quarterlyTarget) * 100))}% achieved</span>
                  <span>{formatPKR(quarterlyTarget - targetAchieved > 0 ? quarterlyTarget - targetAchieved : 0)} remaining</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${targetAchieved >= quarterlyTarget ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (targetAchieved / quarterlyTarget) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ PREVIOUS QUARTER TARGET ════ */}
      <div>
        <p className="section-title mb-3">Previous Quarter Target (Q{selectedQtr} {selectedYear})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="kpi-card opacity-80">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">Quarter Target</p>
              <div className="flex items-center gap-1.5">
                {isAdmin && !editingSelectedTarget && (
                  <button onClick={() => { setSelectedTargetInput(String(selectedQuarterTarget)); setEditingSelectedTarget(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Set Target">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
                  <Target className="w-4 h-4" />
                </div>
              </div>
            </div>
            {editingSelectedTarget ? (
              <div className="flex items-center gap-2">
                <input type="number" value={selectedTargetInput} onChange={e => setSelectedTargetInput(e.target.value)} placeholder="Enter target value"
                  className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
                <button onClick={saveSelectedTarget} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Save</button>
                <button onClick={() => setEditingSelectedTarget(false)} className="p-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-4xl font-extrabold text-foreground tracking-tight">{formatPKR(selectedQuarterTarget)}</p>
            )}
          </div>
          <div className="kpi-card opacity-80">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground leading-snug pr-2">Target Achieved</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedQuarterTarget > 0 && selectedTargetAchieved >= selectedQuarterTarget ? 'bg-success/15 text-success' : 'bg-info/15 text-info'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-4xl font-extrabold text-foreground tracking-tight">{formatPKR(selectedTargetAchieved)}</p>
            {selectedQuarterTarget > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{Math.min(100, Math.round((selectedTargetAchieved / selectedQuarterTarget) * 100))}% achieved</span>
                  <span>{formatPKR(selectedQuarterTarget - selectedTargetAchieved > 0 ? selectedQuarterTarget - selectedTargetAchieved : 0)} remaining</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${selectedTargetAchieved >= selectedQuarterTarget ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (selectedTargetAchieved / selectedQuarterTarget) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ OVERALL ════ */}
      <div>
        <p className="section-title mb-3">Overall</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overallKpis.map(kpi => (
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

    </div>
  );
}
