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
const NewReport = lazy(() => import("./pages/reports/NewReport"));
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
                <Route path="/reports/new" element={<NewReport />} />
                <Route path="/reports/edit/:id" element={<NewReport />} />
                <Route path="/reports/:id" element={<ViewReport />} />
                <Route path="/reports/view/:id" element={<ViewReport />} />
                <Route path="/approve-report/:token" element={<ApproveReport />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/roles" element={<ManageRoles />} />
                <Route path="/admin/manage-users" element={<ManageUsersRoles />} />
                <Route path="/admin/organizations" element={<ManageOrganizations />} />
                <Route path="/admin/org-dashboard" element={<OrganizationDashboard />} />
                <Route path="/admin/org-users" element={<OrgAdminUsers />} />
                <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                <Route path="/manager/team" element={<MyTeam />} />
                <Route path="/manager/stats" element={<ManagerStats />} />
                <Route path="/manager/personal-stats" element={<ManagerPersonalStats />} />
                <Route path="/manager/advanced-reports" element={<AdvancedReports />} />
                <Route path="/manager/travel-stats" element={<ManagerTravelStats />} />
                <Route path="/accounting" element={<AccountingHome />} />
                <Route path="/accounting/home" element={<AccountingHome />} />
                <Route path="/accounting/dashboard" element={<AccountingDashboard />} />
                <Route path="/accounting/stats" element={<AccountingStats />} />
                <Route
                  path="/accounting/organizational-analytics"
                  element={<OrganizationalAnalytics />}
                />
                <Route
                  path="/accounting/reimbursements"
                  element={<ReimbursementSummary />}
                />
                <Route path="/accounting/users" element={<ManageUsers />} />
                <Route path="/accounting/templates" element={<ExpenseTemplates />} />
                <Route
                  path="/accounting/bootstrap-tokens"
                  element={<BootstrapTokenManagement />}
                />
                <Route path="/accounting/ai-analytics" element={<AIAccuracyAnalytics />} />
                <Route path="/analytics" element={<ExpenseAnalytics />} />
                <Route path="/orgadmin" element={<OrgAdminDashboard />} />
                <Route
                  path="/orgadmin/invitation-codes"
                  element={<InvitationCodesManagement />}
                />
                <Route path="/orgadmin/users" element={<OrgUsersManagement />} />
                <Route path="/orgadmin/analytics" element={<OrgAnalytics />} />
                <Route path="/orgadmin/travel-policy" element={<TravelPolicyBuilder />} />
                <Route path="/my-travel-policy" element={<MyTravelPolicy />} />
                <Route path="/travel-requests" element={<TravelRequestsList />} />
                <Route path="/travel-requests/new" element={<NewTravelRequest />} />
                <Route path="/travel-requests/:id" element={<TravelRequestDetails />} />
                <Route path="/travel-requests/pending" element={<PendingTravelApprovals />} />
                <Route path="/travel/pending-approvals" element={<PendingTravelApprovals />} />
                <Route
                  path="/travel/my-approval-history"
                  element={<MyApprovalHistory />}
                />
                <Route path="/approved-travels" element={<ApprovedTravels />} />
                <Route path="/install" element={<InstallApp />} />
                <Route path="/about" element={<AboutSystem />} />
                <Route path="/admin/database-diagram" element={<DatabaseDiagram />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
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
