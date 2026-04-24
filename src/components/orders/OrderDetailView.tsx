import { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { CostInputCard } from './CostInputCard';
import { ProfitabilityBadge } from './ProfitabilityBadge';
import { X } from 'lucide-react';

interface OrderDetailViewProps {
  orderId: string;
  onClose: () => void;
}

export function OrderDetailView({ orderId, onClose }: OrderDetailViewProps) {
  const { getOrderWithProfitability, updateOrderCosts } = useCRM();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setIsLoading(true);
    const data = await getOrderWithProfitability(orderId);
    setOrder(data);
    setIsLoading(false);
  };

  const handleSaveCosts = async (_, costs: any) => {
    setIsLoading(true);
    await updateOrderCosts(orderId, costs);
    await loadOrder();
    setIsLoading(false);
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Order #{orderId.slice(0, 8).toUpperCase()}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Manage costs and profitability</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-2">Order Value</p>
              <p className="text-3xl font-bold text-primary">Rs {order.order_value?.toLocaleString('en-PK')}</p>
            </div>
            <div className="glass-card p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <span className="inline-block px-3 py-1.5 bg-primary/15 text-primary rounded-lg font-semibold capitalize">
                {order.status}
              </span>
            </div>
          </div>

          {/* Cost Input */}
          <div>
            <CostInputCard
              orderId={orderId}
              costs={{
                material_cost: order.material_cost || 0,
                engineering_cost: order.engineering_cost || 0,
                logistics_cost: order.logistics_cost || 0,
                overhead_cost: order.overhead_cost || 0,
              }}
              onSave={handleSaveCosts}
              isLoading={isLoading}
            />
          </div>

          {/* Profitability Summary */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Profitability Analysis</h3>
            <ProfitabilityBadge
              profit={order.profit || 0}
              margin={order.profit_margin || 0}
              orderValue={order.order_value || 0}
              size="lg"
            />
          </div>

          {/* Order Details */}
          <div className="glass-card p-5 border border-border space-y-3">
            <h3 className="font-semibold text-foreground text-lg">Details</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Product Type</span>
                <span className="font-medium text-foreground">{order.product_type}</span>
              </div>
              {order.vendors && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vendor</span>
                  <span className="font-medium text-foreground">{order.vendors.name}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
