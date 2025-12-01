import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/auth/Login";
import RegisterSelection from "./pages/auth/RegisterSelection";
import RegisterEmployee from "./pages/auth/RegisterEmployee";
import RegisterManager from "./pages/auth/RegisterManager";
import RegisterBootstrap from "./pages/auth/RegisterBootstrap";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import NewReport from "./pages/reports/NewReport";
import ViewReport from "./pages/reports/ViewReport";
import ApproveReport from "./pages/ApproveReport";
import ManageRoles from "./pages/admin/ManageRoles";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import MyTeam from "./pages/manager/MyTeam";
import AdvancedReports from "./pages/manager/AdvancedReports";
import ManagerStats from "./pages/manager/ManagerStats";
import AccountingDashboard from "./pages/accounting/AccountingDashboard";
import AccountingStats from "./pages/accounting/AccountingStats";
import ManageUsers from "./pages/accounting/ManageUsers";
import AccountingHome from "./pages/accounting/AccountingHome";
import ExpenseAnalytics from "./pages/analytics/ExpenseAnalytics";
import ExpenseTemplates from "./pages/accounting/ExpenseTemplates";
import BootstrapTokenManagement from "./pages/accounting/BootstrapTokenManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<RegisterSelection />} />
            <Route path="/auth/register/employee" element={<RegisterEmployee />} />
            <Route path="/auth/register/manager" element={<RegisterManager />} />
            <Route path="/auth/register/bootstrap" element={<RegisterBootstrap />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/reports/new" element={<NewReport />} />
            <Route path="/reports/edit/:id" element={<NewReport />} />
            <Route path="/reports/:id" element={<ViewReport />} />
            <Route path="/approve-report/:token" element={<ApproveReport />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/roles" element={<ManageRoles />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/team" element={<MyTeam />} />
            <Route path="/manager/stats" element={<ManagerStats />} />
            <Route path="/manager/advanced-reports" element={<AdvancedReports />} />
            <Route path="/accounting" element={<AccountingHome />} />
            <Route path="/accounting/home" element={<AccountingHome />} />
            <Route path="/accounting/dashboard" element={<AccountingDashboard />} />
            <Route path="/accounting/stats" element={<AccountingStats />} />
            <Route path="/accounting/users" element={<ManageUsers />} />
            <Route path="/accounting/templates" element={<ExpenseTemplates />} />
            <Route path="/accounting/bootstrap-tokens" element={<BootstrapTokenManagement />} />
            <Route path="/analytics" element={<ExpenseAnalytics />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
