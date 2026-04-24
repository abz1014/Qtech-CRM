import { useState } from 'react';
import { DollarSign, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostInputCardProps {
  orderId: string;
  costs: {
    material_cost: number;
    engineering_cost: number;
    logistics_cost: number;
    overhead_cost: number;
  };
  onSave: (orderId: string, costs: any) => Promise<void>;
  isLoading?: boolean;
}

export function CostInputCard({ orderId, costs, onSave, isLoading }: CostInputCardProps) {
  const [localCosts, setLocalCosts] = useState(costs);
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalCosts(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    await onSave(orderId, localCosts);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const costFields = [
    { key: 'material_cost', label: 'Material Cost', color: 'bg-blue-50 dark:bg-blue-900/20' },
    { key: 'engineering_cost', label: 'Engineering Cost', color: 'bg-purple-50 dark:bg-purple-900/20' },
    { key: 'logistics_cost', label: 'Logistics Cost', color: 'bg-orange-50 dark:bg-orange-900/20' },
    { key: 'overhead_cost', label: 'Overhead Cost', color: 'bg-gray-50 dark:bg-gray-900/20' },
  ];

  const totalCost = Object.values(localCosts).reduce((a, b) => a + b, 0);

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        Cost Breakdown
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {costFields.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{label}</label>
            <input
              type="number"
              value={localCosts[key as keyof typeof localCosts] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground font-semibold placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              placeholder="Enter amount"
            />
          </div>
        ))}
      </div>

      {/* Total Cost Summary */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <p className="text-sm text-muted-foreground mb-2">Total Cost</p>
        <p className="text-3xl font-bold text-primary">
          Rs {totalCost.toLocaleString('en-PK')}
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isLoading}
        className={cn(
          'w-full py-3 px-4 rounded-lg font-semibold transition-all',
          isSaved
            ? 'bg-green-500 text-white'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
        )}
      >
        {isSaved ? (
          <span className="flex items-center gap-2 justify-center">
            <CheckCircle className="w-4 h-4" />
            Saved Successfully
          </span>
        ) : isLoading ? (
          'Saving...'
        ) : (
          'Save Costs'
        )}
      </button>
    </div>
  );
}
