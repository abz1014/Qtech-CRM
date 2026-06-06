import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { Plus, ArrowLeft, CheckCircle, Edit2, X, ShoppingCart } from 'lucide-react';
import { SupplierInquiryStatus, RFQStatus, RFQPriority, LossReason } from '@/types/crm';
import { AddFollowUpButton } from '@/components/followup/AddFollowUpButton';
import { LossReasonModal } from '@/components/rfq/LossReasonModal';
import { cn } from '@/lib/utils';

const inquiryStatusColors: Record<SupplierInquiryStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  responded: 'bg-success/15 text-success',
  no_response: 'bg-destructive/15 text-destructive',
};

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSales, user } = useAuth();
  const {
    rfqs, vendors, supplierInquiries, supplierQuotes, rfqLineItems, orders, clients, users,
    addSupplierInquiry, addSupplierQuote, updateSupplierQuote, addRFQLineItem, updateRFQLineItem, deleteRFQLineItem, updateSupplierInquiry, updateInquiryStatus,
    getVendorName, updateRFQStatus, updateRFQ, getClientName, addVendor, convertRFQToOrder, getUserName,
    getFollowUpsForEntity,
  } = useCRM();

  const rfq = rfqs.find(r => r.id === id);
  // All orders linked to this RFQ (supports multiple orders per RFQ)
  const linkedOrders = orders.filter(o => o.rfq_id === id);
  const lineItems = rfqLineItems.filter(li => li.rfq_id === id);
  const inquiries = supplierInquiries.filter(si => si.rfq_id === id);
  const quotes = supplierQuotes.filter(sq => sq.rfq_id === id);

  const [viewingText, setViewingText] = useState<{ title: string; content: string } | null>(null);
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<{ id: string; product_type: string; quantity: string; specification: string } | null>(null);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showEditRFQ, setShowEditRFQ] = useState(false);
  const [showConvertOrder, setShowConvertOrder] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null);
  const [editingInquiry, setEditingInquiry] = useState<{ id: string; email_draft: string; sent_at: string } | null>(null);

  const [lineItemForm, setLineItemForm] = useState({
    product_type: '', quantity: '', specification: '',
  });
  const [inquiryForm, setInquiryForm] = useState({ vendor_id: '', email_draft: '' });
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    inquiry_id: '', unit_price: '', lead_time_days: '', moq: '', validity_days: '', notes: '',
  });
  const [editQuoteForm, setEditQuoteForm] = useState({
    unit_price: '', lead_time_days: '', moq: '', validity_days: '', notes: '',
  });
  const [editForm, setEditForm] = useState({
    rfq_number: rfq?.rfq_number || '',
    company_name: rfq?.company_name || '',
    contact_person: rfq?.contact_person || '',
    phone: rfq?.phone || '',
    email: rfq?.email || '',
    rfq_date: rfq?.rfq_date || '',
    priority: rfq?.priority || 'medium' as RFQPriority,
    status: rfq?.status || 'new' as RFQStatus,
    notes: rfq?.notes || '',
  });

  // Per-line-item quote selection (keyed by quote ID so same vendor with multiple quotes works)
  const [itemVendors, setItemVendors] = useState<Record<string, { quote_id: string; vendor_id: string; unit_cost: string }>>({});
  const [convertForm, setConvertForm] = useState({
    order_value: '',   // customer approved amount (incl. margin)
    sales_person_id: user?.id || '',
    notes: '',
    customer_po_number: '',
    customer_po_date: new Date().toISOString().split('T')[0],
    payment_terms_days: '30',
  });
  const [isConverting, setIsConverting] = useState(false);

  if (!rfq) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">RFQ not found</p>
        <button onClick={() => navigate('/rfqs')} className="text-primary mt-2 hover:underline">Back to RFQs</button>
      </div>
    );
  }

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await addRFQLineItem({
      rfq_id: id!,
      product_type: lineItemForm.product_type,
      quantity: Number(lineItemForm.quantity),
      specification: lineItemForm.specification,
      target_price: null,
    });
    setLineItemForm({ product_type: '', quantity: '', specification: '' });
    setShowLineItemForm(false);
  };

  const handleEditLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLineItem) return;
    await updateRFQLineItem(editingLineItem.id, {
      product_type: editingLineItem.product_type,
      quantity: Number(editingLineItem.quantity),
      specification: editingLineItem.specification,
    });
    setEditingLineItem(null);
  };

  const handleDeleteLineItem = async (id: string) => {
    if (!confirm('Delete this line item?')) return;
    await deleteRFQLineItem(id);
  };

  const handleAddInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let vendorId = inquiryForm.vendor_id;

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

      if (!vendorId) {
        console.error('No vendor selected or created');
        return;
      }

      await addSupplierInquiry({
        rfq_id: id!,
        vendor_id: vendorId,
        sent_at: new Date().toISOString(),
        status: 'pending',
        email_draft: inquiryForm.email_draft,
        follow_up_date: null,
      });
      setInquiryForm({ vendor_id: '', email_draft: '' });
      setVendorQuery('');
      setShowInquiryForm(false);
    } catch (error) {
      console.error('Failed to add inquiry:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));

    }
  };

  const handleEditInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInquiry) return;
    await updateSupplierInquiry(editingInquiry.id, {
      email_draft: editingInquiry.email_draft,
      sent_at: editingInquiry.sent_at,
    });
    setEditingInquiry(null);
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const inquiry = inquiries.find(i => i.id === quoteForm.inquiry_id);
    if (!inquiry) return;
    await addSupplierQuote({
      rfq_id: id!,
      vendor_id: inquiry.vendor_id,
      inquiry_id: quoteForm.inquiry_id,
      received_at: new Date().toISOString(),
      unit_price: Number(quoteForm.unit_price),
      currency: 'PKR',
      lead_time_days: Number(quoteForm.lead_time_days),
      moq: Number(quoteForm.moq) || 1,
      validity_days: Number(quoteForm.validity_days),
      notes: quoteForm.notes,
      is_selected: false,
    });
    await updateInquiryStatus(quoteForm.inquiry_id, 'responded');
    setQuoteForm({ inquiry_id: '', unit_price: '', lead_time_days: '', moq: '', validity_days: '', notes: '' });
    setShowQuoteForm(false);
  };

  const handleEditQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuoteId) return;
    await updateSupplierQuote(editingQuoteId, {
      unit_price: Number(editQuoteForm.unit_price),
      lead_time_days: Number(editQuoteForm.lead_time_days),
      moq: Number(editQuoteForm.moq) || 1,
      validity_days: Number(editQuoteForm.validity_days),
      notes: editQuoteForm.notes,
    });
    setEditingQuoteId(null);
    setEditQuoteForm({ unit_price: '', lead_time_days: '', moq: '', validity_days: '', notes: '' });
  };

  const handleEditRFQ = async (e: React.FormEvent) => {
    e.preventDefault();

    // "No open action" guard: warn when marking RFQ as in_progress with no follow-up scheduled
    const statusChangingToInProgress = editForm.status === 'in_progress' && rfq?.status !== 'in_progress';
    if (statusChangingToInProgress && id) {
      const existingActions = await getFollowUpsForEntity('rfq', id);
      const hasOpenAction = existingActions.some(a => a.status === 'pending');
      if (!hasOpenAction) {
        const proceed = confirm(
          '⚠️ No follow-up action is scheduled for this RFQ.\n\nIt\'s recommended to add a follow-up before marking as "In Progress" so no opportunity is missed.\n\nContinue without a follow-up?'
        );
        if (!proceed) return;
      }
    }

    try {
      await updateRFQ(id!, {
        rfq_number: editForm.rfq_number || null,
        company_name: editForm.company_name,
        contact_person: editForm.contact_person,
        phone: editForm.phone,
        email: editForm.email,
        rfq_date: editForm.rfq_date,
        estimated_value: rfq.estimated_value ?? 0,
        priority: editForm.priority,
        notes: editForm.notes,
        status: editForm.status,
        // Empty date strings must be sent as null — Postgres rejects ''
        quote_deadline: (editForm as any).quote_deadline || null,
      } as any);
      setShowEditRFQ(false);
    } catch (error) {
      alert('Failed to update RFQ: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleConvertToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfq || !convertForm.sales_person_id) {
      alert('Please assign a sales person');
      return;
    }
    if (!convertForm.customer_po_number.trim()) {
      alert('Customer PO Number is required');
      return;
    }

    // Validate each line item has a vendor selected
    const itemEntries = Object.entries(itemVendors);
    if (lineItems.length > 0 && itemEntries.length === 0) {
      alert('Please assign a supplier to at least one product');
      return;
    }

    try {
      setIsConverting(true);

      // Build summary: products, vendors, total cost
      const productLabel = lineItems
        .filter(li => itemVendors[li.id]?.vendor_id)
        .map(li => `${li.product_type} ×${li.quantity}`)
        .join(', ');

      const totalCost = lineItems.reduce((sum, li) => {
        const cost = Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity;
        return sum + cost;
      }, 0);

      // Primary vendor = vendor with most items (or first)
      const vendorCounts: Record<string, number> = {};
      lineItems.forEach(li => {
        const v = itemVendors[li.id]?.vendor_id;
        if (v) vendorCounts[v] = (vendorCounts[v] || 0) + 1;
      });
      const primaryVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        || quotes[0]?.vendor_id || '';

      // Build supplier breakdown for notes
      const breakdown = lineItems
        .filter(li => itemVendors[li.id]?.vendor_id)
        .map(li => `• ${li.product_type} ×${li.quantity} — ${getVendorName(itemVendors[li.id].vendor_id)} @ ${formatPKR(Number(itemVendors[li.id].unit_cost || 0))}/unit`)
        .join('\n');

      const fullNotes = `Supplier breakdown:\n${breakdown}${convertForm.notes ? '\n\n' + convertForm.notes : ''}`;

      await convertRFQToOrder(rfq.id, {
        client_id: rfq.client_id,
        vendor_id: primaryVendor,
        order_value: Number(convertForm.order_value),
        product_type: productLabel || 'Multiple Products',
        cost_value: totalCost,
        notes: fullNotes,
        status: 'po_received',
        sales_person_id: convertForm.sales_person_id,
        confirmed_date: new Date().toISOString().split('T')[0],
        customer_po_number: convertForm.customer_po_number.trim(),
        customer_po_date: convertForm.customer_po_date,
        payment_terms_days: Number(convertForm.payment_terms_days) || 30,
      } as any);
      setShowConvertOrder(false);
      setItemVendors({});
    } catch (error) {
      console.error('Failed to convert RFQ to order:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsConverting(false);
    }
  };

  const handleMarkLost = async (reason: LossReason, notes: string) => {
    await updateRFQ(id!, { status: 'lost', loss_reason: reason, loss_notes: notes } as any);
    setShowLossModal(false);
  };

  const cheapestQuote = quotes.length > 0
    ? quotes.reduce((min, q) => q.unit_price < min.unit_price ? q : min)
    : null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/rfqs')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to RFQs
      </button>

      {/* RFQ Header */}
      <div className="flex items-start justify-between">
        <div>
          {rfq.rfq_number && (
            <span className="inline-flex items-center text-xs font-mono font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg mb-2">
              {rfq.rfq_number}
            </span>
          )}
          <h1 className="text-2xl font-bold text-foreground">{rfq.company_name}</h1>
          <p className="text-muted-foreground mt-1">{rfq.contact_person} · {rfq.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {rfq.status !== 'lost' && quotes.length > 0 && (
            <button onClick={() => { setShowConvertOrder(true); setItemVendors({}); }} className="flex items-center gap-1.5 px-3 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors">
              <ShoppingCart className="w-4 h-4" /> Create Order
            </button>
          )}
          {rfq.status !== 'converted' && rfq.status !== 'lost' && (
            <button onClick={() => setShowLossModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">
              Mark as Lost
            </button>
          )}
          <AddFollowUpButton
            entityType="rfq"
            entityId={rfq.id}
            entityLabel={`${rfq.company_name} — ${rfq.notes?.slice(0, 40) || 'RFQ'}`}
          />
          {(isAdmin || isSales) && (
            <button onClick={() => setShowEditRFQ(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          <span className={`status-badge capitalize text-sm ${rfq.status === 'converted' ? 'bg-success/15 text-success' : rfq.status === 'lost' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>
            {rfq.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* RFQ Summary */}
      {(() => {
        const today = new Date().toISOString().split('T')[0];
        const daysToDeadline = rfq.quote_deadline
          ? Math.round((new Date(rfq.quote_deadline).getTime() - new Date(today).getTime()) / 86400000)
          : null;
        const deadlineUrgent = daysToDeadline !== null && daysToDeadline <= 2;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'RFQ Date', value: formatDate(rfq.rfq_date) },
              { label: 'Inquiries Sent', value: inquiries.length },
              { label: 'Quotes Received', value: quotes.length },
            ].map(kpi => (
              <div key={kpi.label} className="glass-card p-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-semibold text-foreground mt-1">{kpi.value}</p>
              </div>
            ))}
            {rfq.quote_deadline && (
              <div className={`p-4 rounded-xl border ${deadlineUrgent ? 'border-destructive/50 bg-destructive/10' : 'glass-card'}`}>
                <p className={`text-xs font-medium ${deadlineUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Quote Deadline {deadlineUrgent ? '🔴' : '📅'}
                </p>
                <p className={`text-lg font-bold mt-1 ${deadlineUrgent ? 'text-destructive' : 'text-foreground'}`}>
                  {formatDate(rfq.quote_deadline)}
                </p>
                {daysToDeadline !== null && (
                  <p className={`text-xs mt-0.5 font-semibold ${deadlineUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {daysToDeadline < 0 ? 'EXPIRED' : daysToDeadline === 0 ? 'Due TODAY' : `${daysToDeadline} day${daysToDeadline > 1 ? 's' : ''} left`}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Linked Orders */}
      {linkedOrders.length > 0 && (
        <div className="glass-card p-5 border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />
            {linkedOrders.length} Order{linkedOrders.length > 1 ? 's' : ''} Created from This RFQ
          </p>
          {linkedOrders.map(o => (
            <div key={o.id} className="flex items-center justify-between py-2 border-t border-primary/10 first:border-0 first:pt-0">
              <div>
                <p className="text-sm font-semibold text-foreground">{o.product_type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getVendorName(o.vendor_id)} · {formatPKR(o.order_value)}
                  <span className={`ml-2 status-badge text-[10px] ${
                    o.status === 'payment_received' ? 'bg-success/15 text-success' :
                    o.status === 'delivered' ? 'bg-success/10 text-success' :
                    'bg-warning/15 text-warning'
                  }`}>{o.status.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <button
                onClick={() => navigate(`/orders/${o.id}`)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                View →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Line Items */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Customer Requirements</h2>
          <button onClick={() => setShowLineItemForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        {lineItems.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium w-32">Product</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium w-16">Qty</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Specification</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(li => (
                <tr key={li.id} className="border-b border-border/50">
                  <td className="py-2.5 font-medium">{li.product_type}</td>
                  <td className="py-2.5">{li.quantity}</td>
                  <td className="py-2.5 text-muted-foreground max-w-xs">
                    <p className="line-clamp-2 text-xs leading-relaxed">{li.specification || '—'}</p>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {li.specification && (
                        <button
                          onClick={() => setViewingText({ title: `${li.product_type} — Specification`, content: li.specification })}
                          className="px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors border border-border"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={() => setEditingLineItem({ id: li.id, product_type: li.product_type, quantity: li.quantity.toString(), specification: li.specification || '' })}
                        className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors border border-primary/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLineItem(li.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors border border-destructive/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No line items yet. Add what the customer needs.</p>
        )}

        {showLineItemForm && (
          <form onSubmit={handleAddLineItem} className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Product Type (e.g. DVR)" value={lineItemForm.product_type}
                onChange={e => setLineItemForm(p => ({ ...p, product_type: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              <input type="number" placeholder="Quantity" value={lineItemForm.quantity}
                onChange={e => setLineItemForm(p => ({ ...p, quantity: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            <input type="text" placeholder="Specification / Details" value={lineItemForm.specification}
              onChange={e => setLineItemForm(p => ({ ...p, specification: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowLineItemForm(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button type="submit"
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add</button>
            </div>
          </form>
        )}
      </div>

      {/* Supplier Inquiries */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Supplier Inquiries</h2>
          <button onClick={() => setShowInquiryForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Contact Supplier
          </button>
        </div>

        {inquiries.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Vendor', 'Sent', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left py-2 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inquiries.map(si => (
                <tr key={si.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{getVendorName(si.vendor_id)}</td>
                  <td className="py-2 text-muted-foreground">{formatDate(si.sent_at)}</td>
                  <td className="py-2">
                    <span className={`status-badge capitalize ${inquiryStatusColors[si.status]}`}>
                      {si.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 flex items-center gap-2">
                    <button onClick={() => setViewingEmailId(si.id)}
                      className="px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors border border-border">
                      View Email
                    </button>
                    <button onClick={() => setEditingInquiry({ id: si.id, email_draft: si.email_draft || '', sent_at: si.sent_at })}
                      className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors border border-primary/20">
                      Edit
                    </button>
                    {si.status === 'pending' && (
                      <>
                        <button onClick={() => updateInquiryStatus(si.id, 'responded')}
                          className="text-xs text-primary hover:underline">
                          Got Response
                        </button>
                        <button onClick={() => updateInquiryStatus(si.id, 'no_response')}
                          className="text-xs text-muted-foreground hover:text-foreground">
                          No Response
                        </button>
                      </>
                    )}
                    {si.status === 'responded' && (
                      <button onClick={() => updateInquiryStatus(si.id, 'pending')}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Back to Pending
                      </button>
                    )}
                    {si.status === 'no_response' && (
                      <button onClick={() => updateInquiryStatus(si.id, 'pending')}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Mark Pending
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No supplier inquiries yet.</p>
        )}

        {showInquiryForm && (
          <form onSubmit={handleAddInquiry} className="border-t border-border pt-4 space-y-3">
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1">Vendor</label>
              <input
                type="text"
                value={vendorQuery}
                onChange={e => { setVendorQuery(e.target.value); setInquiryForm(p => ({ ...p, vendor_id: '' })); setVendorOpen(true); }}
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
                        onMouseDown={(e) => { e.preventDefault(); setInquiryForm(p => ({ ...p, vendor_id: v.id })); setVendorQuery(v.name); setVendorOpen(false); }}
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
            <textarea placeholder="Email Draft (optional)" value={inquiryForm.email_draft}
              onChange={e => setInquiryForm(p => ({ ...p, email_draft: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowInquiryForm(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button type="submit"
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Log Inquiry</button>
            </div>
          </form>
        )}
      </div>

      {/* Supplier Quotes */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Supplier Quotes</h2>
          {inquiries.length > 0 && (
            <button onClick={() => setShowQuoteForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Log Quote
            </button>
          )}
        </div>

        {quotes.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Vendor</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Unit Price</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Lead Time</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">MOQ</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Valid (days)</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Notes</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(sq => (
                <tr key={sq.id} className={`border-b border-border/50 ${cheapestQuote?.id === sq.id ? 'bg-success/5' : ''}`}>
                  <td className="py-2.5 font-medium">
                    <div className="flex items-center gap-1.5">
                      {cheapestQuote?.id === sq.id && (
                        <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      )}
                      {getVendorName(sq.vendor_id)}
                    </div>
                  </td>
                  <td className="py-2.5 font-semibold text-foreground">{formatPKR(sq.unit_price)}</td>
                  <td className="py-2.5 text-muted-foreground">{sq.lead_time_days}d</td>
                  <td className="py-2.5 text-muted-foreground">{sq.moq}</td>
                  <td className="py-2.5 text-muted-foreground">{sq.validity_days}</td>
                  <td className="py-2.5 max-w-[200px]">
                    {sq.notes ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{sq.notes}</p>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {sq.notes && (
                        <button
                          onClick={() => setViewingText({ title: `${getVendorName(sq.vendor_id)} — Quote Notes`, content: sq.notes })}
                          className="px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors border border-border"
                        >
                          View
                        </button>
                      )}
                      <button onClick={() => {
                        setEditingQuoteId(sq.id);
                        setEditQuoteForm({
                          unit_price: sq.unit_price.toString(),
                          lead_time_days: sq.lead_time_days.toString(),
                          moq: sq.moq.toString(),
                          validity_days: sq.validity_days.toString(),
                          notes: sq.notes,
                        });
                      }} className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors border border-primary/20">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {inquiries.length === 0 ? 'Log an inquiry first, then add quotes as responses come in.' : 'No quotes received yet.'}
          </p>
        )}

        {showQuoteForm && (
          <form onSubmit={handleAddQuote} className="border-t border-border pt-4 space-y-3">
            <select value={quoteForm.inquiry_id} onChange={e => setQuoteForm(p => ({ ...p, inquiry_id: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
              <option value="">Which supplier replied?</option>
              {inquiries.map(i => <option key={i.id} value={i.id}>{getVendorName(i.vendor_id)}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Unit Price (PKR)" value={quoteForm.unit_price}
                onChange={e => setQuoteForm(p => ({ ...p, unit_price: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              <input type="number" placeholder="Lead Time (days)" value={quoteForm.lead_time_days}
                onChange={e => setQuoteForm(p => ({ ...p, lead_time_days: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              <input type="number" placeholder="MOQ (min qty)" value={quoteForm.moq}
                onChange={e => setQuoteForm(p => ({ ...p, moq: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input type="number" placeholder="Validity (days)" value={quoteForm.validity_days}
                onChange={e => setQuoteForm(p => ({ ...p, validity_days: e.target.value }))}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            <textarea placeholder="Notes" value={quoteForm.notes}
              onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={2} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowQuoteForm(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button type="submit"
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Quote</button>
            </div>
          </form>
        )}
      </div>

      {/* Edit Inquiry Modal */}
      {editingInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Supplier Inquiry</h2>
              <button onClick={() => setEditingInquiry(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditInquiry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date Sent</label>
                <input
                  type="date"
                  value={editingInquiry.sent_at.split('T')[0]}
                  onChange={e => setEditingInquiry(p => p ? { ...p, sent_at: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email Draft</label>
                <textarea
                  value={editingInquiry.email_draft}
                  onChange={e => setEditingInquiry(p => p ? { ...p, email_draft: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={8}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingInquiry(null)}
                  className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Email Draft Modal */}
      {viewingEmailId && (() => {
        const inquiry = inquiries.find(i => i.id === viewingEmailId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="modal-card max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Email Draft - {getVendorName(inquiry?.vendor_id || '')}</h2>
                <button onClick={() => setViewingEmailId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm text-foreground">
                {inquiry?.email_draft || 'No email draft'}
              </div>
              <div className="flex gap-3 pt-4 justify-end">
                <button onClick={() => setViewingEmailId(null)} className="py-2 px-4 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Quote Modal */}
      {editingQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Quote</h2>
              <button onClick={() => setEditingQuoteId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditQuote} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unit Price (PKR)</label>
                <input type="number" value={editQuoteForm.unit_price} onChange={e => setEditQuoteForm(p => ({ ...p, unit_price: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Lead Time (days)</label>
                  <input type="number" value={editQuoteForm.lead_time_days} onChange={e => setEditQuoteForm(p => ({ ...p, lead_time_days: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">MOQ</label>
                  <input type="number" value={editQuoteForm.moq} onChange={e => setEditQuoteForm(p => ({ ...p, moq: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Validity (days)</label>
                <input type="number" value={editQuoteForm.validity_days} onChange={e => setEditQuoteForm(p => ({ ...p, validity_days: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={editQuoteForm.notes} onChange={e => setEditQuoteForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingQuoteId(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit RFQ Modal */}
      {showEditRFQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit RFQ</h2>
              <button onClick={() => setShowEditRFQ(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditRFQ} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">RFQ Number</label>
                <input
                  value={editForm.rfq_number}
                  onChange={e => setEditForm(p => ({ ...p, rfq_number: e.target.value }))}
                  placeholder="e.g. RFQ-2026-001"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
                <input value={editForm.company_name} onChange={e => setEditForm(p => ({ ...p, company_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contact Person</label>
                <input value={editForm.contact_person} onChange={e => setEditForm(p => ({ ...p, contact_person: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">RFQ Date</label>
                  <input type="date" value={editForm.rfq_date} onChange={e => setEditForm(p => ({ ...p, rfq_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Quote Deadline</label>
                  <input type="date" value={(editForm as any).quote_deadline || ''} onChange={e => setEditForm(p => ({ ...p, quote_deadline: e.target.value } as any))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as RFQStatus }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="quoted">Quoted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                <select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value as RFQPriority }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditRFQ(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert RFQ to Order Modal */}
      {showConvertOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
              <h2 className="text-xl font-bold text-foreground">Convert RFQ to Order</h2>
              <button onClick={() => setShowConvertOrder(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertToOrder} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-foreground">RFQ Details</p>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground font-medium">{getClientName(rfq!.client_id)}</span></div>
                </div>
              </div>

              {/* Per-product supplier + cost mapping */}
              {lineItems.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">Assign Supplier per Product</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Product</th>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium w-16">Qty</th>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Supplier</th>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Unit Cost (Rs)</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map(li => {
                          const iv = itemVendors[li.id] || { quote_id: '', vendor_id: '', unit_cost: '' };
                          const matchingQuote = quotes.find(q => q.id === iv.quote_id);
                          const lineTotal = Number(iv.unit_cost || 0) * li.quantity;
                          return (
                            <tr key={li.id} className="border-b border-border/50">
                              <td className="px-3 py-2.5 font-medium text-foreground">{li.product_type}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{li.quantity}</td>
                              <td className="px-3 py-2.5">
                                <select
                                  value={iv.quote_id}
                                  onChange={e => {
                                    const quoteId = e.target.value;
                                    const selectedQuote = quotes.find(q => q.id === quoteId);
                                    setItemVendors(prev => ({
                                      ...prev,
                                      [li.id]: {
                                        quote_id: quoteId,
                                        vendor_id: selectedQuote?.vendor_id || '',
                                        unit_cost: selectedQuote ? selectedQuote.unit_price.toString() : ''
                                      }
                                    }));
                                  }}
                                  className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                >
                                  <option value="">Select quote...</option>
                                  {quotes.map(q => (
                                    <option key={q.id} value={q.id}>
                                      {getVendorName(q.vendor_id)} — {formatPKR(q.unit_price)}/unit ({q.lead_time_days}d)
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={iv.unit_cost}
                                  onChange={e => setItemVendors(prev => ({
                                    ...prev,
                                    [li.id]: { ...iv, unit_cost: e.target.value }
                                  }))}
                                  className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-foreground">
                                {lineTotal > 0 ? formatPKR(lineTotal) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-muted/30">
                          <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">Total Our Cost</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-foreground">
                            {formatPKR(lineItems.reduce((s, li) => s + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sales Person */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Assign to Sales Person *</label>
                <select
                  value={convertForm.sales_person_id}
                  onChange={(e) => setConvertForm(p => ({ ...p, sales_person_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                >
                  <option value="">Choose a sales person...</option>
                  {users.filter(u => u.role === 'sales' || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Client amount */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Customer Approved Amount (Rs) *</label>
                <p className="text-xs text-muted-foreground mb-2">Total price invoiced to client — incl. your margin on top of supplier costs above</p>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={convertForm.order_value}
                  onChange={(e) => setConvertForm(p => ({ ...p, order_value: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                {convertForm.order_value && lineItems.reduce((s, li) => s + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0) > 0 && (
                  <p className={`text-xs mt-1 font-medium ${Number(convertForm.order_value) > lineItems.reduce((s, li) => s + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0) ? 'text-success' : 'text-destructive'}`}>
                    Margin: {formatPKR(Number(convertForm.order_value) - lineItems.reduce((s, li) => s + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0))}
                    {' '}({((Number(convertForm.order_value) - lineItems.reduce((s, li) => s + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0)) / Number(convertForm.order_value) * 100).toFixed(1)}%)
                  </p>
                )}
              </div>

              {/* PO Details */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Customer PO Details</p>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Customer PO Number *</label>
                  <input type="text" placeholder="e.g. PO-2025-001" value={convertForm.customer_po_number}
                    onChange={(e) => setConvertForm(p => ({ ...p, customer_po_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">PO Date *</label>
                    <input type="date" value={convertForm.customer_po_date}
                      onChange={(e) => setConvertForm(p => ({ ...p, customer_po_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Payment Terms (days)</label>
                    <input type="number" min="0" placeholder="30" value={convertForm.payment_terms_days}
                      onChange={(e) => setConvertForm(p => ({ ...p, payment_terms_days: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Additional Notes</label>
                <textarea value={convertForm.notes} onChange={(e) => setConvertForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConvertOrder(false)} disabled={isConverting}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isConverting}
                  className="flex-1 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-50">
                  {isConverting ? 'Creating Order...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Line Item Modal */}
      {editingLineItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Line Item</h2>
              <button onClick={() => setEditingLineItem(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditLineItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Product Type</label>
                  <input type="text" value={editingLineItem.product_type}
                    onChange={e => setEditingLineItem(p => p ? { ...p, product_type: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
                  <input type="number" value={editingLineItem.quantity}
                    onChange={e => setEditingLineItem(p => p ? { ...p, quantity: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Specification</label>
                <textarea value={editingLineItem.specification}
                  onChange={e => setEditingLineItem(p => p ? { ...p, specification: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={4} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingLineItem(null)}
                  className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit"
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Text Viewer Modal */}
      {viewingText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{viewingText.title}</h2>
              <button onClick={() => setViewingText(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-muted rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {viewingText.content}
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setViewingText(null)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loss Reason Modal */}
      {showLossModal && (
        <LossReasonModal
          rfqTitle={rfq.company_name}
          onConfirm={handleMarkLost}
          onCancel={() => setShowLossModal(false)}
        />
      )}
    </div>
  );
}
