import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { BudgetForm } from './BudgetForm';
import { useAuth } from '@/contexts/AuthContext';

const EXPENSE_CATEGORIES = [
  'Salaries',
  'Office Expenses',
  'Travel',
  'Equipment',
  'Software Subscriptions',
  'Utilities',
  'Marketing',
  'Inventory/Procurement',
  'Misc',
];

export function BudgetVsActualTab() {
  const { user } = useAuth();
  const { expenses, getMonthlySummary } = useCRM();
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().split('T')[0].slice(0, 7)
  );

  // Get current month expenses — guard against empty selectedMonth
  const monthExpenses = useMemo(() => {
    const safeMonth = selectedMonth || new Date().toISOString().slice(0, 7);
    return expenses.filter(exp => exp.date.startsWith(safeMonth));
  }, [expenses, selectedMonth]);

  // Calculate expenses by category
  const expensesByCategory = useMemo(() => {
    const totals: { [key: string]: number } = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      totals[cat] = 0;
    });
    monthExpenses.forEach(exp => {
      totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
    });
    return totals;
  }, [monthExpenses]);

  // Sample budgets (in real app, these would come from database)
  const sampleBudgets: { [key: string]: number } = {
    'Salaries': 500000,
    'Office Expenses': 50000,
    'Travel': 30000,
    'Equipment': 40000,
    'Software Subscriptions': 20000,
    'Utilities': 25000,
    'Marketing': 35000,
    'Inventory/Procurement': 100000,
    'Misc': 20000,
  };

  // Budget vs Actual data for chart
  const budgetVsActualData = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const actual = expensesByCategory[cat] || 0;
      const budgeted = sampleBudgets[cat] || 0;
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100).toFixed(1) : '0';

      return {
        name: cat,
        budget: budgeted,
        actual: actual,
        variance: variance,
        variancePercent: parseFloat(variancePercent),
      };
    });
  }, [expensesByCategory]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const summary = getMonthlySummary(month);

      const totalBudget = Object.values(sampleBudgets).reduce((sum, val) => sum + val, 0);

      data.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        budgeted: totalBudget,
        actual: summary.total_expenses,
        variance: totalBudget - summary.total_expenses,
      });
    }
    return data;
  }, [getMonthlySummary]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalBudgeted = Object.values(sampleBudgets).reduce((sum, val) => sum + val, 0);
    const totalActual = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalVariance = totalBudgeted - totalActual;
    const variancePercent = totalBudgeted > 0 ? ((totalVariance / totalBudgeted) * 100).toFixed(1) : '0';

    return {
      totalBudgeted,
      totalActual,
      totalVariance,
      variancePercent,
      isOverBudget: totalVariance < 0,
    };
  }, [monthExpenses]);

  // Categories over budget
  const overBudget = useMemo(() => {
    return budgetVsActualData.filter(item => item.variance < 0);
  }, [budgetVsActualData]);

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="glass-card p-4 border border-border flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value || new Date().toISOString().slice(0, 7))}
            className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-background rounded text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Create Budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Budgeted</p>
          <p className="text-2xl font-bold text-foreground">
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.totalBudgeted)}
          </p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Actual Spent</p>
          <p className="text-2xl font-bold text-orange-600">
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.totalActual)}
          </p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Variance</p>
          <p className={`text-2xl font-bold ${summary.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.totalVariance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{summary.variancePercent}%</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Budget Status</p>
          {summary.isOverBudget ? (
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-lg font-bold text-red-600">Over Budget</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-lg font-bold text-green-600">On Track</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {overBudget.length > 0 && (
        <div className="glass-card p-4 border border-red-600/30 bg-red-900/10 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-600">Categories Over Budget</h3>
          </div>
          <div className="space-y-1">
            {overBudget.map(item => (
              <p key={item.name} className="text-sm text-red-200">
                {item.name}: {Math.abs(item.variancePercent).toFixed(1)}% over
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Budget vs Actual Chart */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Budget vs Actual by Category</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={budgetVsActualData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" stroke="#888" angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
              formatter={(value) => [
                new Intl.NumberFormat('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                }).format(value as number),
                '',
              ]}
            />
            <Legend />
            <Bar dataKey="budget" fill="#3b82f6" name="Budgeted" />
            <Bar dataKey="actual" fill="#ef4444" name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Trend */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Budget vs Actual Trend (Last 6 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
              formatter={(value) => [
                new Intl.NumberFormat('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                }).format(value as number),
                '',
              ]}
            />
            <Legend />
            <Line type="monotone" dataKey="budgeted" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Budgeted" />
            <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="Actual" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table */}
      <div className="glass-card overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Budgeted</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actual</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Variance</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">%</th>
            </tr>
          </thead>
          <tbody>
            {budgetVsActualData.map(item => (
              <tr key={item.name} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-4 py-3 text-foreground font-medium">{item.name}</td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {new Intl.NumberFormat('en-PK', {
                    style: 'currency',
                    currency: 'PKR',
                    minimumFractionDigits: 0,
                  }).format(item.budget)}
                </td>
                <td className="px-4 py-3 text-right text-orange-600">
                  {new Intl.NumberFormat('en-PK', {
                    style: 'currency',
                    currency: 'PKR',
                    minimumFractionDigits: 0,
                  }).format(item.actual)}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('en-PK', {
                    style: 'currency',
                    currency: 'PKR',
                    minimumFractionDigits: 0,
                  }).format(item.variance)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.variancePercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Budget Form Modal */}
      {showForm && (
        <BudgetForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {}}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
}
