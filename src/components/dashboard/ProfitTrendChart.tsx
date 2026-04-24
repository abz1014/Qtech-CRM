import { useCRM } from '@/contexts/CRMContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function ProfitTrendChart() {
  const { orders } = useCRM();

  // Group profits by date
  const profitByDate = orders
    .filter(o => o.status !== 'quotation' && o.confirmed_date)
    .reduce((acc, order) => {
      const date = order.confirmed_date!.split('T')[0];
      const existing = acc.find(item => item.date === date);
      const profit = order.profit || (order.order_value - order.cost_value);

      if (existing) {
        existing.profit += profit;
        existing.orders += 1;
      } else {
        acc.push({ date, profit, orders: 1 });
      }
      return acc;
    }, [] as Array<{ date: string; profit: number; orders: number }>)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // Last 30 days

  if (profitByDate.length === 0) {
    return (
      <div className="glass-card p-6 h-80 flex items-center justify-center">
        <p className="text-muted-foreground">No data available for profit trend</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Profit Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={profitByDate} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `Rs ${(value / 1000000).toFixed(1)}M`}
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
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
