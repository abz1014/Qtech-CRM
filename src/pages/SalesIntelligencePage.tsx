import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { FileText, Send, MessageSquare, CheckCircle, TrendingDown, Clock, Download } from 'lucide-react';
import { businessToday } from '@/lib/dates';
import { lossReasonLabel } from '@/lib/lossReasons';
import { generateCSV, downloadCSV } from '@/lib/csvExport';

type Preset = 'this_month' | 'this_quarter' | 'this_year' | 'all_time';

function getRange(preset: Preset): { from: string; to: string } {
  const today = businessToday();
  const y = parseInt(today.slice(0, 4));
  const m = parseInt(today.slice(5, 7));
  switch (preset) {
    case 'this_month': return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'this_quarter': {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${String(qStartMonth).padStart(2, '0')}-01`, to: today };
    }
    case 'this_year': return { from: `${y}-01-01`, to: today };
    case 'all_time': return { from: '2000-01-01', to: today };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'all_time', label: 'All Time' },
];

// Days between two YYYY-MM-DD (or timestamp) strings; null if invalid/negative
function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return isNaN(d) || d < 0 ? null : d;
}
function avg(nums: number[]): number | null {
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
}

export default function SalesIntelligencePage() {
  const { rfqs, supplierInquiries, supplierQuotes, getUserName } = useCRM();
  const [preset, setPreset] = useState<Preset>('this_quarter');
  const range = useMemo(() => getRange(preset), [preset]);

  const rangeRfqs = useMemo(
    () => rfqs.filter(r => r.rfq_date >= range.from && r.rfq_date <= range.to),
    [rfqs, range]
  );

  const hasInquiry = useMemo(() => new Set(supplierInquiries.map(i => i.rfq_id)), [supplierInquiries]);

  // ── Conversion funnel ──
  const funnel = useMemo(() => {
    const received = rangeRfqs.length;
    const floated = rangeRfqs.filter(r => hasInquiry.has(r.id)).length;
    const quoted = rangeRfqs.filter(r => (r as any).quote_sent_date || r.status === 'quoted' || r.status === 'converted').length;
    const won = rangeRfqs.filter(r => r.status === 'converted').length;
    const lost = rangeRfqs.filter(r => r.status === 'lost').length;
    const conversionRate = received > 0 ? Math.round((won / received) * 100) : null;
    const winOfDecided = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
    return { received, floated, quoted, won, lost, conversionRate, winOfDecided };
  }, [rangeRfqs, hasInquiry]);

  // ── Response times (averages, days) ──
  const responseTimes = useMemo(() => {
    const toFloat: number[] = [];
    const toQuote: number[] = [];
    rangeRfqs.forEach(r => {
      const firstInquiry = supplierInquiries
        .filter(i => i.rfq_id === r.id && i.sent_at)
        .sort((a, b) => a.sent_at.localeCompare(b.sent_at))[0];
      const tf = daysBetween(r.rfq_date, firstInquiry?.sent_at);
      if (tf !== null) toFloat.push(tf);
      const tq = daysBetween(r.rfq_date, (r as any).quote_sent_date);
      if (tq !== null) toQuote.push(tq);
    });
    return { avgToFloat: avg(toFloat), avgToQuote: avg(toQuote) };
  }, [rangeRfqs, supplierInquiries]);

  // ── Loss reasons ──
  const lossBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    rangeRfqs.filter(r => r.status === 'lost').forEach(r => {
      const reason = (r as any).loss_reason || 'other';
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    });
    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    return { rows: Array.from(counts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), total };
  }, [rangeRfqs]);

  // ── Per-salesperson performance ──
  const bySalesperson = useMemo(() => {
    const map = new Map<string, { received: number; quoted: number; won: number; lost: number; respDays: number[] }>();
    rangeRfqs.forEach(r => {
      const uid = r.assigned_to || 'unassigned';
      const s = map.get(uid) ?? { received: 0, quoted: 0, won: 0, lost: 0, respDays: [] };
      s.received++;
      if ((r as any).quote_sent_date || r.status === 'quoted' || r.status === 'converted') s.quoted++;
      if (r.status === 'converted') s.won++;
      if (r.status === 'lost') s.lost++;
      const tq = daysBetween(r.rfq_date, (r as any).quote_sent_date);
      if (tq !== null) s.respDays.push(tq);
      map.set(uid, s);
    });
    return Array.from(map.entries())
      .map(([uid, s]) => ({
        uid,
        name: uid === 'unassigned' ? 'Unassigned' : getUserName(uid),
        ...s,
        conversion: s.received > 0 ? Math.round((s.won / s.received) * 100) : 0,
        avgResp: avg(s.respDays),
      }))
      .sort((a, b) => b.received - a.received);
  }, [rangeRfqs, getUserName]);

  const funnelStages = [
    { label: 'RFQs Received', value: funnel.received, icon: FileText, color: 'bg-primary/15 text-primary' },
    { label: 'Floated', value: funnel.floated, icon: Send, color: 'bg-info/15 text-info' },
    { label: 'Quoted to Client', value: funnel.quoted, icon: MessageSquare, color: 'bg-warning/15 text-warning' },
    { label: 'Won', value: funnel.won, icon: CheckCircle, color: 'bg-success/15 text-success' },
  ];

  const handleExport = () => {
    const periodLabel = PRESETS.find(p => p.key === preset)?.label ?? preset;
    const rows: any[][] = [];
    rows.push([`Period: ${periodLabel}`, `${range.from} to ${range.to}`]);
    rows.push([]);
    rows.push(['CONVERSION FUNNEL']);
    rows.push(['RFQs Received', funnel.received]);
    rows.push(['Floated', funnel.floated]);
    rows.push(['Quoted to Client', funnel.quoted]);
    rows.push(['Won', funnel.won]);
    rows.push(['Lost', funnel.lost]);
    rows.push(['Overall Conversion %', funnel.conversionRate ?? '—']);
    rows.push(['Win Rate of Decided %', funnel.winOfDecided ?? '—']);
    rows.push(['Avg RFQ to Floated (days)', responseTimes.avgToFloat ?? '—']);
    rows.push(['Avg RFQ to Quoted (days)', responseTimes.avgToQuote ?? '—']);
    rows.push([]);
    rows.push(['WHY WE LOSE', 'Count', 'Share %']);
    lossBreakdown.rows.forEach(r => rows.push([lossReasonLabel(r.reason), r.count, lossBreakdown.total ? Math.round((r.count / lossBreakdown.total) * 100) : 0]));
    rows.push([]);
    rows.push(['TEAM PERFORMANCE']);
    rows.push(['Salesperson', 'Received', 'Quoted', 'Won', 'Lost', 'Conversion %', 'Avg Days to Quote']);
    bySalesperson.forEach(s => rows.push([s.name, s.received, s.quoted, s.won, s.lost, s.conversion, s.avgResp ?? '—']));

    const csv = generateCSV([`Q-Tech Sales Intelligence (generated ${businessToday()})`], rows);
    downloadCSV(csv, `Sales_Intelligence_${preset}_${businessToday()}.csv`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Conversion, response speed, losses, and team performance</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {p.label}
            </button>
          ))}
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Conversion funnel ── */}
      <div>
        <p className="section-title mb-3">Conversion Funnel</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelStages.map((s, i) => {
            const pct = funnel.received > 0 ? Math.round((s.value / funnel.received) * 100) : 0;
            return (
              <div key={s.label} className="kpi-card">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}><s.icon className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{s.value}</p>
                {i > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of received</p>}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
            <p className="text-2xl font-bold text-primary mt-1">{funnel.conversionRate === null ? '—' : `${funnel.conversionRate}%`}</p>
            <p className="text-[10px] text-muted-foreground">won / received</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Win Rate (decided)</p>
            <p className="text-2xl font-bold text-success mt-1">{funnel.winOfDecided === null ? '—' : `${funnel.winOfDecided}%`}</p>
            <p className="text-[10px] text-muted-foreground">won / (won + lost)</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Avg RFQ → Floated</p>
            <p className="text-2xl font-bold text-foreground mt-1">{responseTimes.avgToFloat === null ? '—' : `${responseTimes.avgToFloat}d`}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Avg RFQ → Quoted</p>
            <p className="text-2xl font-bold text-foreground mt-1">{responseTimes.avgToQuote === null ? '—' : `${responseTimes.avgToQuote}d`}</p>
          </div>
        </div>
      </div>

      {/* ── Loss analysis ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-destructive" /> Why We Lose ({lossBreakdown.total})</p>
        {lossBreakdown.total === 0 ? (
          <p className="text-sm text-muted-foreground glass-card p-5">No lost RFQs in this period.</p>
        ) : (
          <div className="glass-card p-5 space-y-2.5">
            {lossBreakdown.rows.map(row => {
              const pct = Math.round((row.count / lossBreakdown.total) * 100);
              return (
                <div key={row.reason}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{lossReasonLabel(row.reason)}</span>
                    <span className="text-muted-foreground text-xs">{row.count} · {pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-destructive/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Per-salesperson performance ── */}
      <div>
        <p className="section-title mb-3">Team Performance</p>
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Salesperson</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Received</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Quoted</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Won</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Lost</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Conversion</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Avg → Quote</th>
              </tr>
            </thead>
            <tbody>
              {bySalesperson.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-6 text-center text-sm text-muted-foreground">No RFQs in this period.</td></tr>
              ) : bySalesperson.map(s => (
                <tr key={s.uid} className="border-b border-border/50">
                  <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.received}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.quoted}</td>
                  <td className="px-5 py-3 text-success font-semibold">{s.won}</td>
                  <td className="px-5 py-3 text-destructive">{s.lost}</td>
                  <td className="px-5 py-3">
                    <span className={`font-bold ${s.conversion >= 30 ? 'text-success' : s.conversion >= 15 ? 'text-warning' : 'text-muted-foreground'}`}>{s.conversion}%</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{s.avgResp === null ? '—' : `${s.avgResp}d`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
