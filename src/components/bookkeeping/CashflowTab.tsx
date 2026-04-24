import { useCRM } from '@/contexts/CRMContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function CashflowTab() {
  const { getCashflowStatement } = useCRM();

  const cashflowData = getCashflowStatement(12);

  return (
    <div className="space-y-6">
      {/* Cashflow Chart */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Cashflow (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={cashflowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
              formatter={(value) => [
                new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value as number),
                '',
              ]}
            />
            <Legend />
            <Line type="monotone" dataKey="opening_balance" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            <Line type="monotone" dataKey="total_inflow" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            <Line type="monotone" dataKey="total_outflow" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
            <Line type="monotone" dataKey="closing_balance" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cashflow Statement Table */}
      <div className="glass-card overflow-x-auto border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Month</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Opening Balance</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Inflows</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Outflows</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {cashflowData.map((row, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{row.month}</td>
                <td className="px-5 py-3 text-sm text-right text-muted-foreground">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(row.opening_balance)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-medium text-green-600">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(row.total_inflow)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-medium text-red-600">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(row.total_outflow)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: row.closing_balance >= 0 ? '#10b981' : '#ef4444' }}>
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(row.closing_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
