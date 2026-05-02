import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, X } from 'lucide-react';
import { AddFollowUpButton } from '@/components/followup/AddFollowUpButton';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, updateClient } = useCRM();
  const { isAdmin } = useAuth();

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
          {isAdmin && (
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
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

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
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
