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
  PieChart,
  Clock,
  MapPin,
  User
} from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];

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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/30 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-muted-foreground animate-pulse">טוען נתונים...</p>
      </div>
    );
  }

  if (!isOrgAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background" dir="rtl">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-muted/50 via-background to-primary/5 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">סטטיסטיקות ודוחות</h1>
                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{organizationName}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[160px] bg-background/80 backdrop-blur-sm border-border/50">
                  <Calendar className="h-4 w-4 ml-2 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">חודש אחרון</SelectItem>
                  <SelectItem value="3">3 חודשים</SelectItem>
                  <SelectItem value="6">6 חודשים</SelectItem>
                  <SelectItem value="12">שנה</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => navigate('/orgadmin')}
                className="bg-background/80 backdrop-blur-sm border-border/50 hover:bg-muted/80"
              >
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה לדשבורד
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-500/10 via-background to-blue-500/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Users className="h-4 w-4 text-blue-500" />
                </div>
                משתמשים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-500/10 via-background to-green-500/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <FileText className="h-4 w-4 text-green-500" />
                </div>
                דוחות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalReports}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <Clock className="inline h-3 w-3 ml-1" />
                {pendingReports} ממתינים לאישור
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-primary/10 via-background to-primary/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                סה"כ הוצאות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">₪{totalAmount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                </div>
                ממוצע לדוח
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                ₪{totalReports > 0 ? Math.round(totalAmount / totalReports).toLocaleString() : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                מגמת הוצאות חודשית
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-3 border-primary/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [`₪${value.toLocaleString()}`, 'סכום']} 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-4 rounded-full bg-muted/50">
                    <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <span>אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <PieChart className="h-5 w-5 text-primary" />
                </div>
                התפלגות לפי קטגוריה
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-3 border-primary/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
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
                    <Tooltip 
                      formatter={(value) => [`₪${Number(value).toLocaleString()}`, 'סכום']} 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-4 rounded-full bg-muted/50">
                    <PieChart className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <span>אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Breakdown */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                הוצאות לפי מחלקה
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-3 border-primary/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : departmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [`₪${Number(value).toLocaleString()}`, 'סכום']} 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-4 rounded-full bg-muted/50">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <span>אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Users */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                עובדים מובילים בהוצאות
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-3 border-primary/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : topUsers.length > 0 ? (
                <div className="space-y-3">
                  {topUsers.map((userItem, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-l from-muted/50 to-transparent border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-md' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{userItem.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {userItem.count} דוחות
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-foreground">₪{Math.round(userItem.amount).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-4 rounded-full bg-muted/50">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <span>אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Reports */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              דוחות אחרונים
            </CardTitle>
            <CardDescription>
              10 הדוחות האחרונים בארגון
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {recentReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <div className="p-4 rounded-full bg-muted/50">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <span>אין דוחות להצגה</span>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="space-y-3 md:hidden">
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-4 rounded-xl bg-gradient-to-l from-muted/30 to-transparent border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">
                            {report.user?.full_name || '-'}
                          </span>
                        </div>
                        <Badge variant={
                          report.status === 'closed' ? 'default' :
                          report.status === 'pending_approval' ? 'secondary' :
                          'outline'
                        }>
                          {STATUS_LABELS[report.status] || report.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{report.trip_destination}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">₪{(report.total_amount_ils || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(new Date(report.created_at), 'dd/MM/yyyy', { locale: he })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-border/50">
                        <TableHead className="font-semibold text-foreground">עובד</TableHead>
                        <TableHead className="font-semibold text-foreground">יעד</TableHead>
                        <TableHead className="font-semibold text-foreground">סכום</TableHead>
                        <TableHead className="font-semibold text-foreground">סטטוס</TableHead>
                        <TableHead className="font-semibold text-foreground">תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReports.map((report) => (
                        <TableRow 
                          key={report.id}
                          className="hover:bg-muted/50 transition-colors border-b border-border/30"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-primary/10">
                                <User className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="font-medium text-foreground">
                                {report.user?.full_name || '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {report.trip_destination}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            ₪{(report.total_amount_ils || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              report.status === 'closed' ? 'default' :
                              report.status === 'pending_approval' ? 'secondary' :
                              'outline'
                            }>
                              {STATUS_LABELS[report.status] || report.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(report.created_at), 'dd/MM/yyyy', { locale: he })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
