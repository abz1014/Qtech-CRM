import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';
import { ArrowLeft, Edit2, X, Send, Clock, Award, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPKR, formatDate } from '@/lib/format';

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vendors, supplierInquiries, supplierQuotes, orders, rfqs, updateVendor, deleteVendor } = useCRM();
  const { isAdmin } = useAuth();

  const vendor = vendors.find(v => v.id === id);

  const handleDelete = async () => {
    const oc = orders.filter(o => o.vendor_id === id).length;
    const extra = oc ? ` ${oc} order(s) reference this vendor and will keep their record but lose the vendor link.` : '';
    if (!window.confirm(`Delete vendor "${vendor?.name}"?${extra} This cannot be undone.`)) return;
    try {
      await deleteVendor(id!);
      toast.success('Vendor deleted');
      navigate('/vendors');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete vendor');
    }
  };

  // Supplier intelligence — from existing inquiries/quotes/orders
  const vendorQuotes = useMemo(() => supplierQuotes.filter(q => q.vendor_id === id), [supplierQuotes, id]);
  const intel = useMemo(() => {
    const vendorInquiries = supplierInquiries.filter(i => i.vendor_id === id);
    const vendorOrders = orders.filter(o => o.vendor_id === id);

    // Response rate: quotes given vs inquiries sent
    const responseRate = vendorInquiries.length > 0
      ? Math.round((vendorQuotes.length / vendorInquiries.length) * 100) : null;

    // Avg response time: received_at − matched inquiry sent_at (days)
    const durations: number[] = [];
    vendorQuotes.forEach(q => {
      const inq = vendorInquiries.find(i => i.id === q.inquiry_id)
        ?? vendorInquiries.find(i => i.rfq_id === q.rfq_id);
      if (inq?.sent_at && q.received_at) {
        const d = (new Date(q.received_at).getTime() - new Date(inq.sent_at).getTime()) / 86400000;
        if (!isNaN(d) && d >= 0) durations.push(d);
      }
    });
    const avgResponseDays = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    // Win rate: quotes selected as winner / total quotes
    const won = vendorQuotes.filter(q => q.is_selected).length;
    const winRate = vendorQuotes.length > 0 ? Math.round((won / vendorQuotes.length) * 100) : null;

    // Price competitiveness: on RFQs where this vendor competed against others,
    // how often was their unit price the lowest
    let competedRfqs = 0, cheapestWins = 0;
    const byRfq = new Map<string, typeof supplierQuotes>();
    supplierQuotes.forEach(q => { byRfq.set(q.rfq_id, [...(byRfq.get(q.rfq_id) ?? []), q]); });
    vendorQuotes.forEach(q => {
      const competitors = byRfq.get(q.rfq_id) ?? [];
      if (competitors.length >= 2) {
        competedRfqs++;
        const minPrice = Math.min(...competitors.map(c => c.unit_price));
        if (q.unit_price === minPrice) cheapestWins++;
      }
    });
    const competitiveness = competedRfqs > 0 ? Math.round((cheapestWins / competedRfqs) * 100) : null;

    return {
      inquiriesSent: vendorInquiries.length,
      quotesGiven: vendorQuotes.length,
      responseRate, avgResponseDays, winRate, competitiveness,
      ordersWon: vendorOrders.length,
      ordersValue: vendorOrders.reduce((s, o) => s + (o.order_value || 0), 0),
    };
  }, [supplierInquiries, supplierQuotes, orders, vendorQuotes, id]);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: vendor?.name || '',
    country: vendor?.country || '',
    contact_person: vendor?.contact_person || '',
    phone: vendor?.phone || '',
    email: vendor?.email || '',
    products_supplied: vendor?.products_supplied || '',
  });

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Vendor not found</p>
        <button onClick={() => navigate('/vendors')} className="text-primary mt-2 hover:underline">Back to Vendors</button>
      </div>
    );
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateVendor(id!, {
      name: editForm.name,
      country: editForm.country,
      contact_person: editForm.contact_person,
      phone: editForm.phone,
      email: editForm.email,
      products_supplied: editForm.products_supplied,
    });
    setShowEdit(false);
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/vendors')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Vendors
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
          <p className="text-muted-foreground mt-1">{vendor.country}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Contact Person</p>
              <p className="text-sm text-foreground font-medium">{vendor.contact_person}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-foreground font-medium">{vendor.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground font-medium break-all">{vendor.email}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Business Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Country</p>
              <p className="text-sm text-foreground font-medium">{vendor.country}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Products Supplied</p>
              <p className="text-sm text-foreground font-medium">{vendor.products_supplied}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Supplier Intelligence ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Response Rate</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/15 text-info"><Send className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.responseRate === null ? '—' : `${intel.responseRate}%`}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{intel.quotesGiven}/{intel.inquiriesSent} inquiries answered</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Avg Response Time</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/15 text-warning"><Clock className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.avgResponseDays === null ? '—' : `${intel.avgResponseDays}d`}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Win Rate</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/15 text-success"><Award className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.winRate === null ? '—' : `${intel.winRate}%`}</p>
          {intel.competitiveness !== null && <p className="text-[10px] text-muted-foreground mt-0.5">cheapest {intel.competitiveness}% of the time</p>}
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Orders Won</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15 text-primary"><ShoppingCart className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.ordersWon}</p>
          {intel.ordersValue > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{formatPKR(intel.ordersValue)}</p>}
        </div>
      </div>

      {/* ── Quote History ── */}
      {vendorQuotes.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quote History ({vendorQuotes.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">RFQ</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Received</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Unit Price</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Lead Time</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {vendorQuotes.map(q => {
                  const rfq = rfqs.find(r => r.id === q.rfq_id);
                  return (
                    <tr key={q.id} onClick={() => rfq && navigate(`/rfqs/${rfq.id}`)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="py-2.5">
                        <span className="text-xs font-mono font-semibold text-primary">{rfq?.rfq_number || '—'}</span>
                        {rfq && <span className="text-xs text-muted-foreground ml-1.5">{rfq.company_name}</span>}
                      </td>
                      <td className="py-2.5 text-muted-foreground text-xs">{q.received_at ? formatDate(q.received_at) : '—'}</td>
                      <td className="py-2.5 font-semibold text-foreground">{formatPKR(q.unit_price)}</td>
                      <td className="py-2.5 text-muted-foreground">{q.lead_time_days}d</td>
                      <td className="py-2.5">
                        {q.is_selected
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">✓ WON</span>
                          : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Vendor</h2>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Country</label>
                <input value={editForm.country} onChange={e => setEditForm(p => ({ ...p, country: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contact Person</label>
                <input value={editForm.contact_person} onChange={e => setEditForm(p => ({ ...p, contact_person: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Products Supplied</label>
                <input value={editForm.products_supplied} onChange={e => setEditForm(p => ({ ...p, products_supplied: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
