import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pagination } from '@/components/Pagination';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { Plus, X, Search, ArrowRightCircle, Trash2, Download } from 'lucide-react';
import { RFQStatus, RFQPriority } from '@/types/crm';
import { useNavigate } from 'react-router-dom';

const rfqStatusColors: Record<RFQStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  in_progress: 'bg-info/15 text-info',
  quoted: 'bg-warning/15 text-warning',
  converted: 'bg-success/15 text-success',
  lost: 'bg-destructive/15 text-destructive',
};

const priorityColors: Record<RFQPriority, string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const productTypes: ProductType[] = ['DVR', 'SVG', 'AHF', 'Automation', 'Software'];

export default function RFQsPage() {
  const { rfqs, clients, users, supplierInquiries, supplierQuotes, addRFQ, updateRFQStatus, updateRFQPriority, deleteRFQ, getUserName } = useCRM();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [form, setForm] = useState({
    client_id: '', company_name: '', contact_person: '', phone: '', email: '',
    rfq_date: '', assigned_to: user?.id ?? '',
    priority: 'medium' as RFQPriority, status: 'new' as RFQStatus, notes: '',
  });

  const salesUsers = users.filter(u => u.role === 'sales');

  const filtered = rfqs.filter(r => {
    const matchesSearch = r.company_name.toLowerCase().includes(search.toLowerCase()) ||
      r.contact_person.toLowerCase().includes(search.toLowerCase());

    const matchesDateRange = (!fromDate || r.rfq_date >= fromDate) &&
      (!toDate || r.rfq_date <= toDate);

    return matchesSearch && matchesDateRange;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedRFQs = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    const headers = [
      'Company Name', 'Contact Person', 'Phone', 'Email',
      'RFQ Date', 'Status', 'Priority', 'Assigned To',
      'Inquiries Sent', 'Quotes Received',
      'Quoted Price (PKR)', 'Quote Sent Date', 'Quote Expiry Date',
      'Loss Reason', 'Loss Notes', 'Notes',
    ];
    const rows = filtered.map(r => {
      const inquiryCount = supplierInquiries.filter(si => si.rfq_id === r.id).length;
      const quoteCount = supplierQuotes.filter(sq => sq.rfq_id === r.id).length;
      return [
        r.company_name,
        r.contact_person,
        r.phone,
        r.email,
        r.rfq_date,
        r.status.replace(/_/g, ' ').toUpperCase(),
        r.priority.toUpperCase(),
        getUserName(r.assigned_to),
        inquiryCount,
        quoteCount,
        (r as any).quoted_price ?? '',
        (r as any).quote_sent_date ?? '',
        (r as any).quote_expiry_date ?? '',
        (r as any).loss_reason?.replace(/_/g, ' ') ?? '',
        (r as any).loss_notes ?? '',
        r.notes || '',
      ];
    });
    const csv = generateCSV(headers, rows);
    const filename = `RFQs_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setForm(prev => ({
        ...prev,
        client_id: clientId,
        company_name: client.company_name,
        contact_person: client.contact_person,
        phone: client.phone,
        email: client.email,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addRFQ({
      ...form,
      estimated_value: 0,
    });
    setShowForm(false);
    setForm({ client_id: '', company_name: '', contact_person: '', phone: '', email: '', rfq_date: '', assigned_to: user?.id ?? '', priority: 'medium', status: 'new', notes: '' });
  };

  const handleDelete = async (rfqId: string) => {
    try {
      await deleteRFQ(rfqId);
      setShowDeleteConfirm(null);
      alert('RFQ deleted successfully');
    } catch (error) {
      alert('Error deleting RFQ: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RFQs</h1>
          <p className="text-muted-foreground mt-1">{rfqs.length} total RFQs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add RFQ
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search RFQs..."
            className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Company', 'Contact', 'RFQ Date', 'Status', 'Priority', 'Assigned To', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRFQs.map(rfq => (
              <tr key={rfq.id} onClick={() => navigate(`/rfqs/${rfq.id}`)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{rfq.company_name}</td>
                <td className="px-5 py-3 text-sm text-foreground">{rfq.contact_person}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(rfq.rfq_date)}</td>
                <td className="px-5 py-3">
                  <span className={`status-badge capitalize ${rfqStatusColors[rfq.status]}`}>{rfq.status.replace('_', ' ')}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`status-badge capitalize ${priorityColors[rfq.priority]}`}>{rfq.priority}</span>
                </td>
                <td className="px-5 py-3 text-sm text-foreground">{getUserName(rfq.assigned_to)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {rfq.status !== 'converted' && rfq.status !== 'lost' && (
                      <>
                        {rfq.status !== 'quoted' && (
                          <select
                            value={rfq.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={e => {
                              e.stopPropagation();
                              updateRFQStatus(rfq.id, e.target.value as RFQStatus);
                            }}
                            className="text-xs px-2 py-1 bg-muted border border-border rounded text-foreground"
                          >
                            <option value="new">New</option>
                            <option value="in_progress">In Progress</option>
                            <option value="quoted">Quoted</option>
                            <option value="lost">Lost</option>
                          </select>
                        )}
                        {rfq.status === 'quoted' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/rfqs/${rfq.id}`);
                            }}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" /> Convert
                          </button>
                        )}
                        {isAdmin && (
                          <select
                            value={rfq.priority}
                            onClick={(e) => e.stopPropagation()}
                            onChange={e => {
                              e.stopPropagation();
                              updateRFQPriority(rfq.id, e.target.value as RFQPriority);
                            }}
                            className="text-xs px-2 py-1 bg-muted border border-border rounded text-foreground"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        )}
                      </>
                    )}
                    {rfq.converted_order_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/orders/${rfq.converted_order_id}`);
                        }}
                        className="text-xs text-info hover:underline"
                      >
                        View Order
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(rfq.id);
                        }}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                        title="Delete RFQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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

      {/* Add RFQ Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add New RFQ</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Client *</label>
                <select value={form.client_id} onChange={e => handleClientSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
                    <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Contact Person</label>
                    <input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">RFQ Date</label>
                <input type="date" value={form.rfq_date} onChange={e => setForm(p => ({ ...p, rfq_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Assigned To</label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
                  <option value="">Select Sales Person</option>
                  {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as RFQPriority }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add RFQ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete RFQ?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this RFQ? This action cannot be undone.</p>
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

