import { useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PolarGrid, Radar, RadarChart
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6'];

export function DashboardTab() {
  const { invoices, expenses, getDashboardMetrics, getMonthlySummary } = useCRM();
  const [periodType, setPeriodType] = useState<'current' | 'custom'>('current');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Get metrics for selected period
  const selectedMetrics = useMemo(() => {
    if (periodType === 'current') {
      // Guard against empty selectedMonth (cleared by browser × button)
      const safeMonth = selectedMonth || new Date().toISOString().slice(0, 7);
      const [year, month] = safeMonth.split('-').map(Number);
      const monthStart = `${safeMonth}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

      let revenue = 0;
      let totalExpenses = 0;

      invoices.forEach(inv => {
        if (inv.issued_date >= monthStart && inv.issued_date <= monthEnd) {
          revenue += inv.invoice_amount;
        }
      });

      expenses.forEach(exp => {
        if (exp.date >= monthStart && exp.date <= monthEnd) {
          totalExpenses += exp.amount;
        }
      });

      const profit = revenue - totalExpenses;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        revenue,
        expenses: totalExpenses,
        profit,
        margin: margin.toFixed(1),
        invoiceCount: invoices.filter(inv => inv.issued_date >= monthStart && inv.issued_date <= monthEnd).length,
        expenseCount: expenses.filter(exp => exp.date >= monthStart && exp.date <= monthEnd).length,
        safeMonth,
      };
    } else {
      // Custom date range — guard against empty dates cleared by browser × button
      const today = new Date().toISOString().slice(0, 10);
      const safeStart = customStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const safeEnd = customEndDate || today;

      let revenue = 0;
      let totalExpenses = 0;

      invoices.forEach(inv => {
        if (inv.issued_date >= safeStart && inv.issued_date <= safeEnd) {
          revenue += inv.invoice_amount;
        }
      });

      expenses.forEach(exp => {
        if (exp.date >= safeStart && exp.date <= safeEnd) {
          totalExpenses += exp.amount;
        }
      });

      const profit = revenue - totalExpenses;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        revenue,
        expenses: totalExpenses,
        profit,
        margin: margin.toFixed(1),
        invoiceCount: invoices.filter(inv => inv.issued_date >= safeStart && inv.issued_date <= safeEnd).length,
        expenseCount: expenses.filter(exp => exp.date >= safeStart && exp.date <= safeEnd).length,
        safeMonth: undefined,
      };
    }
  }, [invoices, expenses, periodType, selectedMonth, customStartDate, customEndDate]);

  const metrics = getDashboardMetrics();

  // Revenue trend (last 12 months)
  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const summary = getMonthlySummary(month);
      data.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: summary.total_revenue,
        expenses: summary.total_expenses,
        profit: summary.net_profit,
      });
    }
    return data;
  }, [invoices, expenses]);

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    expenses.forEach(exp => {
      const safeSelectedMonth = selectedMonth || new Date().toISOString().slice(0, 7);
      const safeCustomStart = customStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const safeCustomEnd = customEndDate || new Date().toISOString().slice(0, 10);
      const isInRange = periodType === 'current'
        ? exp.date.startsWith(safeSelectedMonth)
        : exp.date >= safeCustomStart && exp.date <= safeCustomEnd;
      if (isInRange) {
        const current = categoryMap.get(exp.category) || 0;
        categoryMap.set(exp.category, current + exp.amount);
      }
    });
    return Array.from(categoryMap).map(([category, amount]) => ({ name: category, value: amount }));
  }, [expenses, periodType, selectedMonth, customStartDate, customEndDate]);

  // Quarterly data
  const quarterlyData = useMemo(() => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const now = new Date();
    const currentYear = now.getFullYear();

    return quarters.map((q, idx) => {
      const startMonth = idx * 3;
      const endMonth = startMonth + 3;
      let revenue = 0;
      let expenses_ = 0;

      for (let m = startMonth; m < endMonth; m++) {
        const date = new Date(currentYear, m, 1);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const summary = getMonthlySummary(month);
        revenue += summary.total_revenue;
        expenses_ += summary.total_expenses;
      }

      return {
        name: `${q} ${currentYear}`,
        revenue,
        expenses: expenses_,
        profit: revenue - expenses_,
      };
    });
  }, [invoices, expenses]);

  const profitMargin = metrics.ytd_revenue > 0
    ? ((metrics.ytd_profit / metrics.ytd_revenue) * 100).toFixed(1)
    : '0.0';

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="glass-card p-5 border border-border space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Select Period</h3>
        </div>

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setPeriodType('current')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodType === 'current'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Select Month
          </button>
          <button
            onClick={() => setPeriodType('custom')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodType === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Custom Range
          </button>
        </div>

        {periodType === 'current' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Choose Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || new Date().toISOString().slice(0, 7))}
              className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {periodType === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">From</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">To</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected Period Metrics */}
      <div className="glass-card p-6 border border-border space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {periodType === 'current' ? `${selectedMonth} - Metrics` : `${customStartDate} to ${customEndDate} - Metrics`}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">REVENUE</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(selectedMetrics.revenue)}</p>
            <p className="text-xs text-muted-foreground mt-2">{selectedMetrics.invoiceCount} invoices</p>
          </div>

          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">EXPENSES</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(selectedMetrics.expenses)}</p>
            <p className="text-xs text-muted-foreground mt-2">{selectedMetrics.expenseCount} expenses</p>
          </div>

          <div className={`p-4 rounded-lg ${selectedMetrics.profit >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className="text-xs font-medium text-muted-foreground mb-2">NET PROFIT</p>
            <p className={`text-2xl font-bold ${selectedMetrics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(selectedMetrics.profit)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMetrics.margin}% margin
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">PROFIT MARGIN</p>
            <p className="text-2xl font-bold text-primary">{selectedMetrics.margin}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMetrics.revenue > 0 ? 'Healthy' : 'No revenue'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards - YTD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">YTD Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.ytd_revenue)}</p>
          <p className="text-xs text-muted-foreground mt-2">Year to date</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">YTD Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(metrics.ytd_expenses)}</p>
          <p className="text-xs text-muted-foreground mt-2">Year to date</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">YTD Profit</p>
          <p className={`text-2xl font-bold ${metrics.ytd_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(metrics.ytd_profit)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Year to date</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Overdue A/R</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(metrics.overdue_invoices_amount)}</p>
          <p className="text-xs text-muted-foreground mt-2">{metrics.overdue_invoices_count} invoices</p>
        </div>
      </div>

      {/* YTD Summary */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Year-to-Date Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(metrics.ytd_revenue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(metrics.ytd_expenses)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
            <p className={`text-3xl font-bold ${metrics.ytd_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.ytd_profit)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Profit Margin</p>
            <p className="text-3xl font-bold text-blue-600">{profitMargin}%</p>
          </div>
        </div>
      </div>

      {/* Revenue & Expense Trend */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Trend (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
            <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Expense By Category */}
      {expenseByCategory.length > 0 && (
        <div className="glass-card p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={expenseByCategory} cx="50%" cy="50%" labelLine={false} label={{ fill: '#f3f4f6' }} outerRadius={100} fill="#8884d8" dataKey="value">
                {expenseByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: any) => `Rs ${Number(value || 0).toLocaleString('en-PK')}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quarterly Performance */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quarterly Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={quarterlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: any) => `Rs ${Number(value || 0).toLocaleString('en-PK')}`}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
