import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import InstallBanner from "./components/InstallBanner";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { RequireAuth } from "./components/RequireAuth";

// Keep auth pages eager (fastest route to a working login)
import Login from "./pages/auth/Login";
import RegisterSelection from "./pages/auth/RegisterSelection";
import RegisterEmployee from "./pages/auth/RegisterEmployee";
import RegisterManager from "./pages/auth/RegisterManager";
import RegisterIndependent from "./pages/auth/RegisterIndependent";
import RegisterBootstrap from "./pages/auth/RegisterBootstrap";
import RegisterWithCode from "./pages/auth/RegisterWithCode";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Lazy-load heavy pages to prevent mobile freezes/crashes during initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ViewReport = lazy(() => import("./pages/reports/ViewReport"));
const ApproveReport = lazy(() => import("./pages/ApproveReport"));

const ManageRoles = lazy(() => import("./pages/admin/ManageRoles"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ManageUsersRoles = lazy(() => import("./pages/admin/ManageUsersRoles"));
const ManageOrganizations = lazy(() => import("./pages/admin/ManageOrganizations"));
const OrganizationDashboard = lazy(() => import("./pages/admin/OrganizationDashboard"));
const OrgAdminUsers = lazy(() => import("./pages/admin/OrgAdminUsers"));

const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const MyTeam = lazy(() => import("./pages/manager/MyTeam"));
const AdvancedReports = lazy(() => import("./pages/manager/AdvancedReports"));
const ManagerStats = lazy(() => import("./pages/manager/ManagerStats"));
const ManagerPersonalStats = lazy(() => import("./pages/manager/ManagerPersonalStats"));
const ManagerTravelStats = lazy(() => import("./pages/manager/ManagerTravelStats"));

const IndependentDashboard = lazy(() => import("./pages/independent/IndependentDashboard"));
const IndependentNewReport = lazy(() => import("./pages/independent/IndependentNewReport"));
const IndependentStats = lazy(() => import("./pages/independent/IndependentStats"));

const AccountingDashboard = lazy(() => import("./pages/accounting/AccountingDashboard"));
const AccountingStats = lazy(() => import("./pages/accounting/AccountingStats"));
const ManageUsers = lazy(() => import("./pages/accounting/ManageUsers"));
const AccountingHome = lazy(() => import("./pages/accounting/AccountingHome"));
const OrganizationalAnalytics = lazy(() => import("./pages/accounting/OrganizationalAnalytics"));
const ReimbursementSummary = lazy(() => import("./pages/accounting/ReimbursementSummary"));
const ExpenseAnalytics = lazy(() => import("./pages/analytics/ExpenseAnalytics"));
const ExpenseTemplates = lazy(() => import("./pages/accounting/ExpenseTemplates"));
const BootstrapTokenManagement = lazy(() => import("./pages/accounting/BootstrapTokenManagement"));
const AIAccuracyAnalytics = lazy(() => import("./pages/accounting/AIAccuracyAnalytics"));

const OrgAdminDashboard = lazy(() => import("./pages/orgadmin/OrgAdminDashboard"));
const InvitationCodesManagement = lazy(() => import("./pages/orgadmin/InvitationCodesManagement"));
const OrgUsersManagement = lazy(() => import("./pages/orgadmin/OrgUsersManagement"));
const OrgAnalytics = lazy(() => import("./pages/orgadmin/OrgAnalytics"));
const TravelPolicyBuilder = lazy(() => import("./pages/orgadmin/TravelPolicyBuilder"));

const MyTravelPolicy = lazy(() => import("./pages/policy/MyTravelPolicy"));

const TravelRequestsList = lazy(() => import("./pages/travel/TravelRequestsList"));
const NewTravelRequest = lazy(() => import("./pages/travel/NewTravelRequest"));
const TravelRequestDetails = lazy(() => import("./pages/travel/TravelRequestDetails"));
const PendingTravelApprovals = lazy(() => import("./pages/travel/PendingTravelApprovals"));
const ApprovedTravels = lazy(() => import("./pages/travel/ApprovedTravels"));
const MyApprovalHistory = lazy(() => import("./pages/travel/MyApprovalHistory"));

const InstallApp = lazy(() => import("./pages/InstallApp"));
const AboutSystem = lazy(() => import("./pages/AboutSystem"));
const DatabaseDiagram = lazy(() => import("./pages/admin/DatabaseDiagram"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <InstallBanner />
          <AppErrorBoundary>
            <Suspense
              fallback={
                <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/register" element={<RegisterSelection />} />
                <Route path="/auth/register/employee" element={<RegisterEmployee />} />
                <Route path="/auth/register/manager" element={<RegisterManager />} />
                <Route path="/auth/register/independent" element={<RegisterIndependent />} />
                <Route path="/auth/register/bootstrap" element={<RegisterBootstrap />} />
                <Route path="/auth/register/code" element={<RegisterWithCode />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/reports/new" element={<RequireAuth><IndependentNewReport /></RequireAuth>} />
                <Route path="/reports/edit/:id" element={<RequireAuth><IndependentNewReport /></RequireAuth>} />
                <Route path="/reports/:id" element={<ViewReport />} />
                <Route path="/reports/view/:id" element={<ViewReport />} />
                <Route path="/approve-report/:token" element={<ApproveReport />} />
                <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
                <Route path="/admin/roles" element={<RequireAuth><ManageRoles /></RequireAuth>} />
                <Route path="/admin/manage-users" element={<RequireAuth><ManageUsersRoles /></RequireAuth>} />
                <Route path="/admin/organizations" element={<RequireAuth><ManageOrganizations /></RequireAuth>} />
                <Route path="/admin/org-dashboard" element={<RequireAuth><OrganizationDashboard /></RequireAuth>} />
                <Route path="/admin/org-users" element={<RequireAuth><OrgAdminUsers /></RequireAuth>} />
                <Route path="/manager/dashboard" element={<RequireAuth><ManagerDashboard /></RequireAuth>} />
                <Route path="/independent" element={<RequireAuth><IndependentDashboard /></RequireAuth>} />
                <Route path="/independent/new-report" element={<RequireAuth><IndependentNewReport /></RequireAuth>} />
                <Route path="/independent/stats" element={<RequireAuth><IndependentStats /></RequireAuth>} />
                <Route path="/manager/team" element={<RequireAuth><MyTeam /></RequireAuth>} />
                <Route path="/manager/stats" element={<RequireAuth><ManagerStats /></RequireAuth>} />
                <Route path="/manager/personal-stats" element={<RequireAuth><ManagerPersonalStats /></RequireAuth>} />
                <Route path="/manager/advanced-reports" element={<RequireAuth><AdvancedReports /></RequireAuth>} />
                <Route path="/manager/travel-stats" element={<RequireAuth><ManagerTravelStats /></RequireAuth>} />
                <Route path="/accounting" element={<RequireAuth><AccountingHome /></RequireAuth>} />
                <Route path="/accounting/home" element={<RequireAuth><AccountingHome /></RequireAuth>} />
                <Route path="/accounting/dashboard" element={<RequireAuth><AccountingDashboard /></RequireAuth>} />
                <Route path="/accounting/stats" element={<RequireAuth><AccountingStats /></RequireAuth>} />
                <Route path="/accounting/organizational-analytics" element={<RequireAuth><OrganizationalAnalytics /></RequireAuth>} />
                <Route path="/accounting/reimbursements" element={<RequireAuth><ReimbursementSummary /></RequireAuth>} />
                <Route path="/accounting/users" element={<RequireAuth><ManageUsers /></RequireAuth>} />
                <Route path="/accounting/templates" element={<RequireAuth><ExpenseTemplates /></RequireAuth>} />
                <Route path="/accounting/bootstrap-tokens" element={<RequireAuth><BootstrapTokenManagement /></RequireAuth>} />
                <Route path="/accounting/ai-analytics" element={<RequireAuth><AIAccuracyAnalytics /></RequireAuth>} />
                <Route path="/analytics" element={<RequireAuth><ExpenseAnalytics /></RequireAuth>} />
                <Route path="/orgadmin" element={<RequireAuth><OrgAdminDashboard /></RequireAuth>} />
                <Route path="/orgadmin/invitation-codes" element={<RequireAuth><InvitationCodesManagement /></RequireAuth>} />
                <Route path="/orgadmin/users" element={<RequireAuth><OrgUsersManagement /></RequireAuth>} />
                <Route path="/orgadmin/analytics" element={<RequireAuth><OrgAnalytics /></RequireAuth>} />
                <Route path="/orgadmin/travel-policy" element={<RequireAuth><TravelPolicyBuilder /></RequireAuth>} />
                <Route path="/my-travel-policy" element={<RequireAuth><MyTravelPolicy /></RequireAuth>} />
                <Route path="/travel-requests" element={<RequireAuth><TravelRequestsList /></RequireAuth>} />
                <Route path="/travel-requests/new" element={<RequireAuth><NewTravelRequest /></RequireAuth>} />
                <Route path="/travel-requests/:id" element={<RequireAuth><TravelRequestDetails /></RequireAuth>} />
                <Route path="/travel-requests/pending" element={<RequireAuth><PendingTravelApprovals /></RequireAuth>} />
                <Route path="/travel/pending-approvals" element={<RequireAuth><PendingTravelApprovals /></RequireAuth>} />
                <Route path="/travel/my-approval-history" element={<RequireAuth><MyApprovalHistory /></RequireAuth>} />
                <Route path="/approved-travels" element={<RequireAuth><ApprovedTravels /></RequireAuth>} />
                <Route path="/install" element={<InstallApp />} />
                <Route path="/about" element={<AboutSystem />} />
                <Route path="/admin/database-diagram" element={<RequireAuth><DatabaseDiagram /></RequireAuth>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
