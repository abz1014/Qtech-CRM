import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCRM } from '@/contexts/CRMContext';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, AlertCircle, ArrowUpRight, ArrowDownLeft, CreditCard, History, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardTab } from '@/components/bookkeeping/DashboardTab';
import { InvoicesTab } from '@/components/bookkeeping/InvoicesTab';
import { ExpensesTab } from '@/components/bookkeeping/ExpensesTab';
import { ARTab } from '@/components/bookkeeping/ARTab';
import { APAgingTab } from '@/components/bookkeeping/APAgingTab';
import { PayablesTab } from '@/components/bookkeeping/PayablesTab';
import { CashflowTab } from '@/components/bookkeeping/CashflowTab';
import { ReportsTab } from '@/components/bookkeeping/ReportsTab';
import { AuditLogTab } from '@/components/bookkeeping/AuditLogTab';
import { BudgetVsActualTab } from '@/components/bookkeeping/BudgetVsActualTab';

interface SummaryCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  format?: 'currency' | 'number';
}

function SummaryCardComponent({ label, value, icon, color, format = 'currency' }: SummaryCard) {
  const formattedValue = format === 'currency'
    ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(value)
    : new Intl.NumberFormat('en-PK').format(value);

  return (
    <div className="glass-card p-6 flex items-start gap-4">
      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', color)}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{formattedValue}</p>
      </div>
    </div>
  );
}

export function BookkeepingPage() {
  const { user } = useAuth();
  const { getDashboardMetrics } = useCRM();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'expenses' | 'ar' | 'ap' | 'payables' | 'cashflow' | 'reports' | 'audit' | 'budget'>('dashboard');

  // Check if admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">Only administrators can access the Bookkeeping module.</p>
      </div>
    );
  }

  const metrics = getDashboardMetrics();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: DollarSign },
    { id: 'invoices', label: 'Invoices', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown },
    { id: 'ar', label: 'A/R Aging', icon: Clock },
    { id: 'payables', label: 'Payables', icon: CreditCard },
    { id: 'ap', label: 'A/P Aging', icon: AlertCircle },
    { id: 'cashflow', label: 'Cashflow', icon: ArrowDownLeft },
    { id: 'budget', label: 'Budget', icon: Target },
    { id: 'reports', label: 'Reports', icon: AlertCircle },
    { id: 'audit', label: 'Audit Log', icon: History },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'invoices':
        return <InvoicesTab />;
      case 'expenses':
        return <ExpensesTab />;
      case 'ar':
        return <ARTab />;
      case 'payables':
        return <PayablesTab />;
      case 'ap':
        return <APAgingTab />;
      case 'cashflow':
        return <CashflowTab />;
      case 'budget':
        return <BudgetVsActualTab />;
      case 'reports':
        return <ReportsTab />;
      case 'audit':
        return <AuditLogTab />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bookkeeping</h1>
        <p className="text-muted-foreground mt-1">Financial management & reporting</p>
      </div>

      {/* Quick Summary Cards - Always Visible */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCardComponent
            label="MTD Revenue"
            value={metrics.mtd_revenue}
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            color="bg-green-100 dark:bg-green-900"
          />
          <SummaryCardComponent
            label="MTD Expenses"
            value={metrics.mtd_expenses}
            icon={<TrendingDown className="w-6 h-6 text-red-600" />}
            color="bg-red-100 dark:bg-red-900"
          />
          <SummaryCardComponent
            label="MTD Profit"
            value={metrics.mtd_profit}
            icon={<DollarSign className="w-6 h-6 text-blue-600" />}
            color="bg-blue-100 dark:bg-blue-900"
          />
          <SummaryCardComponent
            label="Overdue A/R"
            value={metrics.overdue_invoices_amount}
            icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
            color="bg-orange-100 dark:bg-orange-900"
          />
        </div>
      )}

      {/* YTD Cards - Always Visible */}
      {activeTab === 'dashboard' && (
        <div className="glass-card p-6 border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-6">Year-to-Date Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <p className="text-xl font-bold text-green-600 break-words">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_revenue)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <p className="text-xl font-bold text-red-600 break-words">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_expenses)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p>
              <p className={`text-xl font-bold break-words ${metrics.ytd_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(metrics.ytd_profit)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Profit Margin</p>
              <p className="text-xl font-bold text-blue-600">
                {metrics.ytd_revenue > 0 ? ((metrics.ytd_profit / metrics.ytd_revenue) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-border flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}
