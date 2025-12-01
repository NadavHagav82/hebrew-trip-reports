import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calculator, DollarSign, FileText, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AccountingStats {
  totalReports: number;
  approvedReports: number;
  pendingReports: number;
  totalAmount: number;
  averageAmount: number;
  averageProcessingTime: number;
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

interface DepartmentStats {
  department: string;
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

const AccountingStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('current_month');
  const [stats, setStats] = useState<AccountingStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, timeRange]);

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

      // Get all approved reports in the date range
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select(`
          *,
          profiles!reports_user_id_fkey(department),
          expenses(*)
        `)
        .eq('status', 'closed')
        .gte('approved_at', format(startDate, 'yyyy-MM-dd'))
        .lte('approved_at', format(endDate, 'yyyy-MM-dd'));

      if (reportsError) throw reportsError;

      // Calculate overall stats
      const totalReports = reports?.length || 0;
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
        totalReports,
        approvedReports: totalReports,
        pendingReports: 0,
        totalAmount,
        averageAmount,
        averageProcessingTime,
      });

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
        const monthKey = format(new Date(report.approved_at), 'MM/yyyy');
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

      // Department stats
      const deptMap = new Map<string, DepartmentStats>();
      reports?.forEach((report: any) => {
        const dept = report.profiles?.department || 'לא ידוע';
        if (!deptMap.has(dept)) {
          deptMap.set(dept, {
            department: dept,
            count: 0,
            amount: 0,
          });
        }
        const deptStats = deptMap.get(dept)!;
        deptStats.count++;
        deptStats.amount += report.total_amount_ils || 0;
      });
      setDepartmentStats(Array.from(deptMap.values()));

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-8 h-8 text-primary" />
            סטטיסטיקות הנהלת חשבונות
          </h1>
          <p className="text-muted-foreground mt-1">ניתוח דוחות מאושרים</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">חודש נוכחי</SelectItem>
              <SelectItem value="last_month">חודש שעבר</SelectItem>
              <SelectItem value="last_3_months">3 חודשים אחרונים</SelectItem>
              <SelectItem value="last_6_months">6 חודשים אחרונים</SelectItem>
              <SelectItem value="current_year">שנה נוכחית</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/accounting/dashboard')}>
            דשבורד ראשי
          </Button>
          <Button variant="outline" onClick={() => navigate('/accounting')}>
            חזרה לדשבורד
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              דוחות מאושרים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.approvedReports || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              סכום כולל
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
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

        <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              מחלקות פעילות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{departmentStats.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Category Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>התפלגות לפי קטגוריות</CardTitle>
            <CardDescription>מספר הוצאות לפי סוג</CardDescription>
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
                  dataKey="count"
                >
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'הוצאות']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Category Amounts */}
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
                <Bar dataKey="amount" fill="#3b82f6">
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                  ))}
                </Bar>
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

        {/* Bar Chart - Department Stats */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>דוחות לפי מחלקה</CardTitle>
            <CardDescription>התפלגות ארגונית</CardDescription>
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
                <Bar dataKey="count" fill="#8b5cf6" name="מספר דוחות" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>פירוט לפי קטגוריה</CardTitle>
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

        {/* Department Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>פירוט לפי מחלקה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold">מחלקה</th>
                    <th className="text-center p-3 font-semibold">דוחות</th>
                    <th className="text-right p-3 font-semibold">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map((dept) => (
                    <tr key={dept.department} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{dept.department}</td>
                      <td className="text-center p-3">{dept.count}</td>
                      <td className="text-right p-3 font-semibold">₪{dept.amount.toFixed(2)}</td>
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
};

export default AccountingStats;
