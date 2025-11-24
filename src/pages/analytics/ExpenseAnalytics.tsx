import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Loader2, ArrowRight, Download, TrendingUp, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters } from "date-fns";
import { he } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from 'xlsx';

interface Report {
  id: string;
  user_id: string;
  trip_destination: string;
  approved_at: string;
  total_amount_ils: number;
  profiles: {
    full_name: string;
    department: string;
  };
}

interface Expense {
  category: string;
  amount_in_ils: number;
  expense_date: string;
}

type PeriodType = 'month' | 'quarter';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const categoryLabels: Record<string, string> = {
  flights: 'טיסות',
  accommodation: 'לינה',
  food: 'אוכל',
  transportation: 'תחבורה',
  miscellaneous: 'שונות',
};

interface TeamMember {
  id: string;
  full_name: string;
}

export default function ExpenseAnalytics() {
  const [reports, setReports] = useState<Report[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedPeriod, setSelectedPeriod] = useState(0); // 0 = current, 1 = last, etc.
  const [isManager, setIsManager] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all'); // 'all' or user_id
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    checkManagerStatus();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, periodType, selectedPeriod, isManager, selectedEmployee]);

  const checkManagerStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'manager' });
    const managerStatus = !!data;
    setIsManager(managerStatus);
    
    // If manager, load team members
    if (managerStatus) {
      await loadTeamMembers();
    }
  };

  const loadTeamMembers = async () => {
    if (!user) return;
    
    try {
      // Get team members
      const { data: members, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('manager_id', user.id)
        .order('full_name');

      if (error) throw error;

      // Get manager's own profile
      const { data: managerProfile, error: managerError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', user.id)
        .single();

      if (managerError) throw managerError;

      // Combine manager and team members
      const allMembers = [
        { id: managerProfile.id, full_name: `${managerProfile.full_name} (אני)` },
        ...(members || [])
      ];

      setTeamMembers(allMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const getPeriodDates = () => {
    const now = new Date();
    let start: Date, end: Date;

    if (periodType === 'month') {
      const targetMonth = subMonths(now, selectedPeriod);
      start = startOfMonth(targetMonth);
      end = endOfMonth(targetMonth);
    } else {
      const targetQuarter = subQuarters(now, selectedPeriod);
      start = startOfQuarter(targetQuarter);
      end = endOfQuarter(targetQuarter);
    }

    return { start, end };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodDates();

      let reportsData = [];

      if (isManager && user) {
        // For managers: get reports of their team members + their own reports
        const { data: teamMembersData, error: teamError } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id);

        if (teamError) throw teamError;

        const teamMemberIds = teamMembersData?.map(m => m.id) || [];
        // Include the manager's own ID
        const allUserIds = [user.id, ...teamMemberIds];

        // Filter by selected employee if not "all"
        const userIdsToQuery = selectedEmployee === 'all' ? allUserIds : [selectedEmployee];

        if (userIdsToQuery.length > 0) {
          const { data: reports, error: reportsError } = await supabase
            .from('reports')
            .select(`
              *,
              profiles!reports_user_id_fkey (
                full_name,
                department
              )
            `)
            .eq('status', 'closed')
            .in('user_id', userIdsToQuery)
            .gte('approved_at', start.toISOString())
            .lte('approved_at', end.toISOString());

          if (reportsError) throw reportsError;
          reportsData = reports || [];
        }
      } else if (user) {
        // For regular users: get only their own reports
        const { data: reports, error: reportsError } = await supabase
          .from('reports')
          .select(`
            *,
            profiles!reports_user_id_fkey (
              full_name,
              department
            )
          `)
          .eq('status', 'closed')
          .eq('user_id', user.id)
          .gte('approved_at', start.toISOString())
          .lte('approved_at', end.toISOString());

        if (reportsError) throw reportsError;
        reportsData = reports || [];
      }

      setReports(reportsData);

      // Load expenses for these reports
      const reportIds = (reportsData || []).map(r => r.id);
      if (reportIds.length > 0) {
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('category, amount_in_ils, expense_date')
          .in('report_id', reportIds);

        if (expensesError) throw expensesError;
        setExpenses(expensesData || []);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון נתוני אנליטיקה",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryData = () => {
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!categoryTotals[exp.category]) {
        categoryTotals[exp.category] = 0;
      }
      categoryTotals[exp.category] += exp.amount_in_ils;
    });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      name: categoryLabels[category] || category,
      value: Math.round(amount),
      amount: amount,
    }));
  };

  const getTimelineData = () => {
    const timeline: Record<string, number> = {};
    reports.forEach(report => {
      const date = format(new Date(report.approved_at), periodType === 'month' ? 'dd/MM' : 'MMM', { locale: he });
      if (!timeline[date]) {
        timeline[date] = 0;
      }
      timeline[date] += report.total_amount_ils;
    });

    return Object.entries(timeline)
      .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const getTotalAmount = () => {
    return reports.reduce((sum, r) => sum + r.total_amount_ils, 0);
  };

  const getEmployeeStats = () => {
    if (!isManager) return [];

    const employeeStats: Record<string, { name: string; reportCount: number; totalAmount: number }> = {};

    reports.forEach(report => {
      const userId = report.user_id;
      const userName = report.profiles?.full_name || 'לא ידוע';

      if (!employeeStats[userId]) {
        employeeStats[userId] = {
          name: userName,
          reportCount: 0,
          totalAmount: 0,
        };
      }

      employeeStats[userId].reportCount += 1;
      employeeStats[userId].totalAmount += report.total_amount_ils;
    });

    return Object.entries(employeeStats).map(([userId, stats]) => ({
      userId,
      name: stats.name,
      reportCount: stats.reportCount,
      totalAmount: Math.round(stats.totalAmount),
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  };

  const getEmployeeComparisonData = () => {
    if (!isManager) return [];

    const employeeStats = getEmployeeStats();
    return employeeStats.map(stat => ({
      name: stat.name.length > 15 ? stat.name.substring(0, 15) + '...' : stat.name,
      amount: stat.totalAmount,
      reports: stat.reportCount,
    }));
  };

  const getOutlierWarnings = () => {
    if (!isManager || reports.length === 0) return [];

    const employeeStats = getEmployeeStats();
    if (employeeStats.length < 2) return [];

    const averageAmount = employeeStats.reduce((sum, s) => sum + s.totalAmount, 0) / employeeStats.length;
    const threshold = averageAmount * 1.5; // 50% above average

    return employeeStats.filter(stat => stat.totalAmount > threshold).map(stat => ({
      name: stat.name,
      amount: stat.totalAmount,
      average: Math.round(averageAmount),
      percentage: Math.round(((stat.totalAmount - averageAmount) / averageAmount) * 100),
    }));
  };

  const exportData = () => {
    const { start, end } = getPeriodDates();
    const periodLabel = periodType === 'month' 
      ? format(start, 'MMMM yyyy', { locale: he })
      : `רבעון ${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;

    const categoryData = getCategoryData();
    const employeeStatsData = getEmployeeStats();

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      [`דוח סיכום הוצאות - ${periodLabel}`],
      [],
      ['סיכום כללי'],
      [`סה"כ הוצאות`, `₪${getTotalAmount().toLocaleString()}`],
      ['מספר דוחות', reports.length],
      [],
      ['סיכום לפי קטגוריה'],
      ['קטגוריה', 'סכום (₪)'],
      ...categoryData.map(d => [d.name, d.amount]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths
    ws1['!cols'] = [
      { wch: 35 },
      { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'סיכום');

    // Employee details sheet for managers
    if (isManager && employeeStatsData.length > 0) {
      const employeeData = [
        ['סטטיסטיקות עובדים'],
        [],
        ['שם עובד', 'מספר דוחות', 'סה"כ הוצאות (₪)'],
        ...employeeStatsData.map(emp => [
          emp.name,
          emp.reportCount,
          emp.totalAmount
        ])
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(employeeData);
      
      ws2['!cols'] = [
        { wch: 35 },
        { wch: 18 },
        { wch: 25 }
      ];

      XLSX.utils.book_append_sheet(wb, ws2, 'עובדים');
    }

    // Detailed reports sheet
    const detailedData = [
      ['דוחות מפורטים'],
      [],
      ['תאריך אישור', 'שם עובד', 'יעד', 'סכום כולל (₪)'],
      ...reports.map(r => [
        format(new Date(r.approved_at), 'dd/MM/yyyy'),
        r.profiles?.full_name || '',
        r.trip_destination,
        r.total_amount_ils
      ])
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(detailedData);
    
    ws3['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 30 },
      { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws3, 'דוחות מפורטים');

    // Write file
    XLSX.writeFile(wb, `סיכום_הוצאות_${periodLabel.replace(/ /g, '_')}.xlsx`);

    toast({
      title: "הקובץ יוצא בהצלחה",
      description: "דוח Excel נוצר עם מספר דפים",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { start, end } = getPeriodDates();
  const periodLabel = periodType === 'month' 
    ? format(start, 'MMMM yyyy', { locale: he })
    : `רבעון ${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;

  const categoryData = getCategoryData();
  const timelineData = getTimelineData();
  const totalAmount = getTotalAmount();
  const employeeStats = getEmployeeStats();
  const employeeComparisonData = getEmployeeComparisonData();
  const outlierWarnings = getOutlierWarnings();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">אנליטיקה והוצאות</h1>
                <p className="text-sm text-muted-foreground">
                  {isManager ? 'סיכום דוחות הצוות שלך' : 'סיכום הדוחות שלך'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              חזרה לדשבורד
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Period Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex gap-4 items-center flex-wrap">
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">חודשי</SelectItem>
                    <SelectItem value="quarter">רבעוני</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedPeriod.toString()} onValueChange={(v) => setSelectedPeriod(parseInt(v))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map(i => {
                      const date = periodType === 'month' ? subMonths(new Date(), i) : subQuarters(new Date(), i);
                      const label = periodType === 'month'
                        ? format(date, 'MMMM yyyy', { locale: he })
                        : `רבעון ${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                      return (
                        <SelectItem key={i} value={i.toString()}>
                          {i === 0 ? `${label} (נוכחי)` : label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {isManager && teamMembers.length > 0 && (
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="בחר עובד" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הצוות</SelectItem>
                      {teamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button onClick={exportData} variant="outline">
                <Download className="w-4 h-4 ml-2" />
                ייצוא דוח
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Outlier Warnings for Managers */}
        {isManager && outlierWarnings.length > 0 && selectedEmployee === 'all' && (
          <Card className="mb-6 border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="text-orange-700 dark:text-orange-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                התראות על חריגות בהוצאות
              </CardTitle>
              <CardDescription>עובדים שחורגים ב-50% ומעלה מהממוצע</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {outlierWarnings.map((warning, idx) => (
                  <div key={idx} className="p-4 bg-white dark:bg-card rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-orange-900 dark:text-orange-100">{warning.name}</p>
                        <p className="text-sm text-muted-foreground">
                          הוציא ₪{warning.amount.toLocaleString()} ({warning.percentage}%+ מהממוצע)
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-muted-foreground">ממוצע הצוות</p>
                        <p className="font-bold">₪{warning.average.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Statistics for Managers */}
        {isManager && employeeStats.length > 0 && selectedEmployee === 'all' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>סטטיסטיקות עובדים</CardTitle>
              <CardDescription>סיכום פעילות כל עובד בצוות</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employeeStats.map((stat, idx) => (
                  <Card key={idx} className="border-2 hover:border-primary transition-colors">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl">👤</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2">{stat.name}</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">דוחות:</span>
                            <span className="font-semibold">{stat.reportCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">סה"כ:</span>
                            <span className="font-bold text-primary">₪{stat.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Comparison Chart for Managers */}
        {isManager && employeeComparisonData.length > 0 && selectedEmployee === 'all' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>השוואת הוצאות בין עובדים</CardTitle>
              <CardDescription>גרף עמודות המציג את ההוצאות של כל עובד</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={employeeComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'amount') return [`₪${value.toLocaleString()}`, 'סכום'];
                      if (name === 'reports') return [value, 'דוחות'];
                      return value;
                    }}
                  />
                  <Legend 
                    formatter={(value: string) => {
                      if (value === 'amount') return 'סכום (₪)';
                      if (value === 'reports') return 'מספר דוחות';
                      return value;
                    }}
                  />
                  <Bar dataKey="amount" fill="#8884d8" name="amount" />
                  <Bar dataKey="reports" fill="#82ca9d" name="reports" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין נתונים לתקופה זו</h3>
              <p className="text-muted-foreground">לא נמצאו דוחות מאושרים ב{periodLabel}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Category Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>התפלגות לפי קטגוריה</CardTitle>
                <CardDescription>חלוקת ההוצאות לפי סוג</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Timeline Chart */}
            {timelineData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>מגמת הוצאות לאורך זמן</CardTitle>
                  <CardDescription>סה"כ הוצאות ליום/חודש</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} name="סכום (₪)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Summary Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>סיכום מפורט</CardTitle>
                <CardDescription>פירוט הוצאות לפי קטגוריה</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      <div className="text-left">
                        <div className="font-bold">₪{cat.amount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {((cat.value / totalAmount) * 100).toFixed(1)}% מסה"כ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
