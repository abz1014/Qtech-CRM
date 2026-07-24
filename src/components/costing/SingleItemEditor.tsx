import { useMemo, useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { formatPKR } from '@/lib/format';
import { toast } from 'sonner';
import { Save, CheckCircle, Calculator, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { calcSingleItem, type SingleItemInput, type FreightMode } from '@/lib/costing/qtech-costing';
import { singleDistribution, SINGLE_DIST_META } from '@/lib/costing/single-distribution';
import { configValuesToEngine, DEFAULT_CONFIG_VALUES } from '@/lib/costing/mapping';
import { singleToApply, type ApplyTotals } from '@/lib/costing/apply';
import type { CostLine, CostingConfigValues } from '@/types/crm';

const FREIGHT_MODES: FreightMode[] = ['Air', 'Sea', 'Courier', 'Road'];

interface Draft {
  item: string; currency: string;
  qty: string; weightEach: string; supplierPrice: string; packing: string;
  loadingPct: string; exchangeRate: string; marginPct: string;
  freightMode: FreightMode; shipmentWeight: string;
}

const blankDraft = (): Draft => ({
  item: '', currency: 'PKR',
  qty: '1', weightEach: '', supplierPrice: '', packing: '',
  loadingPct: '0', exchangeRate: '1', marginPct: '25',
  freightMode: 'Air', shipmentWeight: '',
});

const s = (n: number | undefined | null) => (n === undefined || n === null ? '' : n === 0 ? '0' : String(n));

const fromCostLine = (l: CostLine): Draft => ({
  item: l.item, currency: l.currency || 'PKR',
  qty: s(l.qty), weightEach: s(l.unit_weight), supplierPrice: s(l.unit_price), packing: s(l.unit_packing),
  loadingPct: s(l.loading_pct ?? 0), exchangeRate: s(l.exchange_rate || 1), marginPct: s(l.margin_pct),
  freightMode: (l.freight_mode ?? 'Air'), shipmentWeight: s(l.shipment_weight ?? 0),
});

const draftToInput = (d: Draft): SingleItemInput => ({
  quantity: parseFloat(d.qty) || 0,
  weightEach: parseFloat(d.weightEach) || 0,
  supplierPrice: parseFloat(d.supplierPrice) || 0,
  packing: parseFloat(d.packing) || 0,
  loadingPct: parseFloat(d.loadingPct) || 0,
  exchangeRate: parseFloat(d.exchangeRate) || 0,
  marginPct: parseFloat(d.marginPct) || 0,
  freightMode: d.freightMode,
  shipmentWeight: parseFloat(d.shipmentWeight) || 0,
});

const draftToRow = (d: Draft, cfg: CostingConfigValues): Omit<CostLine, 'id' | 'created_at' | 'rfq_id' | 'order_id'> => ({
  sr: '', item: d.item, pn: '', brand: '', supplier: '', region: '', currency: d.currency,
  qty: parseFloat(d.qty) || 0,
  unit_weight: parseFloat(d.weightEach) || 0,
  unit_price: parseFloat(d.supplierPrice) || 0,
  unit_packing: parseFloat(d.packing) || 0,
  unit_freight: 0,
  exchange_rate: parseFloat(d.exchangeRate) || 0,
  duty_pct: 0,
  wht_pct: cfg.wht_percent,
  margin_pct: parseFloat(d.marginPct) || 0,
  gst_pct: cfg.gst_percent,
  sort_order: 0,
  mode: 'single',
  loading_pct: parseFloat(d.loadingPct) || 0,
  freight_mode: d.freightMode,
  shipment_weight: parseFloat(d.shipmentWeight) || 0,
  config_snapshot: cfg,
});

const CONFIG_FIELDS: { key: keyof CostingConfigValues; label: string; group: string }[] = [
  { key: 'air_rate', label: 'Air (PKR/kg)', group: 'Freight rates' },
  { key: 'sea_rate', label: 'Sea (flat PKR)', group: 'Freight rates' },
  { key: 'courier_rate', label: 'Courier (PKR/kg)', group: 'Freight rates' },
  { key: 'road_rate', label: 'Road (PKR/kg)', group: 'Freight rates' },
  { key: 'documentation', label: 'Documentation', group: 'Fixed charges' },
  { key: 'bank_charges', label: 'Bank charges', group: 'Fixed charges' },
  { key: 'clearing', label: 'Clearing', group: 'Fixed charges' },
  { key: 'local_transport', label: 'Local transport', group: 'Fixed charges' },
  { key: 'gst_percent', label: 'GST %', group: 'Tax' },
  { key: 'wht_percent', label: 'WHT %', group: 'Tax' },
  { key: 'insurance_percent', label: 'Insurance %', group: 'Tax' },
];

interface SingleItemEditorProps {
  parent?: { rfq_id: string } | { order_id: string };
  initialLine?: CostLine | null;
  baseConfig?: CostingConfigValues | null;
  onApply?: (totals: ApplyTotals) => Promise<void> | void;
  applyLabel?: string;
}

export function SingleItemEditor({ parent, initialLine, baseConfig, onApply, applyLabel = 'Apply totals' }: SingleItemEditorProps) {
  const { saveCostLines } = useCRM();
  const base = baseConfig ?? DEFAULT_CONFIG_VALUES;

  const [draft, setDraft] = useState<Draft>(() => initialLine ? fromCostLine(initialLine) : blankDraft());
  const [cfg, setCfg] = useState<CostingConfigValues>(() => (initialLine?.config_snapshot ?? base) as CostingConfigValues);
  const [showCfg, setShowCfg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // Re-hydrate if the saved line changes identity (first load / another device saved).
  useEffect(() => {
    if (initialLine) {
      setDraft(fromCostLine(initialLine));
      setCfg((initialLine.config_snapshot ?? base) as CostingConfigValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLine?.id]);

  const input = useMemo(() => draftToInput(draft), [draft]);
  const engineCfg = useMemo(() => configValuesToEngine(cfg), [cfg]);
  const result = useMemo(() => calcSingleItem(input, engineCfg), [input, engineCfg]);
  const dist = useMemo(() => singleDistribution(input, engineCfg), [input, engineCfg]);
  const distTotal = result.totalRevenue || 1;

  const set = (field: keyof Draft, value: string) => setDraft(prev => ({ ...prev, [field]: value }));
  const setCfgField = (key: keyof CostingConfigValues, value: string) =>
    setCfg(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  const cfgDiffers = useMemo(
    () => CONFIG_FIELDS.some(f => (cfg[f.key] ?? 0) !== (base[f.key] ?? 0)),
    [cfg, base]
  );

  const handleSave = async () => {
    if (!parent) return;
    setSaving(true);
    try {
      await saveCostLines(parent, [draftToRow(draft, cfg)]);
      toast.success('Costing saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save costing');
    } finally { setSaving(false); }
  };

  const handleApply = async () => {
    if (!onApply) return;
    setApplying(true);
    try {
      await onApply(singleToApply(result, input.quantity));
      toast.success('Applied');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply');
    } finally { setApplying(false); }
  };

  const cell = 'px-2 py-1.5 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full';
  const label = 'text-[12px] font-medium text-muted-foreground mb-1 block';

  return (
    <div className="space-y-4">
      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <span className={label}>Item</span>
          <input className={cell} value={draft.item} onChange={e => set('item', e.target.value)} placeholder="Item name" />
        </div>
        <div><span className={label}>Currency</span><input className={cell} value={draft.currency} onChange={e => set('currency', e.target.value)} /></div>
        <div><span className={label}>Qty</span><input className={cell} type="number" value={draft.qty} onChange={e => set('qty', e.target.value)} /></div>
        <div><span className={label}>Weight each (kg)</span><input className={cell} type="number" value={draft.weightEach} onChange={e => set('weightEach', e.target.value)} /></div>
        <div><span className={label}>Supplier price</span><input className={cell} type="number" value={draft.supplierPrice} onChange={e => set('supplierPrice', e.target.value)} /></div>
        <div><span className={label}>Packing (per unit)</span><input className={cell} type="number" value={draft.packing} onChange={e => set('packing', e.target.value)} /></div>
        <div><span className={label}>Loading %</span><input className={cell} type="number" value={draft.loadingPct} onChange={e => set('loadingPct', e.target.value)} /></div>
        <div><span className={label}>Exchange rate</span><input className={cell} type="number" value={draft.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} /></div>
        <div><span className={label}>Margin %</span><input className={cell} type="number" value={draft.marginPct} onChange={e => set('marginPct', e.target.value)} /></div>
        <div>
          <span className={label}>Freight mode</span>
          <select className={cell} value={draft.freightMode} onChange={e => set('freightMode', e.target.value)}>
            {FREIGHT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <span className={label}>Shipment weight (kg)</span>
          <input className={cell} type="number" value={draft.shipmentWeight} onChange={e => set('shipmentWeight', e.target.value)} placeholder="auto = qty × weight" />
        </div>
      </div>

      {/* ── Config (per-calc override of admin defaults) ── */}
      <div className="glass-card">
        <button onClick={() => setShowCfg(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground"><Settings2 className="w-4 h-4 text-primary" /> Freight & charges
            {cfgDiffers && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">overridden for this quote</span>}
          </span>
          {showCfg ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showCfg && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-[12px] text-muted-foreground">Defaults come from admin settings. Edits here apply to <strong>this quote only</strong> and are saved with it.</p>
            {['Freight rates', 'Fixed charges', 'Tax'].map(group => (
              <div key={group}>
                <p className="text-[12px] font-semibold text-muted-foreground mb-1.5">{group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONFIG_FIELDS.filter(f => f.group === group).map(f => (
                    <div key={f.key}>
                      <span className={label}>{f.label}</span>
                      <input className={cell} type="number" value={s(cfg[f.key])} onChange={e => setCfgField(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Totals ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="kpi-card">
          <p className="text-[12px] font-semibold text-muted-foreground">Company Cost</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(result.totalCost)}</p>
          <p className="text-[11px] text-muted-foreground">incl freight + WHT</p>
        </div>
        <div className="kpi-card">
          <p className="text-[12px] font-semibold text-muted-foreground">Quoted (excl GST)</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(result.totalSelling)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-[12px] font-semibold text-muted-foreground">GST</p>
          <p className="text-lg font-extrabold text-foreground tracking-tight mt-1">{formatPKR(result.gstAmount * input.quantity)}</p>
          <p className="text-[11px] text-muted-foreground">pass-through</p>
        </div>
        <div className="kpi-card">
          <p className="text-[12px] font-semibold text-muted-foreground">Customer Price (incl GST)</p>
          <p className="text-lg font-extrabold text-primary tracking-tight mt-1">{formatPKR(result.totalRevenue)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-[12px] font-semibold text-muted-foreground">Gross Profit</p>
          <p className={`text-lg font-extrabold tracking-tight mt-1 ${result.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPKR(result.grossProfit)}</p>
          <p className="text-[11px] text-muted-foreground">
            {result.totalSelling > 0 ? `${result.marginActualPct.toFixed(1)}% of quoted` : '—'}
          </p>
        </div>
      </div>

      {/* ── Distribution ── */}
      <div className="glass-card p-4">
        <p className="section-title mb-3 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-primary" /> Where the money goes</p>
        <div className="w-full h-3 rounded-full overflow-hidden flex mb-3">
          {SINGLE_DIST_META.map(m => {
            const pct = (dist[m.key] / distTotal) * 100;
            return pct > 0 ? <div key={m.key} className={m.color} style={{ width: `${pct}%` }} title={`${m.label}: ${pct.toFixed(1)}%`} /> : null;
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SINGLE_DIST_META.map(m => {
            const pct = result.totalRevenue > 0 ? (dist[m.key] / distTotal) * 100 : 0;
            return (
              <div key={m.key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${m.color} flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground truncate">{m.label}</p>
                  <p className="text-xs font-semibold text-foreground">{formatPKR(dist[m.key])} <span className="text-muted-foreground font-normal">· {pct.toFixed(1)}%</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 flex-wrap">
        {parent && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Costing'}
          </button>
        )}
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
