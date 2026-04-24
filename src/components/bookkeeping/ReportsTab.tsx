import { useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { generateCSV, downloadCSV } from '@/lib/csvExport';

export function ReportsTab() {
  const { rfqs, getProjectProfitability, getMonthlySummary, getDashboardMetrics, invoices, expenses } = useCRM();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const metrics = getDashboardMetrics();

  // P&L Statement
  const pnlMonths = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month, label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), ...getMonthlySummary(month) });
    }
    return months;
  }, []);

  // Project profitability
  const projectsData = useMemo(() => {
    return rfqs.map(rfq => getProjectProfitability(rfq.id)).sort((a, b) => b.net_profit - a.net_profit);
  }, [rfqs]);

  const exportPnL = () => {
    const headers = ['Month', 'Revenue', 'Expenses', 'Profit', 'Margin %'];
    const rows = pnlMonths.map(m => [
      m.label,
      m.total_revenue,
      m.total_expenses,
      m.net_profit,
      m.total_revenue > 0 ? ((m.net_profit / m.total_revenue) * 100).toFixed(1) : '0',
    ]);
    const csv = generateCSV(headers, rows);
    downloadCSV(csv, `P&L_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportProjects = () => {
    const headers = ['Project', 'Client', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = projectsData.map(p => [
      p.rfq_number || p.rfq_id,
      p.client_name,
      p.total_revenue,
      p.total_expenses,
      p.net_profit,
      p.margin_percent.toFixed(1),
    ]);
    const csv = generateCSV(headers, rows);
    downloadCSV(csv, `Project_Profitability_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* P&L Statement */}
      <div className="glass-card p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Profit & Loss Statement</h3>
          <button
            onClick={exportPnL}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Month</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Revenue</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Expenses</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Profit</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {pnlMonths.map((m, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{m.label}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">
                    {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(m.total_revenue)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">
                    {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(m.total_expenses)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: m.net_profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(m.net_profit)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {m.total_revenue > 0 ? ((m.net_profit / m.total_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Profitability */}
      <div className="glass-card p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Project Profitability</h3>
          <button
            onClick={exportProjects}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {projectsData.length > 0 ? (
          <div className="space-y-2">
            {projectsData.map((project) => (
              <div key={project.rfq_id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedProject(expandedProject === project.rfq_id ? null : project.rfq_id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{project.client_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{project.invoice_count} invoices • {project.expense_count} expenses</p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="font-bold text-foreground">
                      {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(project.net_profit)}
                    </p>
                    <p className={`text-sm font-medium ${project.margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {project.margin_percent.toFixed(1)}% margin
                    </p>
                  </div>
                  {expandedProject === project.rfq_id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedProject === project.rfq_id && (
                  <div className="bg-muted/10 border-t border-border p-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-bold text-green-600 text-lg">
                        {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(project.total_revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expenses</p>
                      <p className="font-bold text-red-600 text-lg">
                        {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(project.total_expenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Profit</p>
                      <p className="font-bold text-blue-600 text-lg">
                        {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(project.net_profit)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No projects yet</p>
        )}
      </div>
    </div>
  );
}
