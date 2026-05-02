import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { DollarSign, Trash2 } from 'lucide-react';
import { PayablesForm } from './PayablesForm';
import { PayablePaymentModal } from './PayablePaymentModal';
import { useAuth } from '@/contexts/AuthContext';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function PayablesTab() {
  const { user } = useAuth();
  const { payables, deletePayable, vendors, getVendorName } = useCRM();

  const [showForm, setShowForm] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and search
  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      const matchesSearch = !searchTerm ||
        getVendorName(p.vendor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.invoice_reference && p.invoice_reference.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = !statusFilter || p.payment_status === statusFilter;
      const matchesVendor = !vendorFilter || p.vendor_id === vendorFilter;

      return matchesSearch && matchesStatus && matchesVendor;
    });
  }, [payables, searchTerm, statusFilter, vendorFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredPayables.length / itemsPerPage);
  const paginatedPayables = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredPayables.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredPayables, currentPage, itemsPerPage]);

  // Summary
  const summary = useMemo(() => {
    const total = filteredPayables.reduce((sum, p) => sum + p.amount, 0);
    const paid = filteredPayables.reduce((sum, p) => sum + p.amount_paid, 0);
    const outstanding = total - paid;

    return { total, paid, outstanding };
  }, [filteredPayables]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'Overdue':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'Partial':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'Pending':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  const handleDelete = async (payableId: string) => {
    if (window.confirm('Are you sure you want to delete this payable?')) {
      try {
        await deletePayable(payableId);
      } catch (error) {
        alert('Failed to delete payable');
      }
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Payables</p>
          <p className="text-2xl font-bold text-foreground">
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.total)}
          </p>
        </div>
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Paid</p>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.paid)}
          </p>
        </div>
        <div className="glass-card p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">
            {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 0,
            }).format(summary.outstanding)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-card p-4 border border-border space-y-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            placeholder="Search by vendor or invoice reference..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <DollarSign className="w-4 h-4" />
            Create Payable
          </button>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>

          <select
            value={vendorFilter}
            onChange={e => {
              setVendorFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Vendors</option>
            {vendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
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
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vendor</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reference</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Paid</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Balance</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Due Date</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPayables.length > 0 ? (
              paginatedPayables.map(payable => {
                const outstanding = payable.amount - payable.amount_paid;
                return (
                  <tr key={payable.payable_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">
                      {getVendorName(payable.vendor_id)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {payable.invoice_reference || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {new Intl.NumberFormat('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        minimumFractionDigits: 0,
                      }).format(payable.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {new Intl.NumberFormat('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        minimumFractionDigits: 0,
                      }).format(payable.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">
                      {new Intl.NumberFormat('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        minimumFractionDigits: 0,
                      }).format(outstanding)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(payable.payment_status)}`}>
                        {payable.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {payable.due_date}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setSelectedPayable(payable.payable_id)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Record Payment"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(payable.payable_id)}
                          className="p-1.5 rounded hover:bg-red-900/30 transition-colors text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No payables found
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
            Page {currentPage} of {totalPages} ({filteredPayables.length} total)
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

      {/* Forms */}
      {showForm && (
        <PayablesForm
          onClose={() => setShowForm(false)}
          onSuccess={handleRefresh}
          userId={user?.id || ''}
        />
      )}

      {selectedPayable && (() => {
        const foundPayable = payables.find(p => p.payable_id === selectedPayable);
        return foundPayable ? (
          <PayablePaymentModal
            payable={foundPayable}
            onClose={() => setSelectedPayable(null)}
            onSuccess={handleRefresh}
            userId={user?.id || ''}
          />
        ) : null;
      })()}
    </div>
  );
}
