import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { Plus, ArrowLeft, CheckCircle, Edit2, X, ShoppingCart } from 'lucide-react';
import { SupplierInquiryStatus, RFQStatus, RFQPriority, LossReason } from '@/types/crm';
import { SupplierComparisonTable } from '@/components/rfq/SupplierComparisonTable';
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
  const { isAdmin, user } = useAuth();
  const {
    rfqs, vendors, supplierInquiries, supplierQuotes, rfqLineItems, orders, clients, users,
    addSupplierInquiry, addSupplierQuote, updateSupplierQuote, addRFQLineItem, updateInquiryStatus,
    getVendorName, updateRFQStatus, updateRFQ, getClientName, addVendor, convertRFQToOrder, getUserName,
    getFollowUpsForEntity,
  } = useCRM();

  const rfq = rfqs.find(r => r.id === id);
  const order = rfq?.converted_order_id ? orders.find(o => o.id === rfq.converted_order_id) : null;
  const lineItems = rfqLineItems.filter(li => li.rfq_id === id);
  const inquiries = supplierInquiries.filter(si => si.rfq_id === id);
  const quotes = supplierQuotes.filter(sq => sq.rfq_id === id);

  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showEditRFQ, setShowEditRFQ] = useState(false);
  const [showConvertOrder, setShowConvertOrder] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null);

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
    company_name: rfq?.company_name || '',
    contact_person: rfq?.contact_person || '',
    phone: rfq?.phone || '',
    email: rfq?.email || '',
    rfq_date: rfq?.rfq_date || '',
    priority: rfq?.priority || 'medium' as RFQPriority,
    status: rfq?.status || 'new' as RFQStatus,
    notes: rfq?.notes || '',
  });

  const [convertForm, setConvertForm] = useState({
    vendor_id: quotes.length > 0 ? quotes[0].vendor_id : '',
    order_value: '',   // customer approved amount (incl. margin)
    cost_value: '',    // our cost from supplier (excl. margin)
    product_type: '',
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

    await updateRFQ(id!, {
      company_name: editForm.company_name,
      contact_person: editForm.contact_person,
      phone: editForm.phone,
      email: editForm.email,
      rfq_date: editForm.rfq_date,
      estimated_value: 0,
      priority: editForm.priority,
      notes: editForm.notes,
      status: editForm.status,
    });
    setShowEditRFQ(false);
  };

  const handleConvertToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertForm.vendor_id || !rfq || !convertForm.sales_person_id) {
      alert('Please select a vendor and sales person');
      return;
    }

    if (!convertForm.customer_po_number.trim()) {
      alert('Customer PO Number is required');
      return;
    }

    try {
      setIsConverting(true);
      await convertRFQToOrder(rfq.id, {
        client_id: rfq.client_id,
        vendor_id: convertForm.vendor_id,
        order_value: Number(convertForm.order_value),
        product_type: convertForm.product_type,
        cost_value: Number(convertForm.cost_value) || 0,
        notes: convertForm.notes,
        status: 'po_received',
        sales_person_id: convertForm.sales_person_id,
        confirmed_date: new Date().toISOString().split('T')[0],
        customer_po_number: convertForm.customer_po_number.trim(),
        customer_po_date: convertForm.customer_po_date,
        payment_terms_days: Number(convertForm.payment_terms_days) || 30,
      } as any);
      setShowConvertOrder(false);
      navigate('/orders');
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
          <h1 className="text-2xl font-bold text-foreground">{rfq.company_name}</h1>
          <p className="text-muted-foreground mt-1">{rfq.contact_person} · {rfq.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {rfq.status !== 'converted' && rfq.status !== 'lost' && quotes.length > 0 && (
            <button onClick={() => setShowConvertOrder(true)} className="flex items-center gap-1 px-3 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors">
              <ShoppingCart className="w-4 h-4" /> Convert to Order
            </button>
          )}
          {rfq.status !== 'converted' && rfq.status !== 'lost' && (
            <button onClick={() => setShowLossModal(true)} className="flex items-center gap-1 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">
              Mark as Lost
            </button>
          )}
          <AddFollowUpButton
            entityType="rfq"
            entityId={rfq.id}
            entityLabel={`${rfq.company_name} — ${rfq.notes?.slice(0, 40) || 'RFQ'}`}
          />
          {isAdmin && (
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
      </div>

      {/* Related Order */}
      {order && (
        <div className="glass-card p-5 border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">📦 Order Created from This RFQ</p>
              <p className="text-sm font-semibold text-foreground">{getClientName(order.client_id)}</p>
              <p className="text-xs text-muted-foreground mt-1">{order.product_type} • {formatPKR(order.order_value)}</p>
            </div>
            <button
              onClick={() => navigate(`/orders/${order.id}`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Order →
            </button>
          </div>
        </div>
      )}

      {/* Quote Comparison (only show when there are quotes) */}
      {quotes.length > 1 && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Quote Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Vendor</th>
                  <th className="text-right py-2 px-3">Unit Price</th>
                  <th className="text-center py-2 px-3">Lead Time</th>
                  <th className="text-center py-2 px-3">MOQ</th>
                  <th className="text-center py-2 px-3">Valid (days)</th>
                  <th className="text-center py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {[...quotes].sort((a, b) => a.unit_price - b.unit_price).map(sq => (
                  <tr key={sq.id} className={`border-b border-border/50 ${cheapestQuote?.id === sq.id ? 'bg-success/5' : ''}`}>
                    <td className="py-2 px-3 font-medium">{getVendorName(sq.vendor_id)}</td>
                    <td className="py-2 px-3 text-right font-semibold">{formatPKR(sq.unit_price)}</td>
                    <td className="py-2 px-3 text-center">{sq.lead_time_days}d</td>
                    <td className="py-2 px-3 text-center">{sq.moq}</td>
                    <td className="py-2 px-3 text-center">{sq.validity_days}</td>
                    <td className="py-2 px-3 text-center">
                      {cheapestQuote?.id === sq.id && (
                        <span className="text-xs text-success font-medium flex items-center gap-1 justify-center">
                          <CheckCircle className="w-3 h-3" /> Best Price
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Product</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Qty</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Specification</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(li => (
                <tr key={li.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{li.product_type}</td>
                  <td className="py-2">{li.quantity}</td>
                  <td className="py-2 text-muted-foreground">{li.specification}</td>
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
                  <td className="py-2 space-x-2 flex items-center">
                    <button onClick={() => setViewingEmailId(si.id)}
                      className="text-xs text-info hover:underline">
                      View Email
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
                {['Vendor', 'Unit Price', 'Lead Time', 'MOQ', 'Valid (days)', 'Notes', 'Action'].map(h => (
                  <th key={h} className="text-left py-2 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map(sq => (
                <tr key={sq.id} className={`border-b border-border/50 ${cheapestQuote?.id === sq.id ? 'bg-success/5' : ''}`}>
                  <td className="py-2 font-medium">{getVendorName(sq.vendor_id)}</td>
                  <td className="py-2 font-semibold text-foreground">{formatPKR(sq.unit_price)}</td>
                  <td className="py-2">{sq.lead_time_days} days</td>
                  <td className="py-2">{sq.moq}</td>
                  <td className="py-2">{sq.validity_days}</td>
                  <td className="py-2 text-muted-foreground text-xs">{sq.notes}</td>
                  <td className="py-2">
                    <button onClick={() => {
                      setEditingQuoteId(sq.id);
                      setEditQuoteForm({
                        unit_price: sq.unit_price.toString(),
                        lead_time_days: sq.lead_time_days.toString(),
                        moq: sq.moq.toString(),
                        validity_days: sq.validity_days.toString(),
                        notes: sq.notes,
                      });
                    }} className="text-xs text-primary hover:underline">
                      Edit
                    </button>
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

        {/* Supplier Comparison Engine */}
        {quotes.length > 1 && (
          <div className="border-t border-border pt-6 mt-6">
            <SupplierComparisonTable rfqId={id!} onRecommendationChange={() => window.location.reload()} />
          </div>
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

      {/* View Email Draft Modal */}
      {viewingEmailId && (() => {
        const inquiry = inquiries.find(i => i.id === viewingEmailId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit RFQ</h2>
              <button onClick={() => setShowEditRFQ(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditRFQ} className="space-y-3">
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">RFQ Date</label>
                <input type="date" value={editForm.rfq_date} onChange={e => setEditForm(p => ({ ...p, rfq_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select Vendor *</label>
                <select
                  value={convertForm.vendor_id}
                  onChange={(e) => setConvertForm(p => ({ ...p, vendor_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                >
                  <option value="">Choose a vendor...</option>
                  {quotes.map(q => (
                    <option key={q.vendor_id} value={q.vendor_id}>
                      {getVendorName(q.vendor_id)} • {formatPKR(q.unit_price)}/unit
                    </option>
                  ))}
                </select>
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Customer Approved Amount (Rs) *</label>
                  <p className="text-xs text-muted-foreground mb-1">Total price invoiced to client (incl. margin)</p>
                  <input
                    type="number"
                    placeholder="e.g. 500000"
                    value={convertForm.order_value}
                    onChange={(e) => setConvertForm(p => ({ ...p, order_value: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Our Cost from Supplier (Rs) *</label>
                  <p className="text-xs text-muted-foreground mb-1">What we pay supplier (excl. margin)</p>
                  <input
                    type="number"
                    placeholder="e.g. 400000"
                    value={convertForm.cost_value}
                    onChange={(e) => setConvertForm(p => ({ ...p, cost_value: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Product Type *</label>
                <input
                  type="text"
                  placeholder="e.g., DVR, SVG, AHF, Software, etc."
                  value={convertForm.product_type}
                  onChange={(e) => setConvertForm(p => ({ ...p, product_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              {/* PO Details */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground mb-3">Customer PO Details</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Customer PO Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2025-001"
                      value={convertForm.customer_po_number}
                      onChange={(e) => setConvertForm(p => ({ ...p, customer_po_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">PO Date *</label>
                      <input
                        type="date"
                        value={convertForm.customer_po_date}
                        onChange={(e) => setConvertForm(p => ({ ...p, customer_po_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Payment Terms (days)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 30"
                        value={convertForm.payment_terms_days}
                        onChange={(e) => setConvertForm(p => ({ ...p, payment_terms_days: e.target.value }))}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
                <textarea
                  value={convertForm.notes}
                  onChange={(e) => setConvertForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConvertOrder(false)}
                  disabled={isConverting}
                  className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="flex-1 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  {isConverting ? 'Creating Order...' : 'Create Order'}
                </button>
              </div>
            </form>
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
