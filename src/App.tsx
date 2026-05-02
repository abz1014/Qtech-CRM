import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CRMProvider } from "@/contexts/CRMContext";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import ProspectsPage from "@/pages/ProspectsPage";
import ProspectDetailPage from "@/pages/ProspectDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import VendorsPage from "@/pages/VendorsPage";
import VendorDetailPage from "@/pages/VendorDetailPage";
import TeamPage from "@/pages/TeamPage";
import MyJobsPage from "@/pages/MyJobsPage";
import RFQsPage from "@/pages/RFQsPage";
import RFQDetailPage from "@/pages/RFQDetailPage";
import { DailyRFQReportPage } from "@/pages/DailyRFQReportPage";
import { BookkeepingPage } from "@/pages/BookkeepingPage";
import ActionsPage from "@/pages/ActionsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper that shows loading during auth initialization
function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CRMProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<ProtectedRoutes />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/prospects" element={<ProspectsPage />} />
                <Route path="/prospects/:id" element={<ProspectDetailPage />} />
                <Route path="/rfqs" element={<RFQsPage />} />
                <Route path="/rfqs/:id" element={<RFQDetailPage />} />
                <Route path="/daily-rfq-report" element={<DailyRFQReportPage />} />
                <Route path="/actions" element={<ActionsPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/vendors/:id" element={<VendorDetailPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/bookkeeping" element={<BookkeepingPage />} />
                <Route path="/my-jobs" element={<MyJobsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CRMProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
