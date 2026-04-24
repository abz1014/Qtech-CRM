import { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PolarGrid, Radar, RadarChart
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6'];

export function DashboardTab() {
  const { invoices, expenses, getDashboardMetrics, getMonthlySummary } = useCRM();

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
      const current = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, current + exp.amount);
    });
    return Array.from(categoryMap).map(([category, amount]) => ({ name: category, value: amount }));
  }, [expenses]);

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* MTD Cards */}
        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">MTD Revenue</p>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.mtd_revenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{invoices.filter(inv => inv.issued_date.startsWith(new Date().toISOString().slice(0, 7))).length} invoices</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">MTD Expenses</p>
          <p className="text-2xl font-bold text-red-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.mtd_expenses)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{expenses.filter(exp => exp.date.startsWith(new Date().toISOString().slice(0, 7))).length} expenses</p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">MTD Profit</p>
          <p className={`text-2xl font-bold ${metrics.mtd_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.mtd_profit)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.mtd_revenue > 0 ? ((metrics.mtd_profit / metrics.mtd_revenue) * 100).toFixed(1) : '0.0'}% margin
          </p>
        </div>

        <div className="glass-card p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Overdue A/R</p>
          <p className="text-2xl font-bold text-orange-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.overdue_invoices_amount)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{metrics.overdue_invoices_count} overdue invoices</p>
        </div>
      </div>

      {/* YTD Summary */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Year-to-Date Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600">
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_revenue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600">
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_expenses)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
            <p className={`text-3xl font-bold ${metrics.ytd_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_profit)}
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
            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
            <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="glass-card p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseByCategory.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value as number),
                    'Amount',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No expense data yet
            </div>
          )}
        </div>

        {/* Quarterly Comparison */}
        <div className="glass-card p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quarterly Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                formatter={(value) => [
                  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value as number),
                  '',
                ]}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" />
              <Bar dataKey="expenses" fill="#ef4444" />
              <Bar dataKey="profit" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AR Summary */}
      <div className="glass-card p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Accounts Receivable Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Outstanding A/R</p>
            <p className="text-2xl font-bold text-orange-600">
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.outstanding_ar)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {invoices.filter(inv => inv.payment_status !== 'Paid').length} pending invoices
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Overdue Amount</p>
            <p className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.overdue_invoices_amount)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.overdue_invoices_count} overdue invoices
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Collection Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {metrics.mtd_revenue > 0 ? ((invoices.filter(inv => inv.payment_status === 'Paid').reduce((sum, inv) => sum + inv.amount_paid, 0) / metrics.ytd_revenue) * 100).toFixed(1) : '0.0'}%
            </p>
            <p className="text-xs text-muted-foreground mt-2">Of total invoiced</p>
          </div>
        </div>
      </div>
    </div>
  );
}
