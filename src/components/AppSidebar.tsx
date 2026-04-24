import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Target, ShoppingCart,
  Factory, UserCog, Wrench, LogOut, Zap, FileText, BarChart3, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { label: 'Clients', path: '/clients', icon: Users, roles: ['admin', 'sales'] },
  { label: 'Prospects', path: '/prospects', icon: Target, roles: ['admin', 'sales'] },
  { label: 'RFQs', path: '/rfqs', icon: FileText, roles: ['admin', 'sales'] },
  { label: 'Daily RFQ Report', path: '/daily-rfq-report', icon: BarChart3, roles: ['admin', 'sales'] },
  { label: 'Orders', path: '/orders', icon: ShoppingCart, roles: ['admin', 'sales'] },
  { label: 'Vendors', path: '/vendors', icon: Factory, roles: ['admin', 'sales'] },
  { label: 'Team', path: '/team', icon: UserCog, roles: ['admin'] },
  { label: 'Bookkeeping', path: '/bookkeeping', icon: DollarSign, roles: ['admin'] },
  { label: 'My Jobs', path: '/my-jobs', icon: Wrench, roles: ['engineer'] },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground">Q Tech Solutions</h1>
            <p className="text-xs text-sidebar-foreground">Engineering CRM</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground capitalize">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
