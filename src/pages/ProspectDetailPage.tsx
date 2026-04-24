import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { ArrowLeft, Edit2, X } from 'lucide-react';
import { ProspectStatus } from '@/types/crm';

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { prospects, users, updateProspect, getUserName } = useCRM();
  const { isAdmin } = useAuth();

  const prospect = prospects.find(p => p.id === id);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: prospect?.company_name || '',
    contact_person: prospect?.contact_person || '',
    phone: prospect?.phone || '',
    email: prospect?.email || '',
    lead_source: prospect?.lead_source || '',
    status: prospect?.status || 'cold' as ProspectStatus,
    follow_up_date: prospect?.follow_up_date || '',
    assigned_to: prospect?.assigned_to || '',
  });

  if (!prospect) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Prospect not found</p>
        <button onClick={() => navigate('/prospects')} className="text-primary mt-2 hover:underline">Back to Prospects</button>
      </div>
    );
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProspect(id!, {
      company_name: editForm.company_name,
      contact_person: editForm.contact_person,
      phone: editForm.phone,
      email: editForm.email,
      lead_source: editForm.lead_source,
      status: editForm.status,
      follow_up_date: editForm.follow_up_date,
      assigned_to: editForm.assigned_to,
    });
    setShowEdit(false);
  };

  const statusColors: Record<ProspectStatus, string> = {
    hot: 'text-red-500',
    warm: 'text-yellow-500',
    cold: 'text-blue-500',
  };

  const salesUsers = users.filter(u => u.role === 'sales');

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/prospects')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Prospects
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{prospect.company_name}</h1>
          <p className="text-muted-foreground mt-1">{prospect.contact_person} · {prospect.email}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Contact Person</p>
              <p className="text-sm text-foreground font-medium">{prospect.contact_person}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-foreground font-medium">{prospect.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground font-medium break-all">{prospect.email}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Sales Pipeline</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm font-medium capitalize ${statusColors[prospect.status]}`}>{prospect.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lead Source</p>
              <p className="text-sm text-foreground font-medium">{prospect.lead_source}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned To</p>
              <p className="text-sm text-foreground font-medium">{getUserName(prospect.assigned_to)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Follow-up Date</p>
              <p className="text-sm text-foreground font-medium">{prospect.follow_up_date}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Prospect</h2>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
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
                <label className="block text-sm font-medium text-foreground mb-1">Lead Source</label>
                <input value={editForm.lead_source} onChange={e => setEditForm(p => ({ ...p, lead_source: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as ProspectStatus }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Follow-up Date</label>
                <input type="date" value={editForm.follow_up_date} onChange={e => setEditForm(p => ({ ...p, follow_up_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Assigned To</label>
                <select value={editForm.assigned_to} onChange={e => setEditForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required>
                  <option value="">Select Sales Person</option>
                  {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
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
