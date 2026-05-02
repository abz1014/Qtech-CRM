import { useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Download } from 'lucide-react';
import { generateCSV, downloadCSV } from '@/lib/csvExport';

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  action: string;
  user_name: string;
  timestamp: string;
  field_changed?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function AuditLogTab() {
  const { invoices, expenses, payables, users, clients, vendors, getUserName } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Build audit log from existing data
  const auditLog = useMemo(() => {
    const entries: AuditEntry[] = [];

    // Invoices
    invoices.forEach(inv => {
      entries.push({
        id: `invoice-${inv.invoice_id}-created`,
        entity_type: 'Invoice',
        entity_id: inv.invoice_id,
        entity_name: `${inv.invoice_number}`,
        action: 'Created',
        user_name: getUserName(inv.created_by),
        timestamp: inv.created_at,
      });

      if (inv.updated_at && inv.updated_by) {
        entries.push({
          id: `invoice-${inv.invoice_id}-updated`,
          entity_type: 'Invoice',
          entity_id: inv.invoice_id,
          entity_name: `${inv.invoice_number}`,
          action: 'Updated',
          user_name: getUserName(inv.updated_by),
          timestamp: inv.updated_at,
          field_changed: 'payment_status',
        });
      }

      if (inv.amount_paid > 0) {
        entries.push({
          id: `invoice-${inv.invoice_id}-payment`,
          entity_type: 'Invoice',
          entity_id: inv.invoice_id,
          entity_name: `${inv.invoice_number}`,
          action: 'Payment Recorded',
          user_name: getUserName(inv.created_by),
          timestamp: inv.updated_at || inv.created_at,
          field_changed: `PKR ${new Intl.NumberFormat('en-PK').format(inv.amount_paid)}`,
        });
      }
    });

    // Expenses
    expenses.forEach(exp => {
      entries.push({
        id: `expense-${exp.expense_id}-created`,
        entity_type: 'Expense',
        entity_id: exp.expense_id,
        entity_name: `${exp.description}`,
        action: 'Created',
        user_name: getUserName(exp.created_by),
        timestamp: exp.created_at,
      });

      if (exp.updated_at && exp.updated_by) {
        entries.push({
          id: `expense-${exp.expense_id}-updated`,
          entity_type: 'Expense',
          entity_id: exp.expense_id,
          entity_name: `${exp.description}`,
          action: 'Updated',
          user_name: getUserName(exp.updated_by),
          timestamp: exp.updated_at,
          field_changed: exp.category,
        });
      }
    });

    // Payables
    payables.forEach(pay => {
      entries.push({
        id: `payable-${pay.payable_id}-created`,
        entity_type: 'Payable',
        entity_id: pay.payable_id,
        entity_name: `${pay.invoice_reference || 'AP-' + pay.payable_id.slice(0, 8)}`,
        action: 'Created',
        user_name: getUserName(pay.created_by),
        timestamp: pay.created_at,
      });

      if (pay.updated_at && pay.updated_by) {
        entries.push({
          id: `payable-${pay.payable_id}-updated`,
          entity_type: 'Payable',
          entity_id: pay.payable_id,
          entity_name: `${pay.invoice_reference || 'AP-' + pay.payable_id.slice(0, 8)}`,
          action: 'Updated',
          user_name: getUserName(pay.updated_by),
          timestamp: pay.updated_at,
          field_changed: pay.payment_status,
        });
      }

      if (pay.amount_paid > 0) {
        entries.push({
          id: `payable-${pay.payable_id}-payment`,
          entity_type: 'Payable',
          entity_id: pay.payable_id,
          entity_name: `${pay.invoice_reference || 'AP-' + pay.payable_id.slice(0, 8)}`,
          action: 'Payment Recorded',
          user_name: getUserName(pay.created_by),
          timestamp: pay.updated_at || pay.created_at,
          field_changed: `PKR ${new Intl.NumberFormat('en-PK').format(pay.amount_paid)}`,
        });
      }
    });

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [invoices, expenses, payables, users, getUserName]);

  // Filter
  const filteredLog = useMemo(() => {
    return auditLog.filter(entry => {
      const matchesSearch = !searchTerm ||
        entry.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEntity = !entityFilter || entry.entity_type === entityFilter;
      const matchesAction = !actionFilter || entry.action === actionFilter;

      return matchesSearch && matchesEntity && matchesAction;
    });
  }, [auditLog, searchTerm, entityFilter, actionFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLog.length / itemsPerPage);
  const paginatedLog = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredLog.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredLog, currentPage, itemsPerPage]);

  const exportAuditLog = () => {
    const headers = ['Entity Type', 'Entity Name', 'Action', 'User', 'Timestamp', 'Details'];
    const rows = filteredLog.map(entry => [
      entry.entity_type,
      entry.entity_name,
      entry.action,
      entry.user_name,
      new Date(entry.timestamp).toLocaleString('en-PK'),
      entry.field_changed || '-',
    ]);
    const csv = generateCSV(headers, rows);
    downloadCSV(csv, `Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="glass-card p-4 border border-border">
        <p className="text-sm text-muted-foreground mb-1">Total Audit Events</p>
        <p className="text-3xl font-bold text-foreground">{auditLog.length}</p>
      </div>

      {/* Controls */}
      <div className="glass-card p-4 border border-border space-y-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            placeholder="Search by entity name or user..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={exportAuditLog}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <select
            value={entityFilter}
            onChange={e => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Entity Types</option>
            <option value="Invoice">Invoices</option>
            <option value="Expense">Expenses</option>
            <option value="Payable">Payables</option>
          </select>

          <select
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Payment Recorded">Payment Recorded</option>
          </select>

          <select
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {ITEMS_PER_PAGE_OPTIONS.map(num => (
              <option key={num} value={num}>
                {num} per page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Entity</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Action</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Timestamp</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLog.length > 0 ? (
              paginatedLog.map(entry => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.entity_type === 'Invoice'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : entry.entity_type === 'Expense'
                        ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                    }`}>
                      {entry.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.entity_name}</td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.action === 'Created'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : entry.action === 'Updated'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    }`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.user_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(entry.timestamp).toLocaleString('en-PK')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{entry.field_changed || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({filteredLog.length} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-muted hover:bg-muted/80 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  page === currentPage
                    ? 'bg-primary text-background'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-muted hover:bg-muted/80 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
