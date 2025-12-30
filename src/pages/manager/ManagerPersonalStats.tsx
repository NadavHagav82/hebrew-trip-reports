import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, Clock, BarChart3, User, ArrowRight, FileText } from 'lucide-react';
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

const ManagerPersonalStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('current_month');
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

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

      // Get personal expenses (where the logged-in user is the report owner)
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          *,
          reports!inner(
            status,
            submitted_at,
            user_id
          )
        `)
        .eq('reports.user_id', user?.id)
        .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
        .lte('expense_date', format(endDate, 'yyyy-MM-dd'));

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/50 dark:via-cyan-950/50 dark:to-teal-950/50 border-b border-blue-100 dark:border-blue-900/30 sticky top-0 z-10 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-cyan-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">סטטיסטיקות אישיות</h1>
                <p className="text-sm text-muted-foreground mt-0.5">ההוצאות והדוחות שלי</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[160px] h-10 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl">
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
              <Button 
                variant="outline" 
                onClick={() => navigate('/manager/stats')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all"
              >
                <BarChart3 className="w-4 h-4 ml-1.5" />
                סטטיסטיקות צוות
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

          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    ממתינות לאישור
                  </p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.pending || 0}</p>
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
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    אחוז אישור
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{approvalRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">מתוך {(stats?.approved || 0) + (stats?.rejected || 0)} הוצאות</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Bar Chart */}
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-cyan-500" />
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-right mb-4">הוצאות לפי קטגוריה</h3>
              <p className="text-sm text-muted-foreground text-right mb-4">מאושר מול נדחה</p>
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="category" 
                      tickFormatter={getCategoryLabel}
                      width={80}
                    />
                    <Tooltip 
                      labelFormatter={getCategoryLabel}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="approved" fill="#10b981" name="מאושר" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="rejected" fill="#ef4444" name="נדחה" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p>אין נתונים להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Pie Chart */}
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-cyan-400 to-teal-500" />
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-right mb-4">התפלגות סטטוס הוצאות</h3>
              <p className="text-sm text-muted-foreground text-right mb-4">חלוקה לפי מצב אישור</p>
              {pieData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p>אין נתונים להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        {monthlyStats.length > 0 && (
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-500" />
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-right mb-4">מגמה חודשית</h3>
              <p className="text-sm text-muted-foreground text-right mb-4">מספר הוצאות לפי חודש</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={3} name="מאושר" dot={{ fill: '#10b981', r: 4 }} />
                  <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={3} name="נדחה" dot={{ fill: '#ef4444', r: 4 }} />
                  <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={3} name="ממתין" dot={{ fill: '#f59e0b', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Category Details Table */}
        {categoryStats.length > 0 && (
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-right mb-4">פירוט לפי קטגוריה</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">קטגוריה</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">סה"כ</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">מאושר</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">נדחה</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">ממתין</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.map((cat) => (
                      <tr key={cat.category} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#6b7280' }}
                            />
                            <span className="font-medium">{getCategoryLabel(cat.category)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">{cat.total}</td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">{cat.approved}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">{cat.rejected}</td>
                        <td className="py-3 px-4 text-right text-amber-600 font-medium">{cat.pending}</td>
                        <td className="py-3 px-4 text-right font-medium">₪{cat.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ManagerPersonalStats;
