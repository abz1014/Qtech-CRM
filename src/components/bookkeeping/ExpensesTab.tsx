import { useState, useMemo } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { ExpenseCategory } from '@/types/bookkeeping';
import { ExpenseForm } from './ExpenseForm';
import { Pagination } from '@/components/Pagination';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Salaries': 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  'Office Expenses': 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  'Travel': 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  'Equipment': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  'Software Subscriptions': 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200',
  'Utilities': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  'Marketing': 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  'Inventory/Procurement': 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
  'Misc': 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200',
};

export function ExpensesTab() {
  const { expenses, deleteExpense, getVendorName } = useCRM();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || exp.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const paginatedExpenses = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      setDeleteConfirm(null);
    } catch {
      alert('Failed to delete expense');
    }
  };

  const totalExpenses = filtered.reduce((sum, exp) => sum + exp.amount, 0);
  const byCategory = Array.from(
    filtered.reduce((map, exp) => {
      const current = map.get(exp.category) || 0;
      map.set(exp.category, current + exp.amount);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search expenses..."
            className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_COLORS).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="glass-card p-4 border border-border">
        <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
        <p className="text-3xl font-bold text-red-600">
          {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(totalExpenses)}
        </p>
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <div className="glass-card p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-3">By Category</h3>
          <div className="space-y-2">
            {byCategory.map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{cat}</span>
                <span className="font-medium text-foreground">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-x-auto border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Category</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Description</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Vendor</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Amount</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedExpenses.map(exp => (
              <tr key={exp.expense_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-sm text-muted-foreground">{exp.date}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[exp.category as ExpenseCategory]}`}>
                    {exp.category}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm font-medium text-foreground">{exp.description}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{exp.vendor_id ? getVendorName(exp.vendor_id) : '—'}</td>
                <td className="px-5 py-3 text-sm font-medium text-foreground">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(exp.amount)}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setDeleteConfirm(exp.expense_id)}
                    className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedExpenses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No expenses found</div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
      />

      {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSuccess={() => setCurrentPage(1)} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Expense?</h2>
            <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
