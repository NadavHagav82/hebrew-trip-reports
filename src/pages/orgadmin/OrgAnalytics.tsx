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
  User,
  Plane,
  Hotel,
  Utensils,
  Car,
  Package
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
  Line,
  Legend,
  Area,
  AreaChart
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

// Beautiful color palette for charts
const CHART_COLORS = [
  '#6366f1', // Indigo
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

const CATEGORY_COLORS: Record<string, { color: string; icon: any; bg: string }> = {
  flights: { color: '#6366f1', icon: Plane, bg: 'bg-indigo-500/10' },
  accommodation: { color: '#22c55e', icon: Hotel, bg: 'bg-green-500/10' },
  food: { color: '#f59e0b', icon: Utensils, bg: 'bg-amber-500/10' },
  transportation: { color: '#ec4899', icon: Car, bg: 'bg-pink-500/10' },
  miscellaneous: { color: '#06b6d4', icon: Package, bg: 'bg-cyan-500/10' }
};

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
          Array.from(categoryMap.entries()).map(([category, amount], index) => ({
            name: CATEGORY_LABELS[category] || category,
            category,
            value: Math.round(amount),
            color: CATEGORY_COLORS[category]?.color || CHART_COLORS[index % CHART_COLORS.length]
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
          .map(([dept, amount], index) => ({
            name: dept,
            amount: Math.round(amount),
            fill: CHART_COLORS[index % CHART_COLORS.length]
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-primary font-bold">₪{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const PieCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3">
          <p className="font-medium text-foreground">{payload[0].name}</p>
          <p className="font-bold" style={{ color: payload[0].payload.color }}>
            ₪{payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
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
          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-blue-950/30 dark:via-background dark:to-blue-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                משתמשים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <FileText className="h-5 w-5 text-emerald-500" />
                </div>
                דוחות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{totalReports}</div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {pendingReports} ממתינים לאישור
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-violet-50 via-white to-violet-50 dark:from-violet-950/30 dark:via-background dark:to-violet-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/10">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                </div>
                סה"כ הוצאות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">₪{totalAmount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/30 dark:via-background dark:to-amber-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                ממוצע לדוח
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">
                ₪{totalReports > 0 ? Math.round(totalAmount / totalReports).toLocaleString() : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span>מגמת הוצאות חודשית</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fill="url(#colorAmount)"
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-5 rounded-full bg-gradient-to-br from-muted/50 to-muted/30">
                    <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <span className="text-lg">אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <span>התפלגות לפי קטגוריה</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-pink-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : categoryData.length > 0 ? (
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieCustomTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap lg:flex-col gap-2 justify-center">
                    {categoryData.map((item, index) => {
                      const IconComponent = CATEGORY_COLORS[item.category]?.icon || Package;
                      return (
                        <div 
                          key={index} 
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div 
                            className="p-1.5 rounded-lg"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <IconComponent className="h-4 w-4" style={{ color: item.color }} />
                          </div>
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                          <span className="text-xs text-muted-foreground mr-auto">
                            ₪{item.value.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-5 rounded-full bg-gradient-to-br from-muted/50 to-muted/30">
                    <PieChart className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <span className="text-lg">אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Breakdown */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span>הוצאות לפי מחלקה</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-emerald-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : departmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentData} layout="vertical" barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="amount" 
                      radius={[0, 8, 8, 0]}
                      barSize={32}
                    >
                      {departmentData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-5 rounded-full bg-gradient-to-br from-muted/50 to-muted/30">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <span className="text-lg">אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Users */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <span>עובדים מובילים בהוצאות</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-amber-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">טוען נתונים...</span>
                </div>
              ) : topUsers.length > 0 ? (
                <div className="space-y-3">
                  {topUsers.map((userItem, index) => {
                    const maxAmount = topUsers[0]?.amount || 1;
                    const percentage = (userItem.amount / maxAmount) * 100;
                    
                    return (
                      <div 
                        key={index} 
                        className="relative p-4 rounded-xl bg-gradient-to-l from-muted/30 to-transparent border border-border/30 hover:border-amber-500/30 hover:shadow-md transition-all duration-200 overflow-hidden group"
                      >
                        {/* Progress bar background */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-l from-amber-500/10 to-transparent transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                        
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-md transition-transform group-hover:scale-105 ${
                              index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
                              index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{userItem.name}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                {userItem.count} דוחות
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xl font-bold text-foreground">₪{Math.round(userItem.amount).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <div className="p-5 rounded-full bg-gradient-to-br from-muted/50 to-muted/30">
                    <Users className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <span className="text-lg">אין נתונים להצגה</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Reports */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span>דוחות אחרונים</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              10 הדוחות האחרונים בארגון
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {recentReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
                <div className="p-6 rounded-full bg-gradient-to-br from-muted/50 to-muted/30">
                  <FileText className="h-12 w-12 text-muted-foreground/40" />
                </div>
                <span className="text-lg">אין דוחות להצגה</span>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="space-y-3 md:hidden">
                  {recentReports.map((report, index) => (
                    <div
                      key={report.id}
                      className="p-4 rounded-xl bg-gradient-to-l from-muted/20 to-transparent border border-border/30 hover:border-cyan-500/30 hover:shadow-md transition-all duration-200 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-cyan-500/10">
                            <User className="h-4 w-4 text-cyan-500" />
                          </div>
                          <span className="font-medium text-foreground">
                            {report.user?.full_name || '-'}
                          </span>
                        </div>
                        <Badge variant={
                          report.status === 'closed' ? 'default' :
                          report.status === 'pending_approval' ? 'secondary' :
                          'outline'
                        } className="rounded-full">
                          {STATUS_LABELS[report.status] || report.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{report.trip_destination}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-semibold text-foreground">₪{(report.total_amount_ils || 0).toLocaleString()}</span>
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
                <div className="hidden md:block overflow-x-auto rounded-xl border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                        <TableHead className="font-semibold text-foreground">עובד</TableHead>
                        <TableHead className="font-semibold text-foreground">יעד</TableHead>
                        <TableHead className="font-semibold text-foreground">סכום</TableHead>
                        <TableHead className="font-semibold text-foreground">סטטוס</TableHead>
                        <TableHead className="font-semibold text-foreground">תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReports.map((report, index) => (
                        <TableRow 
                          key={report.id}
                          className="hover:bg-muted/30 transition-colors border-b border-border/30 animate-fade-in"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                                <User className="h-4 w-4 text-cyan-500" />
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
                          <TableCell>
                            <span className="font-semibold text-foreground">
                              ₪{(report.total_amount_ils || 0).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              report.status === 'closed' ? 'default' :
                              report.status === 'pending_approval' ? 'secondary' :
                              'outline'
                            } className="rounded-full">
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
