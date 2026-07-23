import { useMemo, useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { formatPKR } from '@/lib/format';
import { toast } from 'sonner';
import { Plus, Trash2, Save, CheckCircle, Calculator } from 'lucide-react';
import { calcLine, calcRfq, type CostLineInput, type RfqTotals } from '@/lib/costing/qtech-costing';
import { distribution, DIST_META } from '@/lib/costing/distribution';
import type { CostLine } from '@/types/crm';

// Editable draft — string-backed for smooth typing; converted to numbers on calc.
interface Draft {
  key: string;
  item: string; currency: string;
  qty: string; unit_price: string; unit_packing: string; unit_freight: string;
  exchange_rate: string; duty_pct: string; wht_pct: string; margin_pct: string; gst_pct: string;
}

let keySeq = 0;
const blankDraft = (): Draft => ({
  key: `d${keySeq++}`,
  item: '', currency: 'PKR',
  qty: '1', unit_price: '', unit_packing: '', unit_freight: '',
  exchange_rate: '1', duty_pct: '0', wht_pct: '5', margin_pct: '25', gst_pct: '18',
});

const fromCostLine = (l: CostLine): Draft => {
  const s = (n: number) => (n === 0 ? '0' : String(n));
  return {
    key: `d${keySeq++}`,
    item: l.item, currency: l.currency || 'PKR',
    qty: s(l.qty), unit_price: s(l.unit_price), unit_packing: s(l.unit_packing), unit_freight: s(l.unit_freight),
    exchange_rate: s(l.exchange_rate || 1), duty_pct: s(l.duty_pct), wht_pct: s(l.wht_pct),
    margin_pct: s(l.margin_pct), gst_pct: s(l.gst_pct),
  };
};

const draftToInput = (d: Draft): CostLineInput => ({
  item: d.item, currency: d.currency,
  qty: parseFloat(d.qty) || 0,
  unitPrice: parseFloat(d.unit_price) || 0,
  unitPacking: parseFloat(d.unit_packing) || 0,
  unitFreight: parseFloat(d.unit_freight) || 0,
  exchangeRate: parseFloat(d.exchange_rate) || 0,
  dutyPct: parseFloat(d.duty_pct) || 0,
  whtPct: parseFloat(d.wht_pct) || 0,
  marginPct: parseFloat(d.margin_pct) || 0,
  gstPct: parseFloat(d.gst_pct) || 0,
});

const draftToRow = (d: Draft): Omit<CostLine, 'id' | 'created_at' | 'rfq_id' | 'order_id'> => ({
  sr: '', item: d.item, pn: '', brand: '', supplier: '', region: '', currency: d.currency,
  qty: parseFloat(d.qty) || 0,
  unit_weight: 0,
  unit_price: parseFloat(d.unit_price) || 0,
  unit_packing: parseFloat(d.unit_packing) || 0,
  unit_freight: parseFloat(d.unit_freight) || 0,
  exchange_rate: parseFloat(d.exchange_rate) || 0,
  duty_pct: parseFloat(d.duty_pct) || 0,
  wht_pct: parseFloat(d.wht_pct) || 0,
  margin_pct: parseFloat(d.margin_pct) || 0,
  gst_pct: parseFloat(d.gst_pct) || 0,
  sort_order: 0,
});

interface CostingEditorProps {
  parent: { rfq_id: string } | { order_id: string };
  /** Called when the user applies the costing totals (e.g. fill order value / quote). */
  onApply?: (totals: RfqTotals) => Promise<void> | void;
  applyLabel?: string;
}

export function CostingEditor({ parent, onApply, applyLabel = 'Apply totals' }: CostingEditorProps) {
  const { costLines, saveCostLines } = useCRM();
  const parentKey = 'rfq_id' in parent ? 'rfq_id' : 'order_id';
  const parentId = 'rfq_id' in parent ? parent.rfq_id : parent.order_id;

  const saved = useMemo(
    () => costLines.filter(l => l[parentKey] === parentId).sort((a, b) => a.sort_order - b.sort_order),
    [costLines, parentKey, parentId]
  );

  const [drafts, setDrafts] = useState<Draft[]>(() => saved.length ? saved.map(fromCostLine) : [blankDraft()]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // Re-seed when the saved set changes identity (e.g. first load, or another device saved)
  const savedSig = saved.map(l => l.id).join(',');
  useEffect(() => {
    if (saved.length) setDrafts(saved.map(fromCostLine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSig]);

  const inputs = useMemo(() => drafts.map(draftToInput), [drafts]);
  const totals = useMemo(() => calcRfq(inputs), [inputs]);
  const dist = useMemo(() => distribution(inputs), [inputs]);

  const setField = (key: string, field: keyof Draft, value: string) =>
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, [field]: value } : d));
  const addLine = () => setDrafts(prev => [...prev, blankDraft()]);
  const removeLine = (key: string) => setDrafts(prev => prev.length > 1 ? prev.filter(d => d.key !== key) : prev);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCostLines(parent, drafts.map(draftToRow));
      toast.success('Costing saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save costing');
    } finally { setSaving(false); }
  };

  const handleApply = async () => {
    if (!onApply) return;
    setApplying(true);
    try {
      await onApply(totals);
      toast.success('Applied');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply');
    } finally { setApplying(false); }
  };

  const cell = 'px-2 py-1.5 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
  const distTotal = totals.totalInclGst || 1;

  return (
    <div className="space-y-4">
      {/* ── Line grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-y-1" style={{ minWidth: 900 }}>
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="px-2 font-medium">Item</th>
              <th className="px-2 font-medium">Curr.</th>
              <th className="px-2 font-medium">Qty</th>
              <th className="px-2 font-medium">Unit Price</th>
              <th className="px-2 font-medium">Packing</th>
              <th className="px-2 font-medium">Freight</th>
              <th className="px-2 font-medium">Exch.</th>
              <th className="px-2 font-medium">Duty%</th>
              <th className="px-2 font-medium">WHT%</th>
              <th className="px-2 font-medium">Margin%</th>
              <th className="px-2 font-medium">GST%</th>
              <th className="px-2 font-medium text-right">Line total (incl GST)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map(d => {
              const r = calcLine(draftToInput(d));
              return (
                <tr key={d.key}>
                  <td><input className={`${cell} w-36`} value={d.item} onChange={e => setField(d.key, 'item', e.target.value)} placeholder="Item name" /></td>
                  <td><input className={`${cell} w-16`} value={d.currency} onChange={e => setField(d.key, 'currency', e.target.value)} /></td>
                  <td><input className={`${cell} w-16`} type="number" value={d.qty} onChange={e => setField(d.key, 'qty', e.target.value)} /></td>
                  <td><input className={`${cell} w-24`} type="number" value={d.unit_price} onChange={e => setField(d.key, 'unit_price', e.target.value)} /></td>
                  <td><input className={`${cell} w-20`} type="number" value={d.unit_packing} onChange={e => setField(d.key, 'unit_packing', e.target.value)} /></td>
                  <td><input className={`${cell} w-20`} type="number" value={d.unit_freight} onChange={e => setField(d.key, 'unit_freight', e.target.value)} /></td>
                  <td><input className={`${cell} w-20`} type="number" value={d.exchange_rate} onChange={e => setField(d.key, 'exchange_rate', e.target.value)} /></td>
                  <td><input className={`${cell} w-16`} type="number" value={d.duty_pct} onChange={e => setField(d.key, 'duty_pct', e.target.value)} /></td>
                  <td><input className={`${cell} w-16`} type="number" value={d.wht_pct} onChange={e => setField(d.key, 'wht_pct', e.target.value)} /></td>
                  <td><input className={`${cell} w-16`} type="number" value={d.margin_pct} onChange={e => setField(d.key, 'margin_pct', e.target.value)} /></td>
                  <td><input className={`${cell} w-16`} type="number" value={d.gst_pct} onChange={e => setField(d.key, 'gst_pct', e.target.value)} /></td>
                  <td className="px-2 text-right font-semibold text-foreground whitespace-nowrap">{formatPKR(r.totalInclGst)}</td>
                  <td className="px-1">
                    <button onClick={() => removeLine(d.key)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove line">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={addLine} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors border border-border">
        <Plus className="w-3.5 h-3.5" /> Add line
      </button>

      {/* ── Totals ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="kpi-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Company Cost</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(totals.totalCost)}</p>
          <p className="text-[10px] text-muted-foreground">incl WHT</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Quoted (excl GST)</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(totals.totalExclGst)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-semibold text-muted-foreground">GST</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(totals.gst)}</p>
          <p className="text-[10px] text-muted-foreground">pass-through</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Customer Price (incl GST)</p>
          <p className="text-lg font-extrabold text-primary tracking-tight mt-1">{formatPKR(totals.totalInclGst)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Gross Profit</p>
          <p className={`text-lg font-extrabold tracking-tight mt-1 ${totals.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPKR(totals.grossProfit)}</p>
          <p className="text-[10px] text-muted-foreground">
            {totals.totalExclGst > 0 ? `${((totals.grossProfit / totals.totalExclGst) * 100).toFixed(1)}% of quoted` : '—'}
          </p>
        </div>
      </div>

      {/* ── Money distribution ── */}
      <div className="glass-card p-4">
        <p className="section-title mb-3 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-primary" /> Where the money goes</p>
        <div className="w-full h-3 rounded-full overflow-hidden flex mb-3">
          {DIST_META.map(m => {
            const pct = (dist[m.key] / distTotal) * 100;
            return pct > 0 ? <div key={m.key} className={m.color} style={{ width: `${pct}%` }} title={`${m.label}: ${pct.toFixed(1)}%`} /> : null;
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIST_META.map(m => {
            const pct = totals.totalInclGst > 0 ? (dist[m.key] / distTotal) * 100 : 0;
            return (
              <div key={m.key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${m.color} flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{m.label}</p>
                  <p className="text-xs font-semibold text-foreground">{formatPKR(dist[m.key])} <span className="text-muted-foreground font-normal">· {pct.toFixed(1)}%</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Costing'}
        </button>
        {onApply && (
          <button onClick={handleApply} disabled={applying}
            className="flex items-center gap-1.5 px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-60">
            <CheckCircle className="w-4 h-4" /> {applying ? 'Applying…' : applyLabel}
          </button>
        )}
      </div>
    </div>
  );
}
