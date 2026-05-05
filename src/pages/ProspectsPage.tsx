import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/lib/format';
import { Plus, X, Search, ArrowRightCircle, Trash2, Download } from 'lucide-react';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { ProspectStatus } from '@/types/crm';

const statusColors: Record<ProspectStatus, string> = {
  hot: 'bg-hot/15 text-hot',
  warm: 'bg-warm/15 text-warm',
  cold: 'bg-cold/15 text-cold',
};

export default function ProspectsPage() {
  const navigate = useNavigate();
  const { prospects, addProspect, convertProspect, deleteProspect, getUserName } = useCRM();
  const { user, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [form, setForm] = useState({
    company_name: '', contact_person: '', phone: '', email: '',
    lead_source: '', status: 'warm' as ProspectStatus, follow_up_date: '', assigned_to: user?.id ?? '',
  });

  const active = prospects.filter(p => !p.converted_client_id);
  const filtered = active.filter(p =>
    p.company_name.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_person.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedProspects = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProspect(form);
    setShowForm(false);
    setForm({ company_name: '', contact_person: '', phone: '', email: '', lead_source: '', status: 'warm', follow_up_date: '', assigned_to: user?.id ?? '' });
  };

  const handleDelete = async (prospectId: string) => {
    try {
      await deleteProspect(prospectId);
      setShowDeleteConfirm(null);
      alert('Prospect deleted successfully');
    } catch (error) {
      alert('Error deleting prospect: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Company Name', 'Contact Person', 'Phone', 'Email',
      'Lead Source', 'Status', 'Follow Up Date', 'Assigned To', 'Converted to Client',
    ];
    const rows = filtered.map(p => [
      p.company_name,
      p.contact_person,
      p.phone,
      p.email,
      p.lead_source,
      p.status.toUpperCase(),
      p.follow_up_date || '',
      getUserName(p.assigned_to),
      p.converted_client_id ? 'Yes' : 'No',
    ]);
    const csv = generateCSV(headers, rows);
    const filename = `Prospects_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
          <p className="text-muted-foreground mt-1">{active.length} active prospects</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Prospect
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects..."
          className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Company', 'Contact', 'Source', 'Status', 'Follow Up', 'Assigned To', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedProspects.map(p => (
              <tr key={p.id} onClick={() => navigate(`/prospects/${p.id}`)} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{p.company_name}</td>
                <td className="px-5 py-3 text-sm text-foreground">{p.contact_person}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{p.lead_source}</td>
                <td className="px-5 py-3">
                  <span className={`status-badge capitalize ${statusColors[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(p.follow_up_date)}</td>
                <td className="px-5 py-3 text-sm text-foreground">{getUserName(p.assigned_to)}</td>
                <td className="px-5 py-3 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); convertProspect(p.id, user?.id ?? ''); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    title="Convert to Client"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" /> Convert
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(p.id);
                      }}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                      title="Delete Prospect"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add New Prospect</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {([
                ['company_name', 'Company Name', 'text'],
                ['contact_person', 'Contact Person', 'text'],
                ['phone', 'Phone', 'text'],
                ['email', 'Email', 'email'],
                ['lead_source', 'Lead Source', 'text'],
                ['follow_up_date', 'Follow Up Date', 'date'],
              ] as const).map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ProspectStatus }))}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add Prospect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Prospect?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this prospect? This action cannot be undone.</p>
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

