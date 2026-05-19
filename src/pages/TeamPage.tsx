import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, TrendingUp, Wrench, Plus, X, Eye, EyeOff, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const roleIcons = {
  admin:    Shield,
  sales:    TrendingUp,
  engineer: Wrench,
};

const roleColors = {
  admin:    'bg-primary/15 text-primary',
  sales:    'bg-info/15 text-info',
  engineer: 'bg-warning/15 text-warning',
};

export default function TeamPage() {
  const { isAdmin } = useAuth();
  const { users } = useCRM();

  const [showForm, setShowForm]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'sales' as 'sales' | 'engineer',
  });

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await supabase.functions.invoke('create-user', {
        body: { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error || res.data?.error) {
        setError(res.data?.error || res.error?.message || 'Failed to create user');
      } else {
        setSuccess(`✅ ${form.name} added successfully! They can now log in with ${form.email}`);
        setForm({ name: '', email: '', password: '', role: 'sales' });
        setShowPassword(false);
        // Reload the page after a moment so the new user appears in the list
        setTimeout(() => { window.location.reload(); }, 1500);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setShowForm(false);
    setError('');
    setSuccess('');
    setForm({ name: '', email: '', password: '', role: 'sales' });
    setShowPassword(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground mt-1">{users.length} team members</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const Icon = roleIcons[u.role];
          return (
            <div key={u.id} className="glass-card p-5">
              <div className="flex items-start gap-4">
                <div className="avatar-md flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)', color: '#fff' }}>
                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                  <span className={`status-badge capitalize mt-2 inline-flex items-center gap-1 ${roleColors[u.role]}`}>
                    <Icon className="w-3 h-3" /> {u.role}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="glass-card modal-scroll w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Add Team Member</h2>
              </div>
              <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Usman Waheed"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. usman@qtechsolution-pk.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value as 'sales' | 'engineer' }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="sales">Sales</option>
                  <option value="engineer">Engineer</option>
                </select>
              </div>

              {error && (
                <div className="px-3 py-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              {success && (
                <div className="px-3 py-2.5 bg-success/10 border border-success/30 rounded-lg text-sm text-success">
                  {success}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Creating...' : (
                    <><Plus className="w-4 h-4" /> Create Account</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
