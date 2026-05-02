import { useState, useMemo } from 'react';
import { Plus, Trash2, DollarSign, Edit2, Search } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { Invoice } from '@/types/bookkeeping';
import { InvoiceForm } from './InvoiceForm';
import { PaymentModal } from './PaymentModal';
import { Pagination } from '@/components/Pagination';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  'Paid': 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  'Overdue': 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  'Partial': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
};

export function InvoicesTab() {
  const { invoices, deleteInvoice, getClientName, clients } = useCRM();
  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filtered invoices
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        getClientName(inv.client_id).toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || inv.payment_status === statusFilter;
      const matchesClient = !clientFilter || inv.client_id === clientFilter;
      return matchesSearch && matchesStatus && matchesClient;
    });
  }, [invoices, search, statusFilter, clientFilter]);

  // Paginated invoices
  const paginatedInvoices = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
      setDeleteConfirm(null);
      // Reset page if we just deleted the last item on current page
      const newTotal = filtered.length - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / itemsPerPage));
      if (currentPage > maxPage) setCurrentPage(maxPage);
    } catch (err) {
      alert('Failed to delete invoice');
    }
  };

  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.invoice_amount, 0);
  const totalPaid = filtered.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const outstanding = totalRevenue - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>

        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search invoices..."
            className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Partial">Partial</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>

        <select
          value={clientFilter}
          onChange={(e) => { setClientFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(totalRevenue)}
          </p>
        </div>
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
          <p className="text-2xl font-bold text-blue-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(totalPaid)}
          </p>
        </div>
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">
            {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(outstanding)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Invoice #</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Client</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Amount</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Issued</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Due</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Paid</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Balance</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.map(inv => {
              const balance = inv.invoice_amount - inv.amount_paid;
              return (
                <tr key={inv.invoice_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{getClientName(inv.client_id)}</td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">
                    {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(inv.invoice_amount)}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{inv.issued_date}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{inv.due_date}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[inv.payment_status])}>
                      {inv.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-green-600">
                    {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(inv.amount_paid)}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium">
                    <span className={balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(balance)}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex gap-2">
                    <button
                      onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                      title="Record Payment"
                    >
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(inv.invoice_id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {paginatedInvoices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No invoices found
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => {
          setCurrentPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onItemsPerPageChange={(items) => {
          setItemsPerPage(items);
          setCurrentPage(1);
        }}
      />

      {/* Modals */}
      {showForm && <InvoiceForm onClose={() => setShowForm(false)} onSuccess={() => setCurrentPage(1)} />}
      {selectedInvoice && showPaymentModal && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => setShowPaymentModal(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Invoice?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
