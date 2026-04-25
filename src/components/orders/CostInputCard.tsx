import { useState } from 'react';
import { DollarSign, CheckCircle, Package, Wrench, Truck, Percent } from 'lucide-react';
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
    {
      key: 'material_cost',
      label: 'Material Cost',
      icon: Package,
      description: 'Actual cost of raw materials and components',
      color: 'border-blue-500/50 bg-blue-500/5',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      key: 'engineering_cost',
      label: 'Engineering Cost',
      icon: Wrench,
      description: 'Engineering hours, labor, and design costs',
      color: 'border-purple-500/50 bg-purple-500/5',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      key: 'logistics_cost',
      label: 'Logistics Cost',
      icon: Truck,
      description: 'Shipping, delivery, and handling charges',
      color: 'border-orange-500/50 bg-orange-500/5',
      textColor: 'text-orange-600 dark:text-orange-400'
    },
    {
      key: 'overhead_cost',
      label: 'Overhead Cost',
      icon: Percent,
      description: 'Allocated overhead and indirect costs',
      color: 'border-amber-500/50 bg-amber-500/5',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
  ];

  const totalCost = Object.values(localCosts).reduce((a, b) => a + b, 0);

  return (
    <div className="glass-card p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5" />
          Define Your Order Costs
        </h3>
        <p className="text-sm text-muted-foreground">Enter the actual costs incurred in completing this order</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {costFields.map(({ key, label, icon: Icon, description, color, textColor }) => (
          <div key={key} className={`border rounded-lg p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-5 h-5 ${textColor}`} />
              <div>
                <label className={`text-sm font-semibold ${textColor}`}>{label}</label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-foreground font-semibold">Rs</span>
              <input
                type="number"
                value={localCosts[key as keyof typeof localCosts] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-lg text-foreground font-semibold placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                placeholder="0"
                step="0.01"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Cost Breakdown Summary */}
      <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
        <p className="text-sm font-semibold text-foreground mb-3">Cost Summary</p>
        {costFields.map(({ key, label, textColor }) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className={`${textColor}`}>{label}</span>
            <span className="text-foreground font-semibold">
              Rs {localCosts[key as keyof typeof localCosts].toLocaleString('en-PK')}
            </span>
          </div>
        ))}
        <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
          <span className="font-semibold text-foreground">Total Cost</span>
          <span className="text-lg font-bold text-primary">
            Rs {totalCost.toLocaleString('en-PK')}
          </span>
        </div>
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
            Costs Saved Successfully
          </span>
        ) : isLoading ? (
          'Saving...'
        ) : (
          'Save All Costs'
        )}
      </button>
    </div>
  );
}
