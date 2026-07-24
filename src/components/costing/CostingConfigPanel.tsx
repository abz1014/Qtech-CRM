import { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Save, Settings2 } from 'lucide-react';
import { DEFAULT_CONFIG_VALUES } from '@/lib/costing/mapping';
import type { CostingConfigValues } from '@/types/crm';

const FIELDS: { key: keyof CostingConfigValues; label: string; group: string }[] = [
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

const s = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));

/** Admin-managed default freight rates, fixed charges and tax % for the single-item model. */
export function CostingConfigPanel() {
  const { costingConfig, updateCostingConfig } = useCRM();
  const { isAdmin } = useAuth();

  const seed = (): CostingConfigValues => {
    if (!costingConfig) return { ...DEFAULT_CONFIG_VALUES };
    const v = {} as CostingConfigValues;
    for (const f of FIELDS) v[f.key] = costingConfig[f.key];
    return v;
  };

  const [vals, setVals] = useState<CostingConfigValues>(seed);
  const [saving, setSaving] = useState(false);

  // Re-seed when the stored config arrives / changes.
  useEffect(() => {
    if (!costingConfig) { setVals({ ...DEFAULT_CONFIG_VALUES }); return; }
    const v = {} as CostingConfigValues;
    for (const f of FIELDS) v[f.key] = costingConfig[f.key];
    setVals(v);
  }, [costingConfig]);

  const setField = (key: keyof CostingConfigValues, value: string) =>
    setVals(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCostingConfig(vals);
      toast.success('Costing settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally { setSaving(false); }
  };

  const cell = 'px-2 py-1.5 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full disabled:opacity-70';
  const label = 'text-[12px] font-medium text-muted-foreground mb-1 block';

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-title flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-primary" /> Freight &amp; charges settings</p>
        {!isAdmin && <span className="text-[12px] text-muted-foreground">Read-only (admin manages these)</span>}
      </div>
      <p className="text-[12px] text-muted-foreground">Defaults applied to every single-item costing. Each quote can still override them for its own case.</p>

      {['Freight rates', 'Fixed charges', 'Tax'].map(group => (
        <div key={group}>
          <p className="text-[12px] font-semibold text-muted-foreground mb-1.5">{group}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FIELDS.filter(f => f.group === group).map(f => (
              <div key={f.key}>
                <span className={label}>{f.label}</span>
                <input className={cell} type="number" value={s(vals[f.key])} disabled={!isAdmin}
                  onChange={e => setField(f.key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </div>
  );
}
