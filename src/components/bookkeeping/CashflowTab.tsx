import { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Format large PKR values as compact labels on the Y-axis (e.g. 1.4M, 800K)
function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const formatPKR = (value: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value);

export function CashflowTab() {
  const { getCashflowStatement } = useCRM();
  const cashflowData = getCashflowStatement(12);

  // Calculate domain so Recharts always renders the Y-axis ascending from 0
  const maxValue = useMemo(() => {
    let max = 0;
    cashflowData.forEach(row => {
      max = Math.max(max, row.opening_balance, row.total_inflow, row.total_outflow, row.closing_balance);
    });
    // Round up to a nice ceiling
    return Math.ceil(max * 1.1 / 100000) * 100000 || 100000;
  }, [cashflowData]);

  return (
    <div className="space-y-6">
      {/* Cashflow Chart */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Cashflow (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={cashflowData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#888"
              tick={{ fontSize: 12 }}
              tickFormatter={formatYAxis}
              domain={[0, maxValue]}
              tickCount={6}
              width={60}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6', fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  opening_balance: 'Opening Balance',
                  total_inflow:    'Total Inflow',
                  total_outflow:   'Total Outflow',
                  closing_balance: 'Closing Balance',
                };
                return [formatPKR(value), labels[name] || name];
              }}
            />
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = {
                  opening_balance: 'Opening Balance',
                  total_inflow:    'Total Inflow',
                  total_outflow:   'Total Outflow',
                  closing_balance: 'Closing Balance',
                };
                return labels[value] || value;
              }}
            />
            <Line type="monotone" dataKey="opening_balance" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
            <Line type="monotone" dataKey="total_inflow"    stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
            <Line type="monotone" dataKey="total_outflow"   stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
            <Line type="monotone" dataKey="closing_balance" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
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
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Net</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {cashflowData.map((row, idx) => {
              const net = row.total_inflow - row.total_outflow;
              return (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{row.month}</td>
                  <td className="px-5 py-3 text-sm text-right text-muted-foreground">
                    {formatPKR(row.opening_balance)}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-green-600">
                    {row.total_inflow > 0 ? formatPKR(row.total_inflow) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-red-600">
                    {row.total_outflow > 0 ? formatPKR(row.total_outflow) : '—'}
                  </td>
                  <td className={`px-5 py-3 text-sm text-right font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {net !== 0 ? (net >= 0 ? '+' : '') + formatPKR(net) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-bold"
                      style={{ color: row.closing_balance >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatPKR(row.closing_balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
