import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Users, FileText, DollarSign, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Organization {
  id: string;
  name: string;
}

interface OrgStats {
  totalUsers: number;
  totalReports: number;
  approvedReports: number;
  pendingReports: number;
  totalAmount: number;
  averageAmount: number;
  averageProcessingTime: number;
}

interface DepartmentStats {
  department: string;
  count: number;
  amount: number;
  users: number;
}

interface CategoryStats {
  category: string;
  count: number;
  amount: number;
}

interface MonthlyStats {
  month: string;
  count: number;
  amount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  flights: '#3b82f6',
  accommodation: '#8b5cf6',
  food: '#10b981',
  transportation: '#f59e0b',
  miscellaneous: '#ef4444',
};

export default function OrganizationDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [timeRange, setTimeRange] = useState('current_month');
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      loadOrgStats();
    }
  }, [selectedOrg, timeRange]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin' as any
      });

      if (!data) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהלי מערכת יכולים לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsSuperAdmin(true);
      await loadOrganizations();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error }: any = await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      setOrganizations(data || []);
      if (data && data.length > 0) {
        setSelectedOrg(data[0].id);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את רשימת הארגונים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (timeRange) {
      case 'current_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last_month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'last_3_months':
        startDate = startOfMonth(subMonths(now, 3));
        endDate = endOfMonth(now);
        break;
      case 'last_6_months':
        startDate = startOfMonth(subMonths(now, 6));
        endDate = endOfMonth(now);
        break;
      case 'current_year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    return { startDate, endDate };
  };

  const loadOrgStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Get users in organization
      const { data: users, error: usersError }: any = await (supabase as any)
        .from('profiles')
        .select('id, department')
        .eq('organization_id', selectedOrg);

      if (usersError) throw usersError;

      const userIds = users?.map(u => u.id) || [];
      const totalUsers = users?.length || 0;

      if (userIds.length === 0) {
        setStats({
          totalUsers: 0,
          totalReports: 0,
          approvedReports: 0,
          pendingReports: 0,
          totalAmount: 0,
          averageAmount: 0,
          averageProcessingTime: 0,
        });
        setDepartmentStats([]);
        setCategoryStats([]);
        setMonthlyStats([]);
        setLoading(false);
        return;
      }

      // Get reports for these users
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select(`
          *,
          profiles!reports_user_id_fkey(department),
          expenses(*)
        `)
        .in('user_id', userIds)
        .gte('created_at', format(startDate, 'yyyy-MM-dd'))
        .lte('created_at', format(endDate, 'yyyy-MM-dd'));

      if (reportsError) throw reportsError;

      // Calculate overall stats
      const totalReports = reports?.length || 0;
      const approvedReports = reports?.filter(r => r.status === 'closed').length || 0;
      const pendingReports = reports?.filter(r => r.status === 'pending_approval').length || 0;
      const totalAmount = reports?.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0) || 0;
      const averageAmount = totalReports > 0 ? totalAmount / totalReports : 0;

      // Calculate average processing time
      let totalProcessingDays = 0;
      let processedCount = 0;
      reports?.forEach((report: any) => {
        if (report.submitted_at && report.approved_at) {
          const submitted = new Date(report.submitted_at);
          const approved = new Date(report.approved_at);
          const days = Math.ceil((approved.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
          totalProcessingDays += days;
          processedCount++;
        }
      });
      const averageProcessingTime = processedCount > 0 ? totalProcessingDays / processedCount : 0;

      setStats({
        totalUsers,
        totalReports,
        approvedReports,
        pendingReports,
        totalAmount,
        averageAmount,
        averageProcessingTime,
      });

      // Department stats with user count
      const deptMap = new Map<string, DepartmentStats>();
      users?.forEach((user: any) => {
        const dept = user.department || 'לא ידוע';
        if (!deptMap.has(dept)) {
          deptMap.set(dept, {
            department: dept,
            count: 0,
            amount: 0,
            users: 0,
          });
        }
        deptMap.get(dept)!.users++;
      });

      reports?.forEach((report: any) => {
        const dept = report.profiles?.department || 'לא ידוע';
        if (deptMap.has(dept)) {
          const deptStat = deptMap.get(dept)!;
          deptStat.count++;
          deptStat.amount += report.total_amount_ils || 0;
        }
      });
      setDepartmentStats(Array.from(deptMap.values()));

      // Category stats
      const categoryMap = new Map<string, CategoryStats>();
      reports?.forEach((report: any) => {
        report.expenses?.forEach((expense: any) => {
          if (!categoryMap.has(expense.category)) {
            categoryMap.set(expense.category, {
              category: expense.category,
              count: 0,
              amount: 0,
            });
          }
          const catStats = categoryMap.get(expense.category)!;
          catStats.count++;
          catStats.amount += expense.amount_in_ils;
        });
      });
      setCategoryStats(Array.from(categoryMap.values()));

      // Monthly stats
      const monthMap = new Map<string, MonthlyStats>();
      reports?.forEach((report: any) => {
        const monthKey = format(new Date(report.created_at), 'MM/yyyy');
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            count: 0,
            amount: 0,
          });
        }
        const monthStats = monthMap.get(monthKey)!;
        monthStats.count++;
        monthStats.amount += report.total_amount_ils || 0;
      });
      setMonthlyStats(Array.from(monthMap.values()).sort((a, b) => {
        const [aMonth, aYear] = a.month.split('/');
        const [bMonth, bYear] = b.month.split('/');
        return new Date(parseInt(aYear), parseInt(aMonth) - 1).getTime() -
          new Date(parseInt(bYear), parseInt(bMonth) - 1).getTime();
      }));

    } catch (error: any) {
      console.error('Error loading org stats:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הסטטיסטיקות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      flights: 'טיסות',
      accommodation: 'לינה',
      food: 'מזון',
      transportation: 'תחבורה',
      miscellaneous: 'שונות',
    };
    return labels[category] || category;
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            דשבורד ארגוני
          </h1>
          <p className="text-muted-foreground mt-1">ניתוח נתונים ברמת ארגון</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="בחר ארגון" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">חודש נוכחי</SelectItem>
              <SelectItem value="last_month">חודש שעבר</SelectItem>
              <SelectItem value="last_3_months">3 חודשים</SelectItem>
              <SelectItem value="last_6_months">6 חודשים</SelectItem>
              <SelectItem value="current_year">שנה נוכחית</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            חזרה
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              סה"כ משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              דוחות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.totalReports || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              מאושרים: {stats?.approvedReports || 0} | ממתינים: {stats?.pendingReports || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              סכום כולל
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              ₪{(stats?.totalAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ממוצע: ₪{(stats?.averageAmount || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              זמן טיפול ממוצע
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {(stats?.averageProcessingTime || 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ימים</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Stats */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>פירוט לפי מחלקה</CardTitle>
            <CardDescription>משתמשים, דוחות וסכומים</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="department"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#3b82f6" name="משתמשים" />
                <Bar dataKey="count" fill="#10b981" name="דוחות" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>התפלגות לפי קטגוריות</CardTitle>
            <CardDescription>סכומי הוצאות</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${getCategoryLabel(category)} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="amount"
                >
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`₪${value.toFixed(2)}`, 'סכום']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>מגמה חודשית</CardTitle>
          <CardDescription>דוחות וסכומים לאורך זמן</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="מספר דוחות" />
              <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="סכום (₪)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>פירוט מחלקות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold">מחלקה</th>
                    <th className="text-center p-3 font-semibold">משתמשים</th>
                    <th className="text-center p-3 font-semibold">דוחות</th>
                    <th className="text-right p-3 font-semibold">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map((dept) => (
                    <tr key={dept.department} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{dept.department}</td>
                      <td className="text-center p-3">{dept.users}</td>
                      <td className="text-center p-3">{dept.count}</td>
                      <td className="text-right p-3 font-semibold">₪{dept.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Category Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>פירוט קטגוריות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold">קטגוריה</th>
                    <th className="text-center p-3 font-semibold">מספר</th>
                    <th className="text-right p-3 font-semibold">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((cat) => (
                    <tr key={cat.category} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{getCategoryLabel(cat.category)}</td>
                      <td className="text-center p-3">{cat.count}</td>
                      <td className="text-right p-3 font-semibold">₪{cat.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
