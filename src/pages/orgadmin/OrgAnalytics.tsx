import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowRight, 
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';

interface Report {
  id: string;
  status: string;
  total_amount_ils: number;
  created_at: string;
  trip_destination: string;
  user_id: string;
  user?: { full_name: string; department: string };
}

interface UserProfile {
  id: string;
  full_name: string;
  department: string;
  is_manager: boolean;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const CATEGORY_LABELS: Record<string, string> = {
  flights: 'טיסות',
  accommodation: 'לינה',
  food: 'אוכל',
  transportation: 'תחבורה',
  miscellaneous: 'שונות'
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  open: 'פתוח',
  pending_approval: 'ממתין לאישור',
  closed: 'סגור'
};

export default function OrgAnalytics() {
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('3');
  
  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  
  // Chart data
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkOrgAdminStatus();
  }, [user]);

  useEffect(() => {
    if (organizationId) {
      loadAnalytics();
    }
  }, [organizationId, selectedPeriod]);

  const checkOrgAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data: roleData } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'org_admin' as any,
      });

      if (!roleData) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהל ארגון יכול לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון משויך',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setOrganizationId(profile.organization_id);

      const { data: orgData } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single();

      setOrganizationName(orgData?.name || '');
      setIsOrgAdmin(true);
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadAnalytics = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const monthsBack = parseInt(selectedPeriod);
      const startDate = startOfMonth(subMonths(new Date(), monthsBack - 1));

      // Load users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, department, is_manager')
        .eq('organization_id', organizationId);

      const users = usersData || [];
      setTotalUsers(users.length);
      const userIds = users.map(u => u.id);

      if (userIds.length === 0) {
        setLoading(false);
        return;
      }

      // Load reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .in('user_id', userIds)
        .gte('created_at', startDate.toISOString());

      const reports = reportsData || [];
      setTotalReports(reports.length);
      setTotalAmount(reports.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0));
      setPendingReports(reports.filter(r => r.status === 'pending_approval').length);

      // Recent reports with user details
      const recentReportsWithUsers = reports
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(report => ({
          ...report,
          user: users.find(u => u.id === report.user_id)
        }));
      setRecentReports(recentReportsWithUsers);

      // Monthly data
      const monthlyMap = new Map<string, number>();
      for (let i = monthsBack - 1; i >= 0; i--) {
        const month = subMonths(new Date(), i);
        const key = format(month, 'yyyy-MM');
        monthlyMap.set(key, 0);
      }
      
      reports.forEach(report => {
        const key = format(new Date(report.created_at), 'yyyy-MM');
        if (monthlyMap.has(key)) {
          monthlyMap.set(key, (monthlyMap.get(key) || 0) + (report.total_amount_ils || 0));
        }
      });

      setMonthlyData(
        Array.from(monthlyMap.entries()).map(([month, amount]) => ({
          month: format(new Date(month + '-01'), 'MMM yyyy', { locale: he }),
          amount: Math.round(amount)
        }))
      );

      // Status distribution
      const statusMap = new Map<string, number>();
      reports.forEach(report => {
        statusMap.set(report.status, (statusMap.get(report.status) || 0) + 1);
      });
      setStatusData(
        Array.from(statusMap.entries()).map(([status, count]) => ({
          name: STATUS_LABELS[status] || status,
          value: count
        }))
      );

      // Load expenses for category data
      const reportIds = reports.map(r => r.id);
      if (reportIds.length > 0) {
        const { data: expensesData } = await supabase
          .from('expenses')
          .select('category, amount_in_ils')
          .in('report_id', reportIds);

        const categoryMap = new Map<string, number>();
        (expensesData || []).forEach(expense => {
          categoryMap.set(expense.category, (categoryMap.get(expense.category) || 0) + expense.amount_in_ils);
        });
        setCategoryData(
          Array.from(categoryMap.entries()).map(([category, amount]) => ({
            name: CATEGORY_LABELS[category] || category,
            value: Math.round(amount)
          }))
        );
      }

      // Department data
      const departmentMap = new Map<string, number>();
      reports.forEach(report => {
        const userProfile = users.find(u => u.id === report.user_id);
        const dept = userProfile?.department || 'לא ידוע';
        departmentMap.set(dept, (departmentMap.get(dept) || 0) + (report.total_amount_ils || 0));
      });
      setDepartmentData(
        Array.from(departmentMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([dept, amount]) => ({
            name: dept,
            amount: Math.round(amount)
          }))
      );

      // Top users by expense
      const userExpenseMap = new Map<string, { name: string; amount: number; count: number }>();
      reports.forEach(report => {
        const userProfile = users.find(u => u.id === report.user_id);
        if (userProfile) {
          const existing = userExpenseMap.get(report.user_id) || { name: userProfile.full_name, amount: 0, count: 0 };
          existing.amount += report.total_amount_ils || 0;
          existing.count += 1;
          userExpenseMap.set(report.user_id, existing);
        }
      });
      setTopUsers(
        Array.from(userExpenseMap.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
      );

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isOrgAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            סטטיסטיקות ודוחות
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {organizationName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">חודש אחרון</SelectItem>
              <SelectItem value="3">3 חודשים</SelectItem>
              <SelectItem value="6">6 חודשים</SelectItem>
              <SelectItem value="12">שנה</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/orgadmin')}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לדשבורד
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              דוחות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground">
              {pendingReports} ממתינים לאישור
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              סה"כ הוצאות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₪{totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              ממוצע לדוח
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ₪{totalReports > 0 ? Math.round(totalAmount / totalReports).toLocaleString() : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              מגמת הוצאות חודשית
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`₪${value.toLocaleString()}`, 'סכום']} />
                  <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              התפלגות לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₪${value.toLocaleString()}`, 'סכום']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              הוצאות לפי מחלקה
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : departmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => [`₪${value.toLocaleString()}`, 'סכום']} />
                  <Bar dataKey="amount" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              עובדים מובילים בהוצאות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : topUsers.length > 0 ? (
              <div className="space-y-4">
                {topUsers.map((userItem, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{userItem.name}</p>
                        <p className="text-xs text-muted-foreground">{userItem.count} דוחות</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">₪{Math.round(userItem.amount).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            דוחות אחרונים
          </CardTitle>
          <CardDescription>
            10 הדוחות האחרונים בארגון
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין דוחות להצגה
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>עובד</TableHead>
                  <TableHead>יעד</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>תאריך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.user?.full_name || '-'}
                    </TableCell>
                    <TableCell>{report.trip_destination}</TableCell>
                    <TableCell>₪{(report.total_amount_ils || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={
                        report.status === 'closed' ? 'default' :
                        report.status === 'pending_approval' ? 'secondary' :
                        'outline'
                      }>
                        {STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(report.created_at), 'dd/MM/yyyy', { locale: he })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
