import { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfitabilityDashboard() {
  const { getProfitabilityMetrics } = useCRM();
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setIsLoading(true);
    const data = await getProfitabilityMetrics();
    setMetrics(data);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        <div className="glass-card p-6 h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="glass-card p-6 h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="glass-card p-6 h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total Profit */}
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Profit</p>
              <p className={cn(
                'text-3xl font-bold',
                metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                Rs {Math.abs(metrics.totalProfit).toLocaleString('en-PK')}
              </p>
            </div>
            <TrendingUp className={cn(
              'w-8 h-8',
              metrics.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
            )} />
          </div>
        </div>

        {/* Average Margin */}
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Profit Margin</p>
              <p className={cn(
                'text-3xl font-bold',
                metrics.avgMargin >= 20 ? 'text-green-600' :
                  metrics.avgMargin >= 10 ? 'text-yellow-600' :
                    'text-red-600'
              )}>
                {metrics.avgMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Low Margin Alert */}
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Low Margin Orders</p>
              <p className="text-3xl font-bold text-red-600">
                {metrics.lowMarginOrders}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.lowMarginOrders > 0 && '⚠️ Need Review'}
              </p>
            </div>
            {metrics.lowMarginOrders > 0 && (
              <AlertTriangle className="w-8 h-8 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Top Profitable Orders */}
      {metrics.topProfitable.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            🏆 Top 3 Most Profitable Orders
          </h3>
          <div className="space-y-3">
            {metrics.topProfitable.map((order: any, idx: number) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-background/50 rounded">
                <div>
                  <p className="font-semibold text-foreground">
                    #{idx + 1} • Rs {order.order_value?.toLocaleString('en-PK')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Profit: Rs {order.profit?.toLocaleString('en-PK')} ({order.profit_margin?.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {metrics.totalOrders === 0 && (
        <div className="glass-card p-6 text-center">
          <p className="text-muted-foreground">No orders with profitability data yet.</p>
        </div>
      )}
    </div>
  );
}
