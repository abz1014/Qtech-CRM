import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Menu } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/clients':          'Clients',
  '/prospects':        'Prospects',
  '/rfqs':             'RFQs',
  '/daily-rfq-report': 'Daily RFQ Report',
  '/orders':           'Orders',
  '/actions':          'Actions',
  '/vendors':          'Vendors',
  '/finance':          'Finance',
  '/team':             'Team',
  '/my-jobs':          'My Jobs',
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match for detail pages
  const base = Object.keys(PAGE_TITLES).find(k => k !== '/dashboard' && pathname.startsWith(k));
  return base ? PAGE_TITLES[base] : 'Q Tech Solutions';
}

export function AppLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!user) return <Navigate to="/" replace />;

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5"
          style={{
            borderBottom: '1px solid hsl(var(--border) / 0.6)',
            background: 'linear-gradient(to right, hsl(var(--card) / 0.6), hsl(var(--card) / 0.3))',
            backdropFilter: 'blur(12px)',
          }}>
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page title */}
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none">{pageTitle}</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
                Q Tech Solutions · Industrial Engineering CRM
              </p>
            </div>
          </div>

          {/* Right side — date */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto">
          <div key={location.pathname} className="p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
