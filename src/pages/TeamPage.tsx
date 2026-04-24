import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, TrendingUp, Wrench } from 'lucide-react';

const roleIcons = {
  admin: Shield,
  sales: TrendingUp,
  engineer: Wrench,
};

const roleColors = {
  admin: 'bg-primary/15 text-primary',
  sales: 'bg-info/15 text-info',
  engineer: 'bg-warning/15 text-warning',
};

export default function TeamPage() {
  const { isAdmin } = useAuth();
  const { users } = useCRM();

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <p className="text-muted-foreground mt-1">{users.length} team members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const Icon = roleIcons[u.role];
          return (
            <div key={u.id} className="glass-card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                  {u.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                  <span className={`status-badge capitalize mt-2 inline-flex items-center gap-1 ${roleColors[u.role]}`}>
                    <Icon className="w-3 h-3" /> {u.role}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
