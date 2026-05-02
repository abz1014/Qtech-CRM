import { useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pagination } from '@/components/Pagination';
import { formatPKR, formatDate } from '@/lib/format';

import { Plus, X, Search, ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { RFQStatus } from '@/types/crm';

const rfqStatusColors: Record<RFQStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  in_progress: 'bg-info/15 text-info',
  quoted: 'bg-warning/15 text-warning',
  converted: 'bg-success/15 text-success',
  lost: 'bg-destructive/15 text-destructive',
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const { clients, addClient, deleteClient, rfqs } = useCRM();
  const { user, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [form, setForm] = useState({
    company_name: '', industry: '', contact_person: '', phone: '', email: '', address: '',
  });

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedClients = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addClient({ ...form, created_by: user?.id ?? '' });
    setForm({ company_name: '', industry: '', contact_person: '', phone: '', email: '', address: '' });
    setShowForm(false);
  };

  const getClientRFQs = (clientId: string) => rfqs.filter(r => r.client_id === clientId);

  const handleDelete = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      setShowDeleteConfirm(null);
      alert('Client deleted successfully');
    } catch (error) {
      alert('Error deleting client: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleExportCSV = () => {
    const headers = ['Company', 'Industry', 'Contact Person', 'Phone', 'Email', 'Address'];
    const rows = filtered.map(c => [
      c.company_name,
      c.industry,
      c.contact_person,
      c.phone,
      c.email,
      c.address,
    ]);
    const csv = generateCSV(headers, rows);
    const filename = `Clients_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">{clients.length} registered clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
          className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Company', 'Industry', 'Contact Person', 'Phone', 'Email', 'RFQs', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedClients.map(c => {
              const clientRFQs = getClientRFQs(c.id);
              const isExpanded = expandedClient === c.id;
              return (
                <Fragment key={c.id}>
                  <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{c.company_name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{c.industry}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{c.contact_person}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{c.phone}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className="text-foreground font-medium">{clientRFQs.length}</span>
                    </td>
                    <td className="px-5 py-3 flex gap-2">
                      {clientRFQs.length > 0 && (
                        <button onClick={() => setExpandedClient(isExpanded ? null : c.id)} className="text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(c.id);
                          }}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && clientRFQs.length > 0 && (
                    <tr key={`${c.id}-rfqs`}>
                      <td colSpan={7} className="px-5 py-3 bg-muted/30">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">RFQs for {c.company_name}</p>
                          {clientRFQs.map(rfq => (
                            <div key={rfq.id} className="flex items-center gap-4 text-sm p-2 bg-card rounded">
                              <span className="text-foreground flex-1">{rfq.notes || 'No description'}</span>
                              <span className="text-muted-foreground">{formatDate(rfq.rfq_date)}</span>
                              <span className="text-foreground">{formatPKR(rfq.estimated_value)}</span>
                              <span className={`status-badge capitalize ${rfqStatusColors[rfq.status]}`}>{rfq.status.replace('_', ' ')}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add New Client</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {([
                ['company_name', 'Company Name'],
                ['industry', 'Industry'],
                ['contact_person', 'Contact Person'],
                ['phone', 'Phone'],
                ['email', 'Email'],
                ['address', 'Address'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
                  <input value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Client?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this client? This action cannot be undone.</p>
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

