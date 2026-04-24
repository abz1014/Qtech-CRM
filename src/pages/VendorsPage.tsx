import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { Pagination } from '@/components/Pagination';
import { Plus, X, Search, Trash2, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateCSV, downloadCSV } from '@/lib/csvExport';

export default function VendorsPage() {
  const navigate = useNavigate();
  const { vendors, addVendor, deleteVendor } = useCRM();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [form, setForm] = useState({
    name: '', country: '', contact_person: '', phone: '', email: '', products_supplied: '',
  });

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.country.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedVendors = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVendor(form);
    setShowForm(false);
    setForm({ name: '', country: '', contact_person: '', phone: '', email: '', products_supplied: '' });
  };

  const handleDelete = async (vendorId: string) => {
    try {
      await deleteVendor(vendorId);
      setShowDeleteConfirm(null);
      alert('Vendor deleted successfully');
    } catch (error) {
      alert('Error deleting vendor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Country', 'Contact Person', 'Phone', 'Email', 'Products Supplied'];
    const rows = filtered.map(v => [
      v.name,
      v.country,
      v.contact_person,
      v.phone,
      v.email,
      v.products_supplied,
    ]);
    const csv = generateCSV(headers, rows);
    const filename = `Vendors_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground mt-1">{vendors.length} registered vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..."
          className="w-full pl-10 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Name', 'Country', 'Contact', 'Phone', 'Products Supplied', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedVendors.map(v => (
              <tr key={v.id} onClick={() => navigate(`/vendors/${v.id}`)} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{v.name}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{v.country}</td>
                <td className="px-5 py-3 text-sm text-foreground">{v.contact_person}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{v.phone}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{v.products_supplied}</td>
                <td className="px-5 py-3">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(v.id);
                      }}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                      title="Delete Vendor"
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
              <h2 className="text-lg font-semibold text-foreground">Add New Vendor</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {([
                ['name', 'Company Name'],
                ['country', 'Country'],
                ['contact_person', 'Contact Person'],
                ['phone', 'Phone'],
                ['email', 'Email'],
                ['products_supplied', 'Products Supplied'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
                  <input value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" required />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 m-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Vendor?</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this vendor? This action cannot be undone.</p>
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

