import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CRMProvider } from "@/contexts/CRMContext";
import { AppLayout } from "@/components/AppLayout";

// ─── Lazy-load every page ─────────────────────────────────────────────────────
// Splits the 1.3 MB bundle into per-page chunks.
// Fixes the "Cannot access before initialization" TDZ crash caused by
// Vite bundling all modules together and running them in the wrong order.

const LoginPage            = lazy(() => import("@/pages/LoginPage"));
const DashboardPage        = lazy(() => import("@/pages/DashboardPage"));
const ClientsPage          = lazy(() => import("@/pages/ClientsPage"));
const ClientDetailPage     = lazy(() => import("@/pages/ClientDetailPage"));
const ProspectsPage        = lazy(() => import("@/pages/ProspectsPage"));
const ProspectDetailPage   = lazy(() => import("@/pages/ProspectDetailPage"));
const OrdersPage           = lazy(() => import("@/pages/OrdersPage"));
const OrderDetailPage      = lazy(() => import("@/pages/OrderDetailPage"));
const VendorsPage          = lazy(() => import("@/pages/VendorsPage"));
const VendorDetailPage     = lazy(() => import("@/pages/VendorDetailPage"));
const TeamPage             = lazy(() => import("@/pages/TeamPage"));
const MyJobsPage           = lazy(() => import("@/pages/MyJobsPage"));
const RFQsPage             = lazy(() => import("@/pages/RFQsPage"));
const RFQDetailPage        = lazy(() => import("@/pages/RFQDetailPage"));
const DailyRFQReportPage   = lazy(() => import("@/pages/DailyRFQReportPage").then(m => ({ default: m.DailyRFQReportPage })));
const FinancePage          = lazy(() => import("@/pages/FinancePage"));
const CostingPage          = lazy(() => import("@/pages/CostingPage"));
const GstRegisterPage      = lazy(() => import("@/pages/GstRegisterPage"));
const EmployeesPage        = lazy(() => import("@/pages/EmployeesPage"));
const SalesIntelligencePage = lazy(() => import("@/pages/SalesIntelligencePage"));
const OperationsPage       = lazy(() => import("@/pages/OperationsPage"));
const ActionsPage          = lazy(() => import("@/pages/ActionsPage"));
const NotFound             = lazy(() => import("@/pages/NotFound"));

// ─── Shared spinner shown while a lazy chunk loads ────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient();

// ─── Auth-aware route guard ───────────────────────────────────────────────────
function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  return <AppLayout />;
}

// ─── Role guard — mirrors the sidebar's roles config. Hiding a nav link is
// cosmetic; this stops a user typing e.g. /team into the URL bar directly. ───
function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ─── App ─────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <CRMProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoutes />}>
                  <Route path="/dashboard"        element={<DashboardPage />} />
                  <Route path="/clients"          element={<ClientsPage />} />
                  <Route path="/clients/:id"      element={<ClientDetailPage />} />
                  <Route path="/prospects"        element={<ProspectsPage />} />
                  <Route path="/prospects/:id"    element={<ProspectDetailPage />} />
                  <Route path="/rfqs"             element={<RFQsPage />} />
                  <Route path="/rfqs/:id"         element={<RFQDetailPage />} />
                  <Route path="/daily-rfq-report" element={<DailyRFQReportPage />} />
                  <Route path="/sales-intelligence" element={<SalesIntelligencePage />} />
                  <Route path="/operations" element={<OperationsPage />} />
                  <Route path="/actions"          element={<ActionsPage />} />
                  <Route path="/orders"           element={<OrdersPage />} />
                  <Route path="/orders/:id"       element={<OrderDetailPage />} />
                  <Route path="/vendors"          element={<VendorsPage />} />
                  <Route path="/vendors/:id"      element={<VendorDetailPage />} />
                  <Route path="/team"             element={<RequireRole roles={['admin']}><TeamPage /></RequireRole>} />
                  <Route path="/finance"          element={<RequireRole roles={['admin']}><FinancePage /></RequireRole>} />
                  <Route path="/employees"        element={<RequireRole roles={['admin']}><EmployeesPage /></RequireRole>} />
                  <Route path="/costing"          element={<RequireRole roles={['admin', 'sales']}><CostingPage /></RequireRole>} />
                  <Route path="/gst-register"     element={<RequireRole roles={['admin', 'sales']}><GstRegisterPage /></RequireRole>} />
                  <Route path="/my-jobs"          element={<RequireRole roles={['engineer', 'admin']}><MyJobsPage /></RequireRole>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CRMProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
