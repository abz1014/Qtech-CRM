import { useCRM } from '@/contexts/CRMContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function SupplierPerformanceChart() {
  const { orders, vendors, getVendorName } = useCRM();

  // Calculate vendor metrics
  const vendorMetrics = orders
    .filter(o => o.status !== 'quotation')
    .reduce((acc, order) => {
      const vendorName = getVendorName(order.vendor_id);
      const existing = acc.find(item => item.vendor === vendorName);
      const profit = order.profit || (order.order_value - order.cost_value);
      const margin = order.profit_margin !== undefined ? order.profit_margin : (order.order_value > 0 ? (profit / order.order_value) * 100 : 0);

      if (existing) {
        existing.totalOrders += 1;
        existing.totalProfit += profit;
        existing.avgMargin = (existing.avgMargin * (existing.totalOrders - 1) + margin) / existing.totalOrders;
        existing.totalRevenue += order.order_value;
      } else {
        acc.push({
          vendor: vendorName,
          totalOrders: 1,
          totalProfit: profit,
          avgMargin: margin,
          totalRevenue: order.order_value,
        });
      }
      return acc;
    }, [] as Array<{
      vendor: string;
      totalOrders: number;
      totalProfit: number;
      avgMargin: number;
      totalRevenue: number;
    }>)
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 8); // Top 8 vendors

  if (vendorMetrics.length === 0) {
    return (
      <div className="glass-card p-6 h-80 flex items-center justify-center">
        <p className="text-muted-foreground">No vendor data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Supplier Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={vendorMetrics}
          margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="vendor"
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `Rs ${(value / 1000000).toFixed(0)}M`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value: any) => `Rs ${value.toLocaleString('en-PK')}`}
          />
          <Legend />
          <Bar
            dataKey="totalProfit"
            fill="#10B981"
            name="Total Profit"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="totalRevenue"
            fill="#3B82F6"
            name="Total Revenue"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Top Performers */}
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Performance Summary</h4>
        {vendorMetrics.slice(0, 5).map((vendor, idx) => (
          <div key={vendor.vendor} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
              <span className="text-sm font-medium text-foreground">{vendor.vendor}</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">{vendor.totalOrders} orders</span>
              <span className="text-success font-semibold">Rs {(vendor.totalProfit / 1000000).toFixed(1)}M</span>
              <span className="text-info">{vendor.avgMargin.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
