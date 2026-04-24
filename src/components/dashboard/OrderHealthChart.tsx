import { useCRM } from '@/contexts/CRMContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { OrderStatus } from '@/types/crm';

const statusColors: Record<OrderStatus, string> = {
  quotation: '#9CA3AF',
  confirmed: '#3B82F6',
  procurement: '#F59E0B',
  installation: '#8B5CF6',
  completed: '#10B981',
};

export function OrderHealthChart() {
  const { orders } = useCRM();

  // Count orders by status
  const statusCounts = orders.reduce((acc, order) => {
    const existing = acc.find(item => item.status === order.status);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ status: order.status, count: 1 });
    }
    return acc;
  }, [] as Array<{ status: OrderStatus; count: number }>);

  if (statusCounts.length === 0) {
    return (
      <div className="glass-card p-6 h-80 flex items-center justify-center">
        <p className="text-muted-foreground">No orders to display</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Order Health</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={statusCounts}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ status, count }) => `${status}: ${count}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
          >
            {statusCounts.map((entry) => (
              <Cell key={`cell-${entry.status}`} fill={statusColors[entry.status]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value) => `${value} orders`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-2 mt-6">
        {statusCounts.map((item) => (
          <div
            key={item.status}
            className="p-3 rounded-lg text-center"
            style={{ backgroundColor: `${statusColors[item.status]}20` }}
          >
            <p className="text-xs text-muted-foreground capitalize">{item.status}</p>
            <p className="text-xl font-bold mt-1" style={{ color: statusColors[item.status] }}>
              {item.count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
