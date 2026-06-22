import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pagination } from '@/components/Pagination';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { Plus, X, Search, ArrowRightCircle, Trash2, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { RFQStatus, RFQPriority } from '@/types/crm';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { TableSkeleton } from '@/components/ui/skeleton';
import { lossReasonLabel, lossReasonIcon } from '@/lib/lossReasons';

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

export default function RFQsPage() {
  const { rfqs, clients, users, supplierInquiries, supplierQuotes, rfqLineItems, addRFQ, updateRFQStatus, updateRFQPriority, deleteRFQ, getUserName, loading } = useCRM();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc'); // newest first by default
  const [tab, setTab] = useState<'all' | 'lost'>('all');

  const [form, setForm] = useState({
    rfq_number: '', client_id: '', company_name: '', contact_person: '', phone: '', email: '',
    rfq_date: '', assigned_to: user?.id ?? '',
    priority: 'medium' as RFQPriority, status: 'new' as RFQStatus, notes: '',
    quote_deadline: '',
  });

  // All hooks MUST be called before any early return
  const salesUsers = useMemo(() => users.filter(u => u.role === 'sales'), [users]);
  const debouncedSearch = useDebounce(search);
  const filtered = useMemo(() => {
    const list = rfqs.filter(r => {
      const matchesSearch = r.company_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        r.contact_person.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (r.rfq_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false);
      const matchesDateRange = (!fromDate || r.rfq_date >= fromDate) &&
        (!toDate || r.rfq_date <= toDate);
      return matchesSearch && matchesDateRange;
    });
    return [...list].sort((a, b) =>
      sortDir === 'desc' ? b.rfq_date.localeCompare(a.rfq_date) : a.rfq_date.localeCompare(b.rfq_date)
    );
  }, [rfqs, debouncedSearch, fromDate, toDate, sortDir]);

  // ── Lost RFQ analysis ──────────────────────────────────────────────────────
  const lostRFQs = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return rfqs
      .filter(r => r.status === 'lost')
      .filter(r => !q ||
        r.company_name.toLowerCase().includes(q) ||
        (r.rfq_number?.toLowerCase().includes(q) ?? false) ||
        ((r as any).loss_notes?.toLowerCase().includes(q) ?? false))
      .sort((a, b) => b.rfq_date.localeCompare(a.rfq_date));
  }, [rfqs, debouncedSearch]);

  const lostMetrics = useMemo(() => {
    const lost = rfqs.filter(r => r.status === 'lost');
    const converted = rfqs.filter(r => r.status === 'converted');
    const closed = lost.length + converted.length;
    const winRate = closed > 0 ? Math.round((converted.length / closed) * 100) : 0;

    const preventable = lost.filter(r =>
      (r as any).loss_reason === 'poor_follow_up' || (r as any).loss_reason === 'delivery_too_slow'
    ).length;

    // Avg response time: RFQ date → quote sent date (only for RFQs that have been quoted)
    const quotedRfqs = rfqs.filter(r => (r as any).quote_sent_date && r.rfq_date);
    let avgResponseDays = 0;
    if (quotedRfqs.length > 0) {
      const totalDays = quotedRfqs.reduce((sum, r) => {
        const diff = (new Date((r as any).quote_sent_date).getTime() - new Date(r.rfq_date).getTime()) / 86400000;
        return sum + Math.max(0, diff);
      }, 0);
      avgResponseDays = Math.round(totalDays / quotedRfqs.length);
    }

    const pendingQuotes = rfqs.filter(r => r.status === 'quoted').length;

    // Top reason
    const counts: Record<string, number> = {};
    lost.forEach(r => {
      const reason = (r as any).loss_reason;
      if (reason) counts[reason] = (counts[reason] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    return {
      count: lost.length,
      winRate,
      avgResponseDays,
      pendingQuotes,
      preventable,
      topReason: top ? { reason: top[0], n: top[1] } : null,
    };
  }, [rfqs]);

  if (loading) return <TableSkeleton cols={7} rows={8} headers={['RFQ #', 'Company', 'Products', 'RFQ Date', 'Status', 'Priority', 'Assigned To']} />;

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedRFQs = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    const headers = [
      'Company Name', 'Contact Person', 'Phone', 'Email',
      'RFQ Date', 'Quote Deadline', 'Status', 'Priority', 'Assigned To',
      'Inquiries Sent', 'Quotes Received',
      'Quoted Price (PKR)', 'Quote Sent Date', 'Quote Expiry Date', 'Expired',
      'Loss Reason', 'Loss Notes', 'Notes',
    ];
    const today = new Date().toISOString().split('T')[0];
    const rows = filtered.map(r => {
      const inquiryCount = supplierInquiries.filter(si => si.rfq_id === r.id).length;
      const quoteCount = supplierQuotes.filter(sq => sq.rfq_id === r.id).length;
      const expiry = (r as any).quote_expiry_date || '';
      const isExpired = expiry && expiry < today ? 'Yes' : expiry ? 'No' : '';
      return [
        r.company_name,
        r.contact_person,
        r.phone,
        r.email,
        r.rfq_date,
        r.quote_deadline || '',
        r.status.replace(/_/g, ' ').toUpperCase(),
        r.priority.toUpperCase(),
        getUserName(r.assigned_to),
        inquiryCount,
        quoteCount,
        (r as any).quoted_price ?? '',
        (r as any).quote_sent_date ?? '',
        expiry,
        isExpired,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRFQ({
        ...form,
        estimated_value: 0,
        // Empty date strings must be sent as null — Postgres rejects ''
        quote_deadline: form.quote_deadline || null,
      } as any);
      setShowForm(false);
      setForm({ rfq_number: '', client_id: '', company_name: '', contact_person: '', phone: '', email: '', rfq_date: '', assigned_to: user?.id ?? '', priority: 'medium', status: 'new', notes: '', quote_deadline: '' });
    } catch (error) {
      alert('Failed to add RFQ: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => { setTab('all'); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          All RFQs
        </button>
        <button
          onClick={() => { setTab('lost'); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === 'lost' ? 'border-destructive text-destructive' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Lost Deals
          {lostMetrics.count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">{lostMetrics.count}</span>
          )}
        </button>
      </div>

      {tab === 'lost' ? (
        <LostDealsView
          lostRFQs={lostRFQs}
          metrics={lostMetrics}
          search={search}
          setSearch={setSearch}
          getUserName={getUserName}
          navigate={navigate}
        />
      ) : (
      <>
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
              {['RFQ #', 'Company', 'Products'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                <button
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  RFQ Date
                  {sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                </button>
              </th>
              {['Status', 'Priority', 'Assigned To', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRFQs.map(rfq => {
              const today = new Date().toISOString().split('T')[0];
              const daysToDeadline = rfq.quote_deadline
                ? Math.round((new Date(rfq.quote_deadline).getTime() - new Date(today).getTime()) / 86400000)
                : null;
              const isExpiring = daysToDeadline !== null && daysToDeadline <= 2 && rfq.status !== 'converted' && rfq.status !== 'lost';
              const rowHighlight = rfq.status === 'converted'
                ? 'border-l-4 border-l-success border-b border-b-border/50 bg-success/10 hover:bg-success/15'
                : rfq.status === 'quoted' && isExpiring
                  ? 'border-l-4 border-l-warning border-b border-b-border/50 bg-warning/5 hover:bg-warning/10'
                  : isExpiring
                    ? 'border-l-4 border-l-destructive border-b border-b-border/50 bg-destructive/5 hover:bg-destructive/10'
                    : 'border-l-4 border-l-transparent border-b border-b-border/50 hover:bg-muted/30';
              return (
              <tr key={rfq.id} onClick={() => navigate(`/rfqs/${rfq.id}`)}
                className={`border-b cursor-pointer transition-colors ${rowHighlight}`}>
                <td className="px-5 py-3">
                  <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                    {rfq.rfq_number || '—'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="avatar-xs bg-info/15 text-info">
                      {rfq.company_name.slice(0,2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground">{rfq.company_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {(() => {
                    const items = rfqLineItems.filter(li => li.rfq_id === rfq.id);
                    if (items.length === 0) return <span className="text-sm text-muted-foreground italic">No items</span>;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {items.slice(0, 3).map(li => (
                          <span key={li.id} className="text-[11px] font-medium bg-info/10 text-foreground px-1.5 py-0.5 rounded">{li.product_type}{li.quantity > 1 ? ` ×${li.quantity}` : ''}</span>
                        ))}
                        {items.length > 3 && <span className="text-[10px] text-muted-foreground">+{items.length - 3} more</span>}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    <span>{formatDate(rfq.rfq_date)}</span>
                    {rfq.quote_deadline && rfq.status !== 'converted' && (
                      <span className={`text-[10px] font-semibold flex items-center gap-1 ${isExpiring ? (rfq.status === 'quoted' ? 'text-warning' : 'text-destructive') : 'text-muted-foreground'}`}>
                        {isExpiring ? (rfq.status === 'quoted' ? '🟡' : '🔴') : '📅'} Deadline: {formatDate(rfq.quote_deadline)}
                        {daysToDeadline !== null && daysToDeadline <= 2 && daysToDeadline >= 0 && rfq.status !== 'lost' && (
                          <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${rfq.status === 'quoted' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'}`}>
                            {daysToDeadline === 0 ? 'TODAY' : `${daysToDeadline}d left`}
                          </span>
                        )}
                        {daysToDeadline !== null && daysToDeadline < 0 && rfq.status !== 'lost' && (
                          <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${rfq.status === 'quoted' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'}`}>EXPIRED</span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={`status-badge capitalize w-fit ${rfqStatusColors[rfq.status]}`}>{rfq.status.replace('_', ' ')}</span>
                    {rfq.status === 'lost' && (rfq as any).loss_reason && (
                      <span className="text-[10px] font-medium text-destructive flex items-center gap-1 max-w-[180px]">
                        {lossReasonIcon((rfq as any).loss_reason)} {lossReasonLabel((rfq as any).loss_reason)}
                      </span>
                    )}
                  </div>
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
              );
            })}
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
      </>
      )}

      {/* Add RFQ Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add New RFQ</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">RFQ Number *</label>
                <input
                  type="text"
                  placeholder="e.g. RFQ-2026-001"
                  value={form.rfq_number}
                  onChange={e => setForm(p => ({ ...p, rfq_number: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  required
                />
              </div>
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
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">RFQ Date</label>
                  <input type="date" value={form.rfq_date} onChange={e => setForm(p => ({ ...p, rfq_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Quote Deadline
                    <span className="text-muted-foreground font-normal text-xs ml-1">(client's last date)</span>
                  </label>
                  <input type="date" value={form.quote_deadline} onChange={e => setForm(p => ({ ...p, quote_deadline: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-sm p-6">
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

// ─── Lost Deals View ──────────────────────────────────────────────────────────
function LostDealsView({ lostRFQs, metrics, search, setSearch, getUserName, navigate }: {
  lostRFQs: any[];
  metrics: { count: number; winRate: number; avgResponseDays: number; pendingQuotes: number; preventable: number; topReason: { reason: string; n: number } | null };
  search: string;
  setSearch: (s: string) => void;
  getUserName: (id: string) => string;
  navigate: (path: string) => void;
}) {
  const [viewNote, setViewNote] = useState<{ company: string; note: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const paginatedLost = lostRFQs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-5">
      {/* Metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`glass-card p-5 border-l-4 ${metrics.winRate >= 50 ? 'border-success' : 'border-warning'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Rate</p>
          <p className={`text-3xl font-extrabold mt-1 tracking-tight ${metrics.winRate >= 50 ? 'text-success' : 'text-warning'}`}>{metrics.winRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{metrics.count} lost deals total</p>
        </div>
        <div className={`glass-card p-5 border-l-4 ${metrics.avgResponseDays <= 3 ? 'border-success' : metrics.avgResponseDays <= 7 ? 'border-warning' : 'border-destructive'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg Response Time</p>
          <p className={`text-3xl font-extrabold mt-1 tracking-tight ${metrics.avgResponseDays <= 3 ? 'text-success' : metrics.avgResponseDays <= 7 ? 'text-warning' : 'text-destructive'}`}>{metrics.avgResponseDays}d</p>
          <p className="text-xs text-muted-foreground mt-1">RFQ received → quote sent</p>
        </div>
        <div className={`glass-card p-5 border-l-4 ${metrics.pendingQuotes > 0 ? 'border-info' : 'border-muted'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Quotes</p>
          <p className={`text-3xl font-extrabold mt-1 tracking-tight ${metrics.pendingQuotes > 0 ? 'text-info' : 'text-muted-foreground'}`}>{metrics.pendingQuotes}</p>
          <p className="text-xs text-muted-foreground mt-1">awaiting client decision</p>
        </div>
        <div className={`glass-card p-5 border-l-4 ${metrics.preventable > 0 ? 'border-warning' : 'border-success'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preventable Losses</p>
          <p className={`text-3xl font-extrabold mt-1 tracking-tight ${metrics.preventable > 0 ? 'text-warning' : 'text-success'}`}>{metrics.preventable}</p>
          <p className="text-xs text-muted-foreground mt-1">poor follow-up or too slow</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by company, RFQ #, or notes..."
          className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {/* Lost RFQ table */}
      <div className="glass-card overflow-x-auto">
        {lostRFQs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">No lost deals{search ? ' match your search' : ' — keep it up! 🎉'}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Company', 'RFQ #', 'Value', 'Reason', 'What Happened', 'Lost By', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedLost.map(r => (
                <tr key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{r.company_name}</td>
                  <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{r.rfq_number || '—'}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-destructive">{formatPKR(r.estimated_value || 0)}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      {lossReasonIcon(r.loss_reason)} {lossReasonLabel(r.loss_reason)}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-[280px]">
                    {r.loss_notes ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground line-clamp-1">{r.loss_notes}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewNote({ company: r.company_name, note: r.loss_notes }); }}
                          className="text-xs text-primary hover:underline flex-shrink-0 whitespace-nowrap"
                        >
                          Read
                        </button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground italic">No notes</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{getUserName(r.assigned_to)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(r.rfq_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={lostRFQs.length}
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

      {/* Notes popup */}
      {viewNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewNote(null)}>
          <div className="modal-card max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Why we lost — {viewNote.company}</h2>
              <button onClick={() => setViewNote(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted rounded-lg p-4">{viewNote.note}</p>
            <div className="flex justify-end pt-4">
              <button onClick={() => setViewNote(null)} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

