import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Edit2, X, ShoppingCart, FileText, TrendingUp, Target, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddFollowUpButton } from '@/components/followup/AddFollowUpButton';
import { formatPKR, formatDate } from '@/lib/format';
import { lossReasonLabel } from '@/lib/lossReasons';

const rfqStatusColor: Record<string, string> = {
  new: 'bg-info/15 text-info',
  in_progress: 'bg-warning/15 text-warning',
  quoted: 'bg-primary/15 text-primary',
  converted: 'bg-success/15 text-success',
  lost: 'bg-destructive/15 text-destructive',
};
const orderStatusColor: Record<string, string> = {
  po_received: 'bg-info/15 text-info',
  procurement: 'bg-warning/15 text-warning',
  in_transit: 'bg-primary/15 text-primary',
  delivered: 'bg-success/15 text-success',
  payment_received: 'bg-emerald-500/15 text-emerald-600',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, rfqs, orders, updateClient, deleteClient } = useCRM();
  const { isAdmin, isSales } = useAuth();
  const confirm = useConfirm();

  // Customer intelligence — derived from existing RFQ/order data
  const clientRFQs = useMemo(() => rfqs.filter(r => r.client_id === id).sort((a, b) => b.rfq_date.localeCompare(a.rfq_date)), [rfqs, id]);
  const clientOrders = useMemo(() => orders.filter(o => o.client_id === id), [orders, id]);
  const intel = useMemo(() => {
    const lifetimeValue = clientOrders.reduce((s, o) => s + (o.order_value || 0), 0);
    const won = clientRFQs.filter(r => r.status === 'converted').length;
    const lost = clientRFQs.filter(r => r.status === 'lost').length;
    const decided = won + lost;
    const winRate = decided > 0 ? Math.round((won / decided) * 100) : null;
    const openRFQs = clientRFQs.filter(r => r.status !== 'converted' && r.status !== 'lost');
    const openOrders = clientOrders.filter(o => o.status !== 'payment_received');
    return { lifetimeValue, totalOrders: clientOrders.length, totalRFQs: clientRFQs.length, winRate, openRFQs, openOrders };
  }, [clientRFQs, clientOrders]);

  const client = clients.find(c => c.id === id);
  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    company_name: client?.company_name || '',
    industry: client?.industry || '',
    contact_person: client?.contact_person || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
  });

  // Sync editForm when client data loads (e.g. direct URL navigation while data loads)
  useEffect(() => {
    if (client) {
      setEditForm({
        company_name: client.company_name || '',
        industry: client.industry || '',
        contact_person: client.contact_person || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
      });
    }
  }, [client]);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Client not found</p>
        <button onClick={() => navigate('/clients')} className="text-primary mt-2 hover:underline">Back to Clients</button>
      </div>
    );
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    try {
      await updateClient(id!, {
        company_name: editForm.company_name,
        industry: editForm.industry,
        contact_person: editForm.contact_person,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
      });
      setShowEdit(false);
    } catch (err) {
      setEditError('Failed to update client. Please try again.');
    }
  };

  const handleDelete = async () => {
    const oc = orders.filter(o => o.client_id === id).length;
    const rc = rfqs.filter(r => r.client_id === id).length;
    const extra = (oc || rc) ? ` This will ALSO delete ${oc} order(s) and ${rc} RFQ(s) for this client.` : '';
    if (!(await confirm({ title: 'Delete client?', message: `Delete client "${client?.company_name}"?${extra} This cannot be undone.`, confirmLabel: 'Delete client' }))) return;
    try {
      await deleteClient(id!);
      toast.success('Client deleted');
      navigate('/clients');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Clients
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
          <p className="text-muted-foreground mt-1">{client.industry}</p>
        </div>
        <div className="flex items-center gap-2">
          <AddFollowUpButton
            entityType="client"
            entityId={client.id}
            entityLabel={client.company_name}
          />
          {(isAdmin || isSales) && (
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Contact Person</p>
              <p className="text-sm text-foreground font-medium">{client.contact_person}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-foreground font-medium">{client.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground font-medium break-all">{client.email}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Business Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Industry</p>
              <p className="text-sm text-foreground font-medium">{client.industry}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm text-foreground font-medium">{client.address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Intelligence ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Lifetime Value</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15 text-primary"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{formatPKR(intel.lifetimeValue)}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Total Orders</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/15 text-info"><ShoppingCart className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.totalOrders}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Total RFQs</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/15 text-warning"><FileText className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.totalRFQs}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Win Rate</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/15 text-success"><Target className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{intel.winRate === null ? '—' : `${intel.winRate}%`}</p>
          {intel.winRate !== null && <p className="text-[11px] text-muted-foreground mt-0.5">of decided RFQs</p>}
        </div>
      </div>

      {/* ── Open Pipeline ── */}
      {(intel.openRFQs.length > 0 || intel.openOrders.length > 0) && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Open Pipeline</h3>
          <div className="space-y-2">
            {intel.openRFQs.map(r => (
              <div key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-primary">{r.rfq_number || 'RFQ'}</span>
                  <span className={`status-badge capitalize text-[11px] ${rfqStatusColor[r.status]}`}>{r.status.replace('_', ' ')}</span>
                  <span className="text-xs text-muted-foreground truncate">{formatDate(r.rfq_date)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
            {intel.openOrders.map(o => (
              <div key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{o.product_type}</span>
                  <span className={`status-badge capitalize text-[11px] ${orderStatusColor[o.status]}`}>{o.status.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{formatPKR(o.order_value)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RFQ History ── */}
      {clientRFQs.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">RFQ History ({clientRFQs.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">RFQ #</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {clientRFQs.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="py-2.5"><span className="text-xs font-mono font-semibold text-primary">{r.rfq_number || '—'}</span></td>
                    <td className="py-2.5 text-muted-foreground text-xs">{formatDate(r.rfq_date)}</td>
                    <td className="py-2.5"><span className={`status-badge capitalize text-[11px] ${rfqStatusColor[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {r.status === 'lost' && r.loss_reason ? `Lost: ${lossReasonLabel(r.loss_reason)}` : ''}
                    </td>
                  </tr>
                ))}
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
              <h2 className="text-lg font-semibold text-foreground">Edit Client</h2>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
                <input value={editForm.company_name} onChange={e => setEditForm(p => ({ ...p, company_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                <input value={editForm.industry} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
                <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                <input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
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
