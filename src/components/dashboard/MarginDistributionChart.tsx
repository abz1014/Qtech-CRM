import { useCRM } from '@/contexts/CRMContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export function MarginDistributionChart() {
  const { orders } = useCRM();

  // Calculate margin distribution
  const margins = orders
    .filter(o => o.status !== 'quotation')
    .map(o => {
      const profit = o.profit !== undefined ? o.profit : o.order_value - (o.cost_value || 0);
      const margin = o.profit_margin !== undefined ? o.profit_margin : (o.order_value > 0 ? (profit / o.order_value) * 100 : 0);
      return margin;
    });

  const distribution = [
    {
      range: '< 10%',
      count: margins.filter(m => m < 10).length,
      color: '#EF4444'
    },
    {
      range: '10-20%',
      count: margins.filter(m => m >= 10 && m < 20).length,
      color: '#FBBF24'
    },
    {
      range: '20-30%',
      count: margins.filter(m => m >= 20 && m < 30).length,
      color: '#60A5FA'
    },
    {
      range: '> 30%',
      count: margins.filter(m => m >= 30).length,
      color: '#10B981'
    }
  ];

  if (margins.length === 0) {
    return (
      <div className="glass-card p-6 h-80 flex items-center justify-center">
        <p className="text-muted-foreground">No data available for margin distribution</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Margin Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={distribution} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="range"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value) => `${value} orders`}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {distribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 mt-6">
        {distribution.map((item) => (
          <div key={item.range} className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">{item.range}</p>
            <p className="text-lg font-bold text-foreground">{item.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
