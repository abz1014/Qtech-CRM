import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Target, ShoppingCart,
  Factory, UserCog, Wrench, LogOut, Zap, FileText,
  BarChart3, DollarSign, X, Bell, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('qtcrm_theme') as 'dark' | 'light') || 'dark'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qtcrm_theme', theme);
  }, [theme]);
  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') };
}

const navItems = [
  { label: 'Dashboard',        path: '/dashboard',        icon: LayoutDashboard, roles: ['admin', 'sales'] },
  { label: 'Clients',          path: '/clients',          icon: Users,           roles: ['admin', 'sales'] },
  { label: 'Prospects',        path: '/prospects',        icon: Target,          roles: ['admin', 'sales'] },
  { label: 'RFQs',             path: '/rfqs',             icon: FileText,        roles: ['admin', 'sales'] },
  { label: 'Daily RFQ Report', path: '/daily-rfq-report', icon: BarChart3,       roles: ['admin', 'sales'] },
  { label: 'Orders',           path: '/orders',           icon: ShoppingCart,    roles: ['admin', 'sales'] },
  { label: 'Actions',          path: '/actions',          icon: Bell,            roles: ['admin', 'sales'] },
  { label: 'Vendors',          path: '/vendors',          icon: Factory,         roles: ['admin', 'sales'] },
  { label: 'Finance',          path: '/finance',          icon: DollarSign,      roles: ['admin'] },
  { label: 'Team',             path: '/team',             icon: UserCog,         roles: ['admin'] },
  { label: 'My Jobs',          path: '/my-jobs',          icon: Wrench,          roles: ['engineer'] },
];

const groups = [
  { label: 'Main',   paths: ['/dashboard', '/clients', '/prospects'] },
  { label: 'Sales',  paths: ['/rfqs', '/daily-rfq-report', '/orders', '/actions'] },
  { label: 'Manage', paths: ['/vendors', '/finance', '/team', '/my-jobs'] },
];

interface AppSidebarProps { open: boolean; onClose: () => void; }

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));
  const handleNav = (path: string) => { navigate(path); onClose(); };
  const initials = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const sidebarContent = (
    <aside className="w-64 h-full flex flex-col" style={{ background: 'hsl(var(--sidebar-background))' }}>

      {/* Brand */}
      <div className="relative px-5 pt-6 pb-5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="absolute top-0 left-0 w-32 h-16 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)', filter: 'blur(20px)' }} />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)', boxShadow: '0 4px 12px hsl(var(--primary) / 0.4)' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>Q Tech Solutions</p>
            <p className="text-[11px]" style={{ color: 'hsl(var(--sidebar-foreground))' }}>Engineering CRM</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg"
          style={{ color: 'hsl(var(--sidebar-foreground))' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {groups.map(group => {
          const items = filteredItems.filter(i => group.paths.includes(i.path));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="section-title px-3 mb-2">{group.label}</p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <button key={item.path} onClick={() => handleNav(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive ? 'sidebar-active' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                      style={{ color: isActive ? undefined : 'hsl(var(--sidebar-foreground))' }}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 flex-shrink-0 space-y-2"
        style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'hsl(var(--sidebar-accent))' }}>
          <div className="avatar-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)', color: '#fff' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>{user.name}</p>
            <p className="text-[11px] capitalize" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{user.role}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex items-center justify-center w-10 h-9 rounded-lg transition-colors"
            style={{ color: 'hsl(var(--sidebar-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => { logout(); navigate('/'); }}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'hsl(var(--sidebar-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex lg:flex-shrink-0">{sidebarContent}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative flex flex-col w-64 max-w-[80vw] h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
