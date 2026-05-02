import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Target, ShoppingCart,
  Factory, UserCog, Wrench, LogOut, Zap, FileText, BarChart3, DollarSign, X, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { label: 'Clients', path: '/clients', icon: Users, roles: ['admin', 'sales'] },
  { label: 'Prospects', path: '/prospects', icon: Target, roles: ['admin', 'sales'] },
  { label: 'RFQs', path: '/rfqs', icon: FileText, roles: ['admin', 'sales'] },
  { label: 'Daily RFQ Report', path: '/daily-rfq-report', icon: BarChart3, roles: ['admin', 'sales'] },
  { label: 'Orders', path: '/orders', icon: ShoppingCart, roles: ['admin', 'sales'] },
  { label: 'Actions', path: '/actions', icon: Bell, roles: ['admin', 'sales'] },
  { label: 'Vendors', path: '/vendors', icon: Factory, roles: ['admin', 'sales'] },
  { label: 'Team', path: '/team', icon: UserCog, roles: ['admin'] },
  { label: 'Bookkeeping', path: '/bookkeeping', icon: DollarSign, roles: ['admin'] },
  { label: 'My Jobs', path: '/my-jobs', icon: Wrench, roles: ['engineer'] },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));

  const handleNav = (path: string) => {
    navigate(path);
    onClose(); // close drawer on mobile after navigating
  };

  const sidebarContent = (
    <aside className="w-64 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground">Q Tech Solutions</h1>
            <p className="text-xs text-sidebar-foreground">Engineering CRM</p>
          </div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredItems.map(item => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User / Sign out */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
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

  return (
    <>
      {/* Desktop: always-visible sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: overlay + slide-in drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Dark overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative flex flex-col w-64 max-w-[80vw] h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
