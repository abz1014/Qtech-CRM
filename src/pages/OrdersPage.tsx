import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pagination } from '@/components/Pagination';
import { formatPKR } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { Plus, X, Search, Trash2, Download } from 'lucide-react';
import { OrderStatus, ProductType } from '@/types/crm';

const statusColors: Record<string, string> = {
  po_received: 'bg-info/15 text-info',
  procurement: 'bg-warning/15 text-warning',
  in_transit: 'bg-primary/15 text-primary',
  delivered: 'bg-success/15 text-success',
  payment_received: 'bg-emerald-500/15 text-emerald-600',
};

const statusLabels: Record<string, string> = {
  po_received: 'PO Received',
  procurement: 'Procurement',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  payment_received: 'Payment Received',
};

const productTypes: ProductType[] = ['DVR', 'SVG', 'AHF', 'Automation', 'Software'];

export default function OrdersPage() {
  const { orders, clients, vendors, addOrder, addVendor, deleteOrder, getClientName, getVendorName, getUserName } = useCRM();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState({
    client_id: '', vendor_id: '', product_type: 'DVR' as ProductType,
    order_value: '', cost_value: '', status: 'po_received' as OrderStatus, notes: '',
  });

  const filtered = orders.filter(o => {
    const matchesSearch = getClientName(o.client_id).toLowerCase().includes(search.toLowerCase()) ||
      o.product_type.toLowerCase().includes(search.toLowerCase());

    const matchesDateRange = (!fromDate || (o.confirmed_date && o.confirmed_date >= fromDate)) &&
      (!toDate || (o.confirmed_date && o.confirmed_date <= toDate));

    return matchesSearch && matchesDateRange;
  });

  const paginatedOrders = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    const headers = [
      'Client', 'Vendor', 'Product Type', 'Sales Person',
      'Status',
      'Customer Approved Amount (PKR)', 'Our Cost (PKR)', 'Profit (PKR)', 'Margin %',
      'Customer PO Number', 'PO Date',
      'Payment Terms (days)', 'Delivery Date', 'Payment Due Date',
      'Notes',
    ];
    const rows = filtered.map(o => {
      const profit = (o.order_value || 0) - (o.cost_value || 0);
      const margin = o.order_value > 0 ? ((profit / o.order_value) * 100).toFixed(1) + '%' : '0%';
      return [
        getClientName(o.client_id),
        getVendorName(o.vendor_id),
        o.product_type,
        getUserName(o.sales_person_id),
        statusLabels[o.status] || o.status,
        o.order_value || 0,
        o.cost_value || 0,
        profit,
        margin,
        (o as any).customer_po_number || '',
        (o as any).customer_po_date || o.confirmed_date || '',
        (o as any).payment_terms_days ?? '',
        (o as any).delivery_date || '',
        (o as any).payment_due_date || '',
        o.notes || '',
      ];
    });
    const csv = generateCSV(headers, rows);
    const filename = `Orders_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let vendorId = form.vendor_id;

    // Create vendor if typing a new one
    if (!vendorId && vendorQuery.trim()) {
      const existing = vendors.find(v => v.name.toLowerCase() === vendorQuery.trim().toLowerCase());
      if (existing) {
        vendorId = existing.id;
      } else {
        const newVendor = await addVendor({
          name: vendorQuery.trim(),
          country: '',
          contact_person: '',
          phone: '',
          email: '',
          products_supplied: '',
        });
        vendorId = newVendor.id;
      }
    }

    if (!vendorId) return;

    await addOrder({
      client_id: form.client_id,
      vendor_id: vendorId,
      product_type: form.product_type,
      order_value: Number(form.order_value),
      cost_value: Number(form.cost_value) || 0,
      status: form.status,
      notes: form.notes,
      sales_person_id: user?.id ?? '',
      confirmed_date: null,
      rfq_id: null,
    });
    setShowForm(false);
    setForm({ client_id: '', vendor_id: '', product_type: 'DVR', order_value: '', cost_value: '', status: 'po_received', notes: '' });
    setVendorQuery('');
  };

  const handleDelete = async (orderId: string) => {
    try {
      await deleteOrder(orderId);
      setShowDeleteConfirm(null);
      alert('Order deleted successfully');
    } catch (error) {
      alert('Error deleting order: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">{orders.length} total orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Order
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..."
            className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Client', 'Vendor', 'Product', 'Order Value', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="avatar-xs bg-primary/15 text-primary">
                        {getClientName(o.client_id).slice(0,2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{getClientName(o.client_id)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{getVendorName(o.vendor_id)}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{o.product_type}</td>
                  <td className="px-5 py-3 text-sm text-foreground font-semibold">{formatPKR(o.order_value)}</td>
                  <td className="px-5 py-3">
                    <span className={`status-badge ${statusColors[o.status] || 'bg-muted text-muted-foreground'}`}>{statusLabels[o.status] || o.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(o.id);
                        }}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        title="Delete Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Create New Order</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Client</label>
                <select value={form.client_id} onChange={e => setForm(prev => ({ ...prev, client_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-foreground mb-1">Vendor</label>
                <input
                  type="text"
                  value={vendorQuery}
                  onChange={e => { setVendorQuery(e.target.value); setForm(prev => ({ ...prev, vendor_id: '' })); setVendorOpen(true); }}
                  onFocus={() => setVendorOpen(true)}
                  onBlur={() => setTimeout(() => setVendorOpen(false), 150)}
                  placeholder="Type vendor name or select..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                {vendorOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                    {vendors
                      .filter(v => v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
                      .slice(0, 8)
                      .map(v => (
                        <button
                          type="button"
                          key={v.id}
                          onMouseDown={(e) => { e.preventDefault(); setForm(p => ({ ...p, vendor_id: v.id })); setVendorQuery(v.name); setVendorOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground"
                        >
                          {v.name}
                        </button>
                      ))}
                    {vendorQuery.trim() && !vendors.find(v => v.name.toLowerCase() === vendorQuery.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setVendorOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm border-t border-border text-primary hover:bg-muted"
                      >
                        + Create new vendor: "{vendorQuery.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-foreground mb-1">Product Type</label>
                <input
                  type="text"
                  value={form.product_type}
                  onChange={e => { setForm(p => ({ ...p, product_type: e.target.value as ProductType })); setProductOpen(true); }}
                  onFocus={() => setProductOpen(true)}
                  onBlur={() => setTimeout(() => setProductOpen(false), 150)}
                  placeholder="Type or select (e.g. DVR, SVG, custom...)"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                {productOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                    {productTypes
                      .filter(pt => pt.toLowerCase().includes(form.product_type.toLowerCase()))
                      .map(pt => (
                        <button
                          type="button"
                          key={pt}
                          onMouseDown={(e) => { e.preventDefault(); setForm(p => ({ ...p, product_type: pt })); setProductOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground"
                        >
                          {pt}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Order Value (PKR)</label>
                  <input type="number" value={form.order_value} onChange={e => setForm(prev => ({ ...prev, order_value: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Cost Value (PKR)</label>
                  <input type="number" value={form.cost_value} onChange={e => setForm(prev => ({ ...prev, cost_value: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Order?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this order? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
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

