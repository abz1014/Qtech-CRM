import { useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Layers, Package, Calculator } from 'lucide-react';
import { MultiItemEditor } from '@/components/costing/CostingEditor';
import { SingleItemEditor } from '@/components/costing/SingleItemEditor';
import { CostingConfigPanel } from '@/components/costing/CostingConfigPanel';
import type { CostingConfigValues } from '@/types/crm';

/**
 * Standalone costing calculator — quick estimates that aren't tied to any RFQ
 * or order (nothing is saved here). Use the costing section inside an RFQ/order
 * to persist a costing. Admin + sales only (route-gated).
 */
export default function CostingPage() {
  const { costingConfig } = useCRM();
  const [mode, setMode] = useState<'multi' | 'single'>('single');

  const baseConfig: CostingConfigValues | null = useMemo(() => {
    if (!costingConfig) return null;
    const { air_rate, sea_rate, courier_rate, road_rate, documentation, bank_charges,
      clearing, local_transport, gst_percent, wht_percent, insurance_percent } = costingConfig;
    return { air_rate, sea_rate, courier_rate, road_rate, documentation, bank_charges,
      clearing, local_transport, gst_percent, wht_percent, insurance_percent };
  }, [costingConfig]);

  const tab = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground text-sm flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-primary" />
          Quick cost estimates — nothing saved here. Cost a specific RFQ or order from its own page.
        </p>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setMode('single')} className={tab(mode === 'single')}>
            <Package className="w-4 h-4" /> Single item
          </button>
          <button onClick={() => setMode('multi')} className={tab(mode === 'multi')}>
            <Layers className="w-4 h-4" /> Multi-item RFQ
          </button>
        </div>

        {mode === 'single'
          ? <SingleItemEditor baseConfig={baseConfig} />
          : <MultiItemEditor />}
      </div>

      <CostingConfigPanel />
    </div>
  );
}
