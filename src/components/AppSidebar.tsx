import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Target, ShoppingCart,
  Factory, UserCog, Wrench, LogOut, Zap, FileText,
  BarChart3, DollarSign, X, Bell, Sun, Moon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Theme hook ───────────────────────────────────────────────────────────────
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

// ── Nav config ───────────────────────────────────────────────────────────────
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

// ── Tooltip wrapper for collapsed mode ───────────────────────────────────────
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold
        bg-popover text-popover-foreground border border-border shadow-lg
        opacity-0 group-hover/tooltip:opacity-100 pointer-events-none
        transition-opacity duration-150 whitespace-nowrap z-50">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
      </div>
    </div>
  );
}

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AppSidebar({ open, onClose, collapsed, onToggleCollapse }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));
  const handleNav = (path: string) => { navigate(path); onClose(); };
  const initials = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const sidebarContent = (
    <aside
      className="h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: collapsed ? '68px' : '256px',
        background: 'hsl(var(--sidebar-background))',
        borderRight: '1px solid hsl(var(--sidebar-border))',
      }}
    >
      {/* ── Brand ── */}
      <div className="relative flex items-center flex-shrink-0 overflow-hidden"
        style={{
          borderBottom: '1px solid hsl(var(--sidebar-border))',
          padding: collapsed ? '20px 0' : '20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: '72px',
        }}>
        {/* Glow */}
        {!collapsed && (
          <div className="absolute top-0 left-0 w-32 h-16 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)', filter: 'blur(20px)' }} />
        )}

        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)',
            boxShadow: '0 4px 12px hsl(var(--primary) / 0.4)',
          }}
        >
          <Zap className="w-5 h-5 text-white" />
        </div>

        {!collapsed && (
          <div className="ml-3 relative z-10 overflow-hidden">
            <p className="text-sm font-bold leading-tight whitespace-nowrap"
              style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>
              Q Tech Solutions
            </p>
            <p className="text-[11px] whitespace-nowrap"
              style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              Engineering CRM
            </p>
          </div>
        )}

        {/* Mobile close */}
        {!collapsed && (
          <button onClick={onClose} className="lg:hidden ml-auto p-1.5 rounded-lg"
            style={{ color: 'hsl(var(--sidebar-foreground))' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4"
        style={{ padding: collapsed ? '16px 0' : '16px 12px' }}>
        {groups.map(group => {
          const items = filteredItems.filter(i => group.paths.includes(i.path));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-5">
              {!collapsed && (
                <p className="section-title px-3 mb-2">{group.label}</p>
              )}
              {collapsed && <div className="mb-2 h-px mx-3" style={{ background: 'hsl(var(--sidebar-border))' }} />}
              <div className="space-y-0.5">
                {items.map(item => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                  const btn = (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        'w-full flex items-center transition-all duration-150 rounded-lg',
                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                        isActive ? 'sidebar-active' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                      style={{ color: isActive ? undefined : 'hsl(var(--sidebar-foreground))' }}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );

                  return collapsed
                    ? <NavTooltip key={item.path} label={item.label}>{btn}</NavTooltip>
                    : btn;
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 space-y-2"
        style={{
          borderTop: '1px solid hsl(var(--sidebar-border))',
          padding: collapsed ? '12px 0' : '12px',
        }}>

        {/* Collapse toggle button */}
        <div className={cn('flex', collapsed ? 'justify-center' : 'justify-end px-1')}>
          <NavTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: 'hsl(var(--sidebar-foreground))' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {collapsed
                ? <ChevronRight className="w-4 h-4" />
                : <ChevronLeft className="w-4 h-4" />
              }
            </button>
          </NavTooltip>
        </div>

        {/* User card */}
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{ background: 'hsl(var(--sidebar-accent))' }}>
            <div className="avatar-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)', color: '#fff' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate"
                style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>
                {user.name}
              </p>
              <p className="text-[11px] capitalize"
                style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                {user.role}
              </p>
            </div>
          </div>
        ) : (
          <NavTooltip label={user.name}>
            <div className="flex justify-center py-1">
              <div className="avatar-sm"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(158 60% 28%) 100%)', color: '#fff' }}>
                {initials}
              </div>
            </div>
          </NavTooltip>
        )}

        {/* Actions row */}
        <div className={cn('flex gap-1.5', collapsed ? 'flex-col items-center' : '')}>
          <NavTooltip label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            <button
              onClick={toggle}
              className={cn(
                'flex items-center justify-center rounded-lg transition-colors',
                collapsed ? 'w-9 h-9' : 'w-9 h-9'
              )}
              style={{ color: 'hsl(var(--sidebar-foreground))' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </NavTooltip>

          {!collapsed ? (
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: 'hsl(var(--sidebar-foreground))' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <NavTooltip label="Sign Out">
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'hsl(var(--sidebar-foreground))' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--sidebar-accent))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </NavTooltip>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">{sidebarContent}</div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative flex flex-col h-full shadow-2xl animate-slide-in-left"
            style={{ width: '256px' }}>
            {/* Force expanded on mobile */}
            <aside className="h-full flex flex-col" style={{ width: '256px', background: 'hsl(var(--sidebar-background))' }}>
              {sidebarContent}
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
