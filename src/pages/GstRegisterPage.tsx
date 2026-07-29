import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { businessToday } from '@/lib/dates';
import { toast } from 'sonner';
import {
  FileText, Plus, X, Search, Pencil, Trash2, AlertTriangle, CheckCircle,
  Link2, Download, Receipt, Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/Pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { GstInvoice, FbrStatus, CreateGstInvoiceInput } from '@/types/bookkeeping';
import { FBR_STATUSES } from '@/types/bookkeeping';
import { needsFbrAttention as fbrNeedsAttention } from '@/lib/gst/fbr';

const FBR_BADGE: Record<FbrStatus, string> = {
  'Pending':          'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Generated':        'bg-info/15 text-info',
  'Fully Generated':  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'Receipt Received': 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'Deposited':        'bg-success/15 text-success',
};

const currentMonth = () => businessToday().slice(0, 7);

// A prior-month invoice whose sales tax isn't deposited yet needs chasing.
const needsFbrAttention = (g: GstInvoice): boolean => fbrNeedsAttention(g, currentMonth());

type FormState = {
  order_id: string;
  gst_invoice_number: string; invoice_date: string; client_name: string; supplier_company: string;
  customer_po_number: string; item_name: string; item_number: string; product_detail: string;
  delivery_challan_number: string; amount: string; gst_amount: string;
  received_date: string; tcs_sent_date: string; tcs_receipt_number: string; tcs_receipt_date: string; client_received_date: string;
  fbr_status: FbrStatus; wasif_receipt_received: boolean; wasif_receipt_date: string; psid: string;
  tax_deposit_date: string; tax_deposit_amount: string; tax_deposit_bank: string; notes: string;
};

const blankForm = (): FormState => ({
  order_id: '', gst_invoice_number: '', invoice_date: businessToday(), client_name: '', supplier_company: '',
  customer_po_number: '', item_name: '', item_number: '', product_detail: '',
  delivery_challan_number: '', amount: '', gst_amount: '',
  received_date: '', tcs_sent_date: '', tcs_receipt_number: '', tcs_receipt_date: '', client_received_date: '',
  fbr_status: 'Pending', wasif_receipt_received: false, wasif_receipt_date: '', psid: '',
  tax_deposit_date: '', tax_deposit_amount: '', tax_deposit_bank: '', notes: '',
});

const fromInvoice = (g: GstInvoice): FormState => ({
  order_id: g.order_id || '', gst_invoice_number: g.gst_invoice_number, invoice_date: g.invoice_date,
  client_name: g.client_name, supplier_company: g.supplier_company, customer_po_number: g.customer_po_number,
  item_name: g.item_name, item_number: g.item_number, product_detail: g.product_detail,
  delivery_challan_number: g.delivery_challan_number, amount: g.amount ? String(g.amount) : '', gst_amount: g.gst_amount ? String(g.gst_amount) : '',
  received_date: g.received_date, tcs_sent_date: g.tcs_sent_date, tcs_receipt_number: g.tcs_receipt_number,
  tcs_receipt_date: g.tcs_receipt_date, client_received_date: g.client_received_date,
  fbr_status: g.fbr_status, wasif_receipt_received: g.wasif_receipt_received, wasif_receipt_date: g.wasif_receipt_date,
  psid: g.psid, tax_deposit_date: g.tax_deposit_date, tax_deposit_amount: g.tax_deposit_amount ? String(g.tax_deposit_amount) : '',
  tax_deposit_bank: g.tax_deposit_bank, notes: g.notes || '',
});

const toInput = (f: FormState): CreateGstInvoiceInput => ({
  order_id: f.order_id || null,
  gst_invoice_number: f.gst_invoice_number.trim(), invoice_date: f.invoice_date, client_name: f.client_name.trim(),
  supplier_company: f.supplier_company.trim(), customer_po_number: f.customer_po_number.trim(),
  item_name: f.item_name.trim(), item_number: f.item_number.trim(), product_detail: f.product_detail.trim(),
  delivery_challan_number: f.delivery_challan_number.trim(), amount: parseFloat(f.amount) || 0, gst_amount: parseFloat(f.gst_amount) || 0,
  received_date: f.received_date, tcs_sent_date: f.tcs_sent_date, tcs_receipt_number: f.tcs_receipt_number.trim(),
  tcs_receipt_date: f.tcs_receipt_date, client_received_date: f.client_received_date,
  fbr_status: f.fbr_status, wasif_receipt_received: f.wasif_receipt_received, wasif_receipt_date: f.wasif_receipt_date,
  psid: f.psid.trim(), tax_deposit_date: f.tax_deposit_date, tax_deposit_amount: parseFloat(f.tax_deposit_amount) || 0,
  tax_deposit_bank: f.tax_deposit_bank.trim(), notes: f.notes.trim() || null,
});

export default function GstRegisterPage() {
  const { gstInvoices, orders, addGstInvoice, updateGstInvoice, deleteGstInvoice, getClientName, getVendorName, loading } = useCRM();
  const { user } = useAuth();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [fbrFilter, setFbrFilter] = useState<FbrStatus | 'all' | 'attention'>('all');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [detail, setDetail] = useState<GstInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const productLabel = (o: typeof orders[number]) => (typeof o.product_type === 'string' ? o.product_type : '');

  // Orders matching the picker query — search by PO number, product, client or invoice #.
  // Most-recent orders (by PO date) surface first; capped so the list stays scannable.
  const orderMatches = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return [...orders]
      .filter(o => {
        if (!q) return true;
        return [o.customer_po_number, productLabel(o), getClientName(o.client_id), o.invoice_number]
          .some(v => (v || '').toLowerCase().includes(q));
      })
      .sort((a, b) => (b.customer_po_date || b.confirmed_date || '').localeCompare(a.customer_po_date || a.confirmed_date || ''))
      .slice(0, 12);
  }, [orders, orderQuery, getClientName]);

  const linkedOrder = form.order_id ? orders.find(o => o.id === form.order_id) : undefined;

  // Live GST consistency check. `amount` is GST-inclusive, so at the standard 18%
  // the tax should be amount × 18/118. Warn (never block) when the typed GST drifts.
  const amtNum = parseFloat(form.amount) || 0;
  const gstNum = parseFloat(form.gst_amount) || 0;
  const expectedGst = amtNum > 0 ? Math.round((amtNum * 18) / 118) : 0;
  const netExcl = amtNum - gstNum;
  const gstMismatch = amtNum > 0 && gstNum > 0 && Math.abs(gstNum - expectedGst) > 2;

  // Selecting an order pre-fills the identity fields from the CRM.
  const applyOrder = (orderId: string) => {
    const o = orders.find(x => x.id === orderId);
    if (!o) { set('order_id', ''); return; }
    setForm(prev => ({
      ...prev,
      order_id: o.id,
      client_name: getClientName(o.client_id) || prev.client_name,
      supplier_company: getVendorName(o.vendor_id) || prev.supplier_company,
      customer_po_number: o.customer_po_number || prev.customer_po_number,
      item_name: (typeof o.product_type === 'string' ? o.product_type : '') || prev.item_name,
      amount: o.order_value ? String(o.order_value) : prev.amount,
      gst_amount: o.order_gst_amount != null ? String(o.order_gst_amount) : prev.gst_amount,
      gst_invoice_number: o.invoice_number || prev.gst_invoice_number,
      invoice_date: o.invoice_date || prev.invoice_date,
    }));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = gstInvoices.filter(g => {
      if (fbrFilter === 'attention' && !needsFbrAttention(g)) return false;
      if (fbrFilter !== 'all' && fbrFilter !== 'attention' && g.fbr_status !== fbrFilter) return false;
      if (!q) return true;
      return [g.gst_invoice_number, g.customer_po_number, g.client_name, g.supplier_company,
        g.item_name, g.item_number, g.delivery_challan_number, g.psid, g.tcs_receipt_number]
        .some(v => (v || '').toLowerCase().includes(q));
    });
    // Sequence the register by GST invoice number (numeric-aware) descending — highest
    // number first — tie-broken by invoice date so the order is always deterministic.
    return matched.sort((a, b) => {
      const byNum = (b.gst_invoice_number || '').localeCompare(a.gst_invoice_number || '', undefined, { numeric: true });
      if (byNum !== 0) return byNum;
      return (b.invoice_date || '').localeCompare(a.invoice_date || '');
    });
  }, [gstInvoices, search, fbrFilter]);

  // Jump back to the first page whenever the result set changes underfoot.
  useEffect(() => { setCurrentPage(1); }, [search, fbrFilter, itemsPerPage]);

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filtered, currentPage, itemsPerPage],
  );

  const kpis = useMemo(() => {
    const totalGst = gstInvoices.reduce((s, g) => s + (g.gst_amount || 0), 0);
    const pending = gstInvoices.filter(g => g.fbr_status !== 'Deposited').length;
    const attention = gstInvoices.filter(needsFbrAttention).length;
    return { count: gstInvoices.length, totalGst, pending, attention };
  }, [gstInvoices]);

  const openAdd = () => { setForm(blankForm()); setOrderQuery(''); setOrderPickerOpen(false); setModal({ mode: 'add' }); };
  const openEdit = (g: GstInvoice) => { setForm(fromInvoice(g)); setOrderQuery(''); setOrderPickerOpen(false); setModal({ mode: 'edit', id: g.id }); };

  const linkOrder = (orderId: string) => { applyOrder(orderId); setOrderPickerOpen(false); setOrderQuery(''); };
  const unlinkOrder = () => { set('order_id', ''); setOrderQuery(''); setOrderPickerOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !modal) return;
    if (!form.gst_invoice_number.trim()) { toast.error('Enter the GST invoice number'); return; }
    setSaving(true);
    try {
      if (modal.mode === 'add') await addGstInvoice(toInput(form), user.id);
      else if (modal.id) await updateGstInvoice(modal.id, toInput(form));
      toast.success(modal.mode === 'add' ? 'Invoice added to register' : 'Invoice updated');
      setModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally { setSaving(false); }
  };

  const handleDelete = async (g: GstInvoice) => {
    if (!(await confirm({ title: 'Delete invoice?', message: `Delete invoice ${g.gst_invoice_number || '(no number)'} from the register? This cannot be undone.`, confirmLabel: 'Delete invoice' }))) return;
    try {
      await deleteGstInvoice(g.id);
      toast.success('Invoice removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleExport = () => {
    const header = ['GST Inv#', 'Inv Date', 'Client', 'PO#', 'Supplier', 'Item', 'Item#', 'Product Detail',
      'DC#', 'Amount', 'GST', 'Received', 'TCS Sent', 'TCS Receipt#', 'TCS Receipt Date', 'Client Received',
      'FBR Status', 'WASIF Receipt', 'WASIF Date', 'PSID', 'Deposit Date', 'Deposit Amount', 'Deposit Bank', 'Notes'];
    const rows: (string | number)[][] = [header];
    filtered.forEach(g => rows.push([
      g.gst_invoice_number, g.invoice_date, g.client_name, g.customer_po_number, g.supplier_company,
      g.item_name, g.item_number, g.product_detail, g.delivery_challan_number, g.amount, g.gst_amount,
      g.received_date, g.tcs_sent_date, g.tcs_receipt_number, g.tcs_receipt_date, g.client_received_date,
      g.fbr_status, g.wasif_receipt_received ? 'Yes' : 'No', g.wasif_receipt_date, g.psid,
      g.tax_deposit_date, g.tax_deposit_amount, g.tax_deposit_bank, g.notes || '',
    ]));
    downloadCSV(generateCSV([`Q-Tech GST Register (generated ${businessToday()})`], rows), `GST_Register_${businessToday()}.csv`);
  };

  const inputCls = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
  const lbl = 'block text-xs font-medium text-muted-foreground mb-1';
  const th = 'text-left px-3 py-2.5 text-[12px] font-semibold text-muted-foreground whitespace-nowrap';
  const td = 'px-3 py-2.5 text-sm text-foreground whitespace-nowrap';

  if (loading) return <TableSkeleton cols={9} rows={8} headers={['GST Inv #', 'Client / PO', 'Supplier / Item', 'DC #', 'Amount', 'TCS', 'Client rcvd', 'FBR', 'PSID / Deposit']} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground text-sm flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-primary" /> Every GST invoice, its TCS courier trail, and its FBR sales-tax filing — in one place.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Invoice
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <p className="text-xs font-semibold text-muted-foreground">Invoices</p>
          <p className="text-2xl font-extrabold text-foreground tracking-tight mt-1">{kpis.count}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-semibold text-muted-foreground">Total GST</p>
          <p className="text-2xl font-extrabold text-foreground tracking-tight mt-1">{formatPKR(kpis.totalGst)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-semibold text-muted-foreground">FBR not deposited</p>
          <p className="text-2xl font-extrabold text-foreground tracking-tight mt-1">{kpis.pending}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Needs attention {kpis.attention > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}</p>
          <p className={cn('text-2xl font-extrabold tracking-tight mt-1', kpis.attention > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{kpis.attention}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">prior-month, tax not deposited</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice #, PO, client, DC, PSID…"
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'attention', ...FBR_STATUSES] as const).map(f => (
            <button key={f} onClick={() => setFbrFilter(f)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                fbrFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {f === 'all' ? 'All' : f === 'attention' ? '⚠ Attention' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Register table */}
      <div className="glass-card p-0 overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">
            {gstInvoices.length === 0 ? 'No invoices in the register yet. Click “Add Invoice” to log the first one.' : 'No invoices match this filter.'}
          </p>
        ) : (
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1200 }}>
            <thead>
              <tr className="border-b border-border">
                <th className={th}>GST Inv #</th>
                <th className={th}>Client / PO</th>
                <th className={th}>Supplier / Item</th>
                <th className={th}>DC #</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>TCS</th>
                <th className={th}>Client rcvd</th>
                <th className={th}>FBR</th>
                <th className={th}>PSID / Deposit</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(g => {
                const attention = needsFbrAttention(g);
                return (
                  <tr key={g.id} onClick={() => setDetail(g)} className={cn('border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer', attention && 'bg-amber-500/[0.06]')}>
                    <td className={td}>
                      <div className="font-semibold">{g.gst_invoice_number || '—'}</div>
                      <div className="text-[12px] text-muted-foreground">{g.invoice_date ? formatDate(g.invoice_date) : '—'}</div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-1">{g.order_id && <Link2 className="w-3 h-3 text-primary flex-shrink-0" />}<span className="truncate max-w-[160px]">{g.client_name || '—'}</span></div>
                      <div className="text-[12px] text-muted-foreground">{g.customer_po_number || '—'}</div>
                    </td>
                    <td className={td}>
                      <div className="truncate max-w-[180px]">{g.supplier_company || '—'}</div>
                      <div className="text-[12px] text-muted-foreground truncate max-w-[180px]">{g.item_name}{g.item_number ? ` · ${g.item_number}` : ''}</div>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{g.delivery_challan_number || '—'}</td>
                    <td className={`${td} text-right`}>
                      <div className="font-semibold">{formatPKR(g.amount)}</div>
                      <div className="text-[12px] text-muted-foreground">GST {formatPKR(g.gst_amount)}</div>
                    </td>
                    <td className={td}>
                      <div className="text-[12px]">{g.tcs_sent_date ? `Sent ${formatDate(g.tcs_sent_date)}` : '—'}</div>
                      <div className="text-[12px] text-muted-foreground">{g.tcs_receipt_number ? `#${g.tcs_receipt_number}` : ''}</div>
                    </td>
                    <td className={`${td} text-[12px] text-muted-foreground`}>{g.client_received_date ? formatDate(g.client_received_date) : '—'}</td>
                    <td className={td}>
                      <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap', FBR_BADGE[g.fbr_status])}>{g.fbr_status}</span>
                      {attention && <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 mt-0.5"><AlertTriangle className="w-3 h-3" /> chase WASIF</div>}
                    </td>
                    <td className={td}>
                      <div className="text-[12px]">{g.psid ? `PSID ${g.psid}` : '—'}</div>
                      <div className="text-[12px] text-muted-foreground">{g.tax_deposit_date ? `Paid ${formatDate(g.tax_deposit_date)}` : g.wasif_receipt_received ? 'Receipt in' : ''}</div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); openEdit(g); }} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(g); }} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}
      <p className="text-[12px] text-muted-foreground">
        FBR reminder: sales tax is usually pending days 1–5, generated after the 5th, fully generated after the 10th — then check for the WASIF &amp; Co receipt (PSID) and deposit the tax. Rows highlighted amber are prior-month invoices whose tax isn't deposited yet.
      </p>

      {/* Add / edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{modal.mode === 'add' ? 'Add GST Invoice' : 'Edit GST Invoice'}</h2>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Identity */}
              <div>
                <p className="section-title mb-2 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-primary" /> Invoice &amp; identity</p>
                <div className="mb-3">
                  <label className={lbl}>Link a CRM order — search by PO # or product (auto-fills the fields below)</label>
                  {linkedOrder ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          <span className="font-medium">{linkedOrder.customer_po_number || '(no PO #)'}</span>
                          <span className="text-muted-foreground"> · {getClientName(linkedOrder.client_id)}{productLabel(linkedOrder) ? ` · ${productLabel(linkedOrder)}` : ''}</span>
                        </span>
                      </div>
                      <button type="button" onClick={unlinkOrder} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" title="Unlink order"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        value={orderQuery}
                        onChange={e => { setOrderQuery(e.target.value); setOrderPickerOpen(true); }}
                        onFocus={() => setOrderPickerOpen(true)}
                        onBlur={() => setOrderPickerOpen(false)}
                        placeholder="Type a PO number, product, or client…"
                        className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      {orderPickerOpen && (
                        <div className="mt-1 border border-border rounded-lg bg-card shadow-lg overflow-hidden">
                          {orderMatches.length === 0 ? (
                            <p className="px-3 py-2.5 text-xs text-muted-foreground">No orders match “{orderQuery}”. Leave this empty and enter the details manually below.</p>
                          ) : (
                            <ul className="max-h-56 overflow-y-auto divide-y divide-border/60">
                              {orderMatches.map(o => (
                                <li key={o.id}>
                                  {/* onMouseDown (not onClick) fires before the input's onBlur, so the pick isn't lost. */}
                                  <button type="button" onMouseDown={e => { e.preventDefault(); linkOrder(o.id); }}
                                    className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium text-foreground truncate">{o.customer_po_number || '(no PO #)'}</span>
                                      <span className="text-[12px] text-muted-foreground flex-shrink-0">{formatPKR(o.order_value)}</span>
                                    </div>
                                    <div className="text-[12px] text-muted-foreground truncate">{getClientName(o.client_id)}{productLabel(o) ? ` · ${productLabel(o)}` : ''}</div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">Linking auto-fills client, supplier, PO, item and amounts. Leave empty to enter everything manually.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className={lbl}>GST invoice #</label><input value={form.gst_invoice_number} onChange={e => set('gst_invoice_number', e.target.value)} className={inputCls} required /></div>
                  <div><label className={lbl}>Invoice date</label><input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Delivery challan # (DC)</label><input value={form.delivery_challan_number} onChange={e => set('delivery_challan_number', e.target.value)} placeholder="QTS-DC-###" className={inputCls} /></div>
                  <div><label className={lbl}>Client (sent to)</label><input value={form.client_name} onChange={e => set('client_name', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Customer PO #</label><input value={form.customer_po_number} onChange={e => set('customer_po_number', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Supplier company (from)</label><input value={form.supplier_company} onChange={e => set('supplier_company', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Item</label><input value={form.item_name} onChange={e => set('item_name', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Amount (incl GST)</label><input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>GST amount</label><input type="number" step="0.01" value={form.gst_amount} onChange={e => set('gst_amount', e.target.value)} className={inputCls} /></div>
                </div>
                {amtNum > 0 && (
                  <div className={cn('mt-2 text-xs rounded-lg px-3 py-2 border', gstMismatch ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300' : 'bg-muted/40 border-border text-muted-foreground')}>
                    {gstMismatch ? (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium">GST {formatPKR(gstNum)} doesn’t match 18% of net — expected ~{formatPKR(expectedGst)}.</span> Check the invoice.
                          <button type="button" onClick={() => set('gst_amount', String(expectedGst))} className="ml-2 underline font-medium hover:no-underline">Use 18% ({formatPKR(expectedGst)})</button>
                        </div>
                      </div>
                    ) : (
                      <span>Net (excl GST): <span className="font-medium text-foreground">{formatPKR(netExcl)}</span> · GST at 18%: <span className="font-medium text-foreground">{formatPKR(expectedGst)}</span> ✓</span>
                    )}
                  </div>
                )}
              </div>

              {/* TCS */}
              <div>
                <p className="section-title mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-info" /> TCS courier</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className={lbl}>TCS departure date</label><input type="date" value={form.tcs_sent_date} onChange={e => set('tcs_sent_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Client received on</label><input type="date" value={form.client_received_date} onChange={e => set('client_received_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>TCS receipt # <span className="text-muted-foreground font-normal">(optional)</span></label><input value={form.tcs_receipt_number} onChange={e => set('tcs_receipt_number', e.target.value)} className={inputCls} /></div>
                </div>
              </div>

              {/* FBR */}
              <div>
                <p className="section-title mb-2 flex items-center gap-1.5"><Landmark className="w-4 h-4 text-success" /> FBR sales tax</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>FBR status</label>
                    <select value={form.fbr_status} onChange={e => set('fbr_status', e.target.value as FbrStatus)} className={inputCls}>
                      {FBR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>PSID</label><input value={form.psid} onChange={e => set('psid', e.target.value)} placeholder="FBR Payment Slip ID" className={inputCls} /></div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={form.wasif_receipt_received} onChange={e => set('wasif_receipt_received', e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                      WASIF &amp; Co receipt received
                    </label>
                  </div>
                  <div><label className={lbl}>WASIF receipt date</label><input type="date" value={form.wasif_receipt_date} onChange={e => set('wasif_receipt_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Tax deposit date</label><input type="date" value={form.tax_deposit_date} onChange={e => set('tax_deposit_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Tax deposit amount</label><input type="number" step="0.01" value={form.tax_deposit_amount} onChange={e => set('tax_deposit_amount', e.target.value)} className={inputCls} /></div>
                  <div><label className={lbl}>Deposit bank</label><input value={form.tax_deposit_bank} onChange={e => set('tax_deposit_bank', e.target.value)} placeholder="e.g. Meezan Bank" className={inputCls} /></div>
                </div>
              </div>

              <div><label className={lbl}>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="Any extra context for this case" /></div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">{saving ? 'Saving…' : modal.mode === 'add' ? 'Add to register' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-only detail view */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDetail(null)}>
          <div className="modal-card max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-foreground">Invoice {detail.gst_invoice_number || '(no number)'}</h2>
                  <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap', FBR_BADGE[detail.fbr_status])}>{detail.fbr_status}</span>
                  {needsFbrAttention(detail) && <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> chase WASIF</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{detail.invoice_date ? formatDate(detail.invoice_date) : 'No invoice date'}{detail.order_id ? ' · linked to a CRM order' : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => { const g = detail; setDetail(null); openEdit(g); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="space-y-5">
              <section>
                <p className="section-title mb-2 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-primary" /> Invoice &amp; identity</p>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                  <DField label="Client (sent to)" value={detail.client_name || '—'} />
                  <DField label="Customer PO #" value={detail.customer_po_number || '—'} />
                  <DField label="Supplier (from)" value={detail.supplier_company || '—'} />
                  <DField label="Delivery challan #" value={detail.delivery_challan_number || '—'} />
                  <DField label="Amount (incl GST)" value={formatPKR(detail.amount)} />
                  <DField label="Net (excl GST)" value={formatPKR((detail.amount || 0) - (detail.gst_amount || 0))} />
                  <DField label="GST amount" value={formatPKR(detail.gst_amount)} />
                  <div className="col-span-2 md:col-span-3"><DField label="Item" value={[detail.item_name, detail.item_number].filter(Boolean).join(' · ') || '—'} /></div>
                  {detail.product_detail && <div className="col-span-2 md:col-span-3"><DField label="Product detail" value={detail.product_detail} /></div>}
                </dl>
              </section>

              <section>
                <p className="section-title mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-info" /> TCS courier</p>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                  <DField label="TCS departure" value={detail.tcs_sent_date ? formatDate(detail.tcs_sent_date) : '—'} />
                  <DField label="Client received on" value={detail.client_received_date ? formatDate(detail.client_received_date) : '—'} />
                  <DField label="TCS receipt #" value={detail.tcs_receipt_number || '—'} />
                </dl>
              </section>

              <section>
                <p className="section-title mb-2 flex items-center gap-1.5"><Landmark className="w-4 h-4 text-success" /> FBR sales tax</p>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                  <DField label="FBR status" value={detail.fbr_status} />
                  <DField label="PSID" value={detail.psid || '—'} />
                  <DField label="WASIF & Co receipt" value={detail.wasif_receipt_received ? (detail.wasif_receipt_date ? `Received ${formatDate(detail.wasif_receipt_date)}` : 'Received') : 'Not yet'} />
                  <DField label="Tax deposit date" value={detail.tax_deposit_date ? formatDate(detail.tax_deposit_date) : '—'} />
                  <DField label="Tax deposit amount" value={detail.tax_deposit_amount ? formatPKR(detail.tax_deposit_amount) : '—'} />
                  <DField label="Deposit bank" value={detail.tax_deposit_bank || '—'} />
                </dl>
              </section>

              {detail.notes && (
                <section>
                  <p className="section-title mb-2">Notes</p>
                  <p className="text-sm text-foreground break-words">{detail.notes}</p>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5 break-words">{value}</dd>
    </div>
  );
}
