import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  Users, 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  ArrowRight,
  BarChart3,
  UserPlus,
  Eye,
  Loader2,
  Clipboard
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface DashboardStats {
  totalUsers: number;
  totalManagers: number;
  totalEmployees: number;
  pendingReports: number;
  approvedReports: number;
  totalAmount: number;
  reportsThisMonth: number;
  avgProcessingTime: number;
}

interface RecentReport {
  id: string;
  trip_destination: string;
  total_amount_ils: number;
  submitted_at: string;
  status: string;
  profiles: {
    full_name: string;
  };
}

export default function AccountingHome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAccountingManager, setIsAccountingManager] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalManagers: 0,
    totalEmployees: 0,
    pendingReports: 0,
    approvedReports: 0,
    totalAmount: 0,
    reportsThisMonth: 0,
    avgProcessingTime: 0,
  });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);

  useEffect(() => {
    checkAccountingManagerStatus();
  }, [user]);

  const checkAccountingManagerStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "accounting_manager");

      if (!roles || roles.length === 0) {
        toast({
          title: "אין הרשאה",
          description: "רק מנהלי הנהלת חשבונות יכולים לגשת לדף זה",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAccountingManager(true);
      loadDashboardData();
    } catch (error) {
      console.error("Error checking accounting manager status:", error);
      navigate('/');
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load users stats
      const { data: allUsers } = await supabase
        .from("profiles")
        .select("is_manager");

      const totalUsers = allUsers?.length || 0;
      const totalManagers = allUsers?.filter(u => u.is_manager).length || 0;
      const totalEmployees = totalUsers - totalManagers;

      // Load reports stats
      const { data: allReports } = await supabase
        .from("reports")
        .select("status, total_amount_ils, submitted_at, approved_at");

      const pendingReports = allReports?.filter(r => r.status === 'pending_approval').length || 0;
      const approvedReports = allReports?.filter(r => r.status === 'closed').length || 0;
      const totalAmount = allReports?.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0) || 0;

      // Reports this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const reportsThisMonth = allReports?.filter(r => 
        r.submitted_at && new Date(r.submitted_at) >= startOfMonth
      ).length || 0;

      // Calculate avg processing time
      const processedReports = allReports?.filter(r => r.approved_at && r.submitted_at) || [];
      let avgProcessingTime = 0;
      if (processedReports.length > 0) {
        const totalTime = processedReports.reduce((sum, r) => {
          const submitted = new Date(r.submitted_at!).getTime();
          const approved = new Date(r.approved_at!).getTime();
          return sum + (approved - submitted);
        }, 0);
        avgProcessingTime = Math.round(totalTime / processedReports.length / (1000 * 60 * 60 * 24));
      }

      setStats({
        totalUsers,
        totalManagers,
        totalEmployees,
        pendingReports,
        approvedReports,
        totalAmount,
        reportsThisMonth,
        avgProcessingTime,
      });

      // Load recent reports
      const { data: recent } = await supabase
        .from("reports")
        .select(`
          id,
          trip_destination,
          total_amount_ils,
          submitted_at,
          status,
          profiles!reports_user_id_fkey (full_name)
        `)
        .in('status', ['pending_approval', 'closed'])
        .order('submitted_at', { ascending: false })
        .limit(5);

      setRecentReports(recent || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את נתוני הדשבורד",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">ממתין לאישור</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700">מאושר</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAccountingManager) {
    return null;
  }

  const approvalRate = stats.approvedReports + stats.pendingReports > 0
    ? Math.round((stats.approvedReports / (stats.approvedReports + stats.pendingReports)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">דשבורד הנהלת חשבונות</h1>
                <p className="text-sm text-muted-foreground">סקירה כללית של המערכת</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              חזרה לדף הראשי
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" dir="rtl">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ משתמשים</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalManagers} מנהלים • {stats.totalEmployees} עובדים
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות ממתינים</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.pendingReports}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    דורש תשומת לב
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות מאושרים</p>
                  <p className="text-3xl font-bold text-green-600">{stats.approvedReports}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {approvalRate}% שיעור אישור
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ הוצאות</p>
                  <p className="text-3xl font-bold text-purple-600">
                    ₪{stats.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    כל הדוחות
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                ביצועים החודש
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">דוחות חדשים החודש</span>
                  <span className="text-sm font-bold">{stats.reportsThisMonth}</span>
                </div>
                <Progress value={(stats.reportsThisMonth / Math.max(stats.totalUsers, 1)) * 100} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">זמן טיפול ממוצע</span>
                  <span className="text-sm font-bold">{stats.avgProcessingTime} ימים</span>
                </div>
                <Progress 
                  value={Math.max(0, 100 - (stats.avgProcessingTime * 10))} 
                  className="[&>div]:bg-green-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">שיעור אישור</span>
                  <span className="text-sm font-bold">{approvalRate}%</span>
                </div>
                <Progress value={approvalRate} className="[&>div]:bg-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                פעולות מהירות
              </CardTitle>
              <CardDescription>גישה מהירה לפעולות נפוצות</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={() => navigate('/accounting/dashboard')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Eye className="w-4 h-4 ml-2" />
                צפייה בדוחות מאושרים
              </Button>
              <Button 
                onClick={() => navigate('/accounting/users')} 
                className="w-full justify-start"
                variant="outline"
              >
                <UserPlus className="w-4 h-4 ml-2" />
                ניהול משתמשים
              </Button>
              <Button 
                onClick={() => navigate('/accounting/stats')} 
                className="w-full justify-start"
                variant="outline"
              >
                <BarChart3 className="w-4 h-4 ml-2" />
                סטטיסטיקות מפורטות
              </Button>
              <Button 
                onClick={() => navigate('/manager/dashboard')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Clock className="w-4 h-4 ml-2" />
                דוחות ממתינים לאישור
              </Button>
              <Button 
                onClick={() => navigate('/accounting/templates')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Clipboard className="w-4 h-4 ml-2" />
                ניהול תבניות הוצאות
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                דוחות אחרונים
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/accounting/dashboard')}
              >
                צפה בכל הדוחות
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </div>
            <CardDescription>5 הדוחות האחרונים במערכת</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>אין דוחות אחרונים</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/reports/${report.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{report.profiles.full_name}</span>
                        {getStatusBadge(report.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{report.trip_destination}</p>
                    </div>
                    <div className="text-left ml-4">
                      <p className="font-bold text-primary">
                        ₪{(report.total_amount_ils || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.submitted_at && format(new Date(report.submitted_at), 'dd/MM/yyyy', { locale: he })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
