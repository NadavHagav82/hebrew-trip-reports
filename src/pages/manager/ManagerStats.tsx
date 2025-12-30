import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, CheckCircle, XCircle, DollarSign, BarChart3, Shield, Calculator, UserCog, ArrowRight, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ExpenseStats {
  approved: number;
  rejected: number;
  pending: number;
  totalAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
}

interface CategoryStats {
  category: string;
  approved: number;
  rejected: number;
  pending: number;
  total: number;
  amount: number;
}

interface MonthlyStats {
  month: string;
  approved: number;
  rejected: number;
  pending: number;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];
const CATEGORY_COLORS: Record<string, string> = {
  flights: '#3b82f6',
  accommodation: '#8b5cf6',
  food: '#10b981',
  transportation: '#f59e0b',
  miscellaneous: '#ef4444',
};

interface TeamMember {
  id: string;
  full_name: string;
}

const ManagerStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('current_month');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

  useEffect(() => {
    if (user) {
      loadTeamMembers();
    }
  }, [user]);

  useEffect(() => {
    if (user && teamMembers.length >= 0) {
      loadStats();
    }
  }, [user, timeRange, selectedEmployee, teamMembers]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('manager_id', user?.id)
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
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

  const loadStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Determine which user IDs to filter by
      let teamUserIds: string[];
      if (selectedEmployee === 'all') {
        teamUserIds = teamMembers.map(m => m.id);
      } else {
        teamUserIds = [selectedEmployee];
      }

      if (teamUserIds.length === 0) {
        setStats({ approved: 0, rejected: 0, pending: 0, totalAmount: 0, approvedAmount: 0, rejectedAmount: 0 });
        setCategoryStats([]);
        setMonthlyStats([]);
        setLoading(false);
        return;
      }

      // Get all expenses for team members in the date range
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          *,
          reports!inner(
            status,
            submitted_at,
            manager_approval_requested_at,
            user_id
          )
        `)
        .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
        .lte('expense_date', format(endDate, 'yyyy-MM-dd'))
        .in('reports.user_id', teamUserIds)
        .in('reports.status', ['pending_approval', 'closed', 'open']);

      if (error) throw error;

      // Calculate overall stats
      const overallStats: ExpenseStats = {
        approved: 0,
        rejected: 0,
        pending: 0,
        totalAmount: 0,
        approvedAmount: 0,
        rejectedAmount: 0,
      };

      const categoryMap = new Map<string, CategoryStats>();
      const monthMap = new Map<string, MonthlyStats>();

      expenses?.forEach((expense: any) => {
        const status = expense.approval_status || 'pending';
        const amount = expense.amount_in_ils;

        // Overall stats
        if (status === 'approved') {
          overallStats.approved++;
          overallStats.approvedAmount += amount;
        } else if (status === 'rejected') {
          overallStats.rejected++;
          overallStats.rejectedAmount += amount;
        } else {
          overallStats.pending++;
        }
        overallStats.totalAmount += amount;

        // Category stats
        if (!categoryMap.has(expense.category)) {
          categoryMap.set(expense.category, {
            category: expense.category,
            approved: 0,
            rejected: 0,
            pending: 0,
            total: 0,
            amount: 0,
          });
        }
        const catStats = categoryMap.get(expense.category)!;
        catStats.total++;
        catStats.amount += amount;
        if (status === 'approved') catStats.approved++;
        else if (status === 'rejected') catStats.rejected++;
        else catStats.pending++;

        // Monthly stats
        const monthKey = format(new Date(expense.expense_date), 'MM/yyyy');
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            approved: 0,
            rejected: 0,
            pending: 0,
          });
        }
        const monthStats = monthMap.get(monthKey)!;
        if (status === 'approved') monthStats.approved++;
        else if (status === 'rejected') monthStats.rejected++;
        else monthStats.pending++;
      });

      setStats(overallStats);
      setCategoryStats(Array.from(categoryMap.values()));
      setMonthlyStats(Array.from(monthMap.values()).sort((a, b) => {
        const [aMonth, aYear] = a.month.split('/');
        const [bMonth, bYear] = b.month.split('/');
        return new Date(parseInt(aYear), parseInt(aMonth) - 1).getTime() - 
               new Date(parseInt(bYear), parseInt(bMonth) - 1).getTime();
      }));
    } catch (error: any) {
      console.error('Error loading stats:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const approvalRate = stats && stats.approved + stats.rejected > 0
    ? ((stats.approved / (stats.approved + stats.rejected)) * 100).toFixed(1)
    : '0';

  const pieData = [
    { name: 'מאושר', value: stats?.approved || 0, color: '#10b981' },
    { name: 'נדחה', value: stats?.rejected || 0, color: '#ef4444' },
    { name: 'ממתין', value: stats?.pending || 0, color: '#f59e0b' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-blue-950/50 border-b border-indigo-100 dark:border-indigo-900/30 sticky top-0 z-10 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">דשבורד סטטיסטיקות</h1>
                <p className="text-sm text-muted-foreground mt-0.5">ניתוח הוצאות ואישורים</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[180px] h-10 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl">
                  <SelectValue placeholder="בחר עובד" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                  <SelectItem value="all">כל הצוות</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[160px] h-10 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                  <SelectItem value="current_month">חודש נוכחי</SelectItem>
                  <SelectItem value="last_month">חודש שעבר</SelectItem>
                  <SelectItem value="last_3_months">3 חודשים אחרונים</SelectItem>
                  <SelectItem value="last_6_months">6 חודשים אחרונים</SelectItem>
                  <SelectItem value="current_year">שנה נוכחית</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => navigate('/manager/personal-stats')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all"
              >
                <User className="w-4 h-4 ml-1.5" />
                סטטיסטיקות אישיות
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/manager/dashboard')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all"
              >
                <Shield className="w-4 h-4 ml-1.5" />
                דשבורד מנהל
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                חזרה לדשבורד
                <ArrowRight className="w-4 h-4 mr-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    הוצאות מאושרות
                  </p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats?.approved || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">₪{(stats?.approvedAmount || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-600" />
                    הוצאות נדחו
                  </p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{stats?.rejected || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">₪{(stats?.rejectedAmount || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm cursor-pointer"
            onClick={() => navigate('/manager/dashboard')}
          >
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    ממתינות לאישור
                  </p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">לחץ לצפייה בדוחות</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    אחוז אישור
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{approvalRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">מתוך {(stats?.approved || 0) + (stats?.rejected || 0)} הוצאות</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Status Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>התפלגות סטטוס הוצאות</CardTitle>
            <CardDescription>חלוקה לפי מצב אישור</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Category Stats */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>הוצאות לפי קטגוריה</CardTitle>
            <CardDescription>מאושר מול נדחה</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  tickFormatter={getCategoryLabel}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={getCategoryLabel}
                  formatter={(value: number) => [value, '']}
                />
                <Legend />
                <Bar dataKey="approved" fill="#10b981" name="מאושר" />
                <Bar dataKey="rejected" fill="#ef4444" name="נדחה" />
                <Bar dataKey="pending" fill="#f59e0b" name="ממתין" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Monthly Trend */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>מגמה חודשית</CardTitle>
            <CardDescription>הוצאות לאורך זמן</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="מאושר" />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} name="נדחה" />
                <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="ממתין" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Amount by Category */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>סכומים לפי קטגוריה</CardTitle>
            <CardDescription>סה"כ בשקלים</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  tickFormatter={getCategoryLabel}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={getCategoryLabel}
                  formatter={(value: number) => [`₪${value.toFixed(2)}`, 'סכום']}
                />
                <Bar dataKey="amount" fill="#3b82f6" name="סכום כולל">
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>פירוט לפי קטגוריה</CardTitle>
          <CardDescription>נתונים מפורטים</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold">קטגוריה</th>
                  <th className="text-center p-3 font-semibold">סה"כ</th>
                  <th className="text-center p-3 font-semibold text-green-600">מאושר</th>
                  <th className="text-center p-3 font-semibold text-red-600">נדחה</th>
                  <th className="text-center p-3 font-semibold text-amber-600">ממתין</th>
                  <th className="text-right p-3 font-semibold">סכום כולל</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map((cat) => (
                  <tr key={cat.category} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">{getCategoryLabel(cat.category)}</td>
                    <td className="text-center p-3">{cat.total}</td>
                    <td className="text-center p-3 text-green-600">{cat.approved}</td>
                    <td className="text-center p-3 text-red-600">{cat.rejected}</td>
                    <td className="text-center p-3 text-amber-600">{cat.pending}</td>
                    <td className="text-right p-3 font-semibold">₪{cat.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-bold">
                  <td className="p-3">סה"כ</td>
                  <td className="text-center p-3">
                    {categoryStats.reduce((sum, cat) => sum + cat.total, 0)}
                  </td>
                  <td className="text-center p-3 text-green-600">
                    {categoryStats.reduce((sum, cat) => sum + cat.approved, 0)}
                  </td>
                  <td className="text-center p-3 text-red-600">
                    {categoryStats.reduce((sum, cat) => sum + cat.rejected, 0)}
                  </td>
                  <td className="text-center p-3 text-amber-600">
                    {categoryStats.reduce((sum, cat) => sum + cat.pending, 0)}
                  </td>
                  <td className="text-right p-3">
                    ₪{categoryStats.reduce((sum, cat) => sum + cat.amount, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      </main>
    </div>
  );
};

export default ManagerStats;
