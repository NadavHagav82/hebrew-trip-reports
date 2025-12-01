import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, TrendingUp, Users, Building2, DollarSign, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import * as XLSX from "xlsx";

interface DepartmentStats {
  department: string;
  totalAmount: number;
  reportCount: number;
  employeeCount: number;
  avgPerEmployee: number;
  avgPerReport: number;
  categories: Record<string, number>;
  monthlyTrend: Array<{ month: string; amount: number }>;
}

interface Report {
  id: string;
  user_id: string;
  total_amount_ils: number;
  status: string;
  created_at: string;
}

interface Expense {
  report_id: string;
  category: string;
  amount_in_ils: number;
  expense_date: string;
}

interface Profile {
  id: string;
  department: string;
  full_name: string;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const categoryLabels: Record<string, string> = {
  flights: "טיסות",
  accommodation: "לינה",
  food: "אוכל",
  transportation: "תחבורה",
  miscellaneous: "שונות",
};

const OrganizationalAnalytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  useEffect(() => {
    checkAccounting();
  }, []);

  useEffect(() => {
    loadOrganizationalData();
  }, [timeRange, periodOffset]);

  const checkAccounting = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "accounting_manager")
      .maybeSingle();

    if (!roles) {
      toast({
        title: "אין הרשאה",
        description: "דף זה מיועד למנהלי הנהלת חשבונות בלבד",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
  };

  const getPeriodDates = () => {
    const now = new Date();
    let start: Date, end: Date;

    if (timeRange === "month") {
      const targetDate = subMonths(now, periodOffset);
      start = startOfMonth(targetDate);
      end = endOfMonth(targetDate);
    } else if (timeRange === "quarter") {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - periodOffset * 3, 1);
      start = quarterStart;
      end = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
    } else {
      start = startOfYear(now);
      end = endOfYear(now);
    }

    return { start, end };
  };

  const loadOrganizationalData = async () => {
    setLoading(true);
    const { start, end } = getPeriodDates();

    try {
      // Load all reports in period
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("id, user_id, total_amount_ils, status, created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .eq("status", "closed");

      if (reportsError) throw reportsError;

      // Load all expenses for these reports
      const reportIds = reportsData?.map(r => r.id) || [];
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("report_id, category, amount_in_ils, expense_date")
        .in("report_id", reportIds);

      if (expensesError) throw expensesError;

      // Load all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, department, full_name");

      if (profilesError) throw profilesError;

      // Process data by department
      const deptMap = new Map<string, DepartmentStats>();

      profilesData?.forEach((profile: Profile) => {
        if (!deptMap.has(profile.department)) {
          deptMap.set(profile.department, {
            department: profile.department,
            totalAmount: 0,
            reportCount: 0,
            employeeCount: 0,
            avgPerEmployee: 0,
            avgPerReport: 0,
            categories: {},
            monthlyTrend: [],
          });
        }
        const stats = deptMap.get(profile.department)!;
        stats.employeeCount += 1;
      });

      reportsData?.forEach((report: Report) => {
        const profile = profilesData?.find((p: Profile) => p.id === report.user_id);
        if (!profile) return;

        const dept = profile.department;
        const stats = deptMap.get(dept);
        if (!stats) return;

        stats.totalAmount += report.total_amount_ils || 0;
        stats.reportCount += 1;

        // Calculate category breakdown
        const reportExpenses = expensesData?.filter((e: Expense) => e.report_id === report.id) || [];
        reportExpenses.forEach((exp: Expense) => {
          const cat = categoryLabels[exp.category] || exp.category;
          stats.categories[cat] = (stats.categories[cat] || 0) + exp.amount_in_ils;
        });
      });

      // Calculate monthly trends for each department
      const monthlyData = new Map<string, Map<string, number>>();
      
      expensesData?.forEach((exp: Expense) => {
        const report = reportsData?.find((r: Report) => r.id === exp.report_id);
        if (!report) return;

        const profile = profilesData?.find((p: Profile) => p.id === report.user_id);
        if (!profile) return;

        const month = format(new Date(exp.expense_date), "MM/yyyy");
        
        if (!monthlyData.has(profile.department)) {
          monthlyData.set(profile.department, new Map());
        }
        
        const deptMonthly = monthlyData.get(profile.department)!;
        deptMonthly.set(month, (deptMonthly.get(month) || 0) + exp.amount_in_ils);
      });

      // Add monthly trends to stats
      deptMap.forEach((stats, dept) => {
        const deptMonthly = monthlyData.get(dept);
        if (deptMonthly) {
          stats.monthlyTrend = Array.from(deptMonthly.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({ month, amount: Math.round(amount) }));
        }

        stats.avgPerEmployee = stats.employeeCount > 0 ? Math.round(stats.totalAmount / stats.employeeCount) : 0;
        stats.avgPerReport = stats.reportCount > 0 ? Math.round(stats.totalAmount / stats.reportCount) : 0;
      });

      setDepartmentStats(Array.from(deptMap.values()).sort((a, b) => b.totalAmount - a.totalAmount));
    } catch (error) {
      console.error("Error loading organizational data:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון נתונים ארגוניים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalOrganizationAmount = () => {
    return departmentStats.reduce((sum, dept) => sum + dept.totalAmount, 0);
  };

  const getTotalReports = () => {
    return departmentStats.reduce((sum, dept) => sum + dept.reportCount, 0);
  };

  const getTotalEmployees = () => {
    return departmentStats.reduce((sum, dept) => sum + dept.employeeCount, 0);
  };

  const getDepartmentComparisonData = () => {
    return departmentStats.map(dept => ({
      name: dept.department,
      total: dept.totalAmount,
      avgPerEmployee: dept.avgPerEmployee,
      reports: dept.reportCount,
    }));
  };

  const getCategoryBreakdownData = () => {
    const categoryTotals: Record<string, number> = {};
    
    departmentStats.forEach(dept => {
      Object.entries(dept.categories).forEach(([cat, amount]) => {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      });
    });

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  };

  const getTopSpendingDepartments = (limit = 5) => {
    return departmentStats.slice(0, limit);
  };

  const getDepartmentRadarData = () => {
    const categories = Object.keys(categoryLabels);
    const selectedDepts = selectedDepartment === "all" 
      ? departmentStats.slice(0, 3) 
      : departmentStats.filter(d => d.department === selectedDepartment);

    return categories.map(cat => {
      const label = categoryLabels[cat];
      const dataPoint: any = { category: label };
      
      selectedDepts.forEach(dept => {
        dataPoint[dept.department] = dept.categories[label] || 0;
      });
      
      return dataPoint;
    });
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [{
      "סה\"כ ארגוני": getTotalOrganizationAmount(),
      "מספר דוחות": getTotalReports(),
      "מספר עובדים": getTotalEmployees(),
      "ממוצע לעובד": Math.round(getTotalOrganizationAmount() / getTotalEmployees()),
    }];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "סיכום כללי");

    // Department details
    const deptData = departmentStats.map(dept => ({
      "מחלקה": dept.department,
      "סה\"כ": dept.totalAmount,
      "דוחות": dept.reportCount,
      "עובדים": dept.employeeCount,
      "ממוצע לעובד": dept.avgPerEmployee,
      "ממוצע לדוח": dept.avgPerReport,
    }));
    const deptWs = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(wb, deptWs, "לפי מחלקות");

    // Category breakdown
    const categoryData = getCategoryBreakdownData();
    const categoryWs = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, categoryWs, "לפי קטגוריות");

    const { start, end } = getPeriodDates();
    const filename = `ניתוח_ארגוני_${format(start, "dd-MM-yyyy")}_עד_${format(end, "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "הדוח יוצא בהצלחה",
      description: "הקובץ הורד למחשב",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">טוען נתונים...</div>
      </div>
    );
  }

  const totalOrgAmount = getTotalOrganizationAmount();
  const totalReports = getTotalReports();
  const totalEmployees = getTotalEmployees();

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניתוח ארגוני מתקדם</h1>
          <p className="text-muted-foreground">פילוח מפורט לפי מחלקות וקטגוריות</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/accounting/home")}>חזרה</Button>
          <Button onClick={exportToExcel} variant="outline">
            <Download className="ml-2 h-4 w-4" />
            ייצוא ל-Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">תקופה</label>
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">חודשי</SelectItem>
                <SelectItem value="quarter">רבעוני</SelectItem>
                <SelectItem value="year">שנתי</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">החלף תקופה</label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setPeriodOffset(periodOffset + 1)} variant="outline">◄ קודם</Button>
              <Button size="sm" onClick={() => periodOffset > 0 && setPeriodOffset(periodOffset - 1)} variant="outline">הבא ►</Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">מחלקה</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המחלקות</SelectItem>
                {departmentStats.map(dept => (
                  <SelectItem key={dept.department} value={dept.department}>
                    {dept.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">סה"כ ארגוני</p>
              <p className="text-2xl font-bold">{totalOrgAmount.toLocaleString()} ₪</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">מחלקות</p>
              <p className="text-2xl font-bold">{departmentStats.length}</p>
            </div>
            <Building2 className="h-8 w-8 text-chart-2" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">עובדים</p>
              <p className="text-2xl font-bold">{totalEmployees}</p>
            </div>
            <Users className="h-8 w-8 text-chart-3" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ממוצע לעובד</p>
              <p className="text-2xl font-bold">
                {totalEmployees > 0 ? Math.round(totalOrgAmount / totalEmployees).toLocaleString() : 0} ₪
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-chart-4" />
          </div>
        </Card>
      </div>

      {/* Top Spending Departments Alert */}
      <Card className="p-4 mb-6 bg-orange-50 dark:bg-orange-950/20 border-orange-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-orange-900 dark:text-orange-100">מחלקות מובילות בהוצאות</h3>
            <div className="mt-2 space-y-1">
              {getTopSpendingDepartments(3).map((dept, idx) => (
                <div key={dept.department} className="text-sm flex items-center gap-2">
                  <span className="font-medium">{idx + 1}. {dept.department}:</span>
                  <span>{dept.totalAmount.toLocaleString()} ₪</span>
                  <span className="text-muted-foreground">({dept.reportCount} דוחות)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="departments" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="departments">מחלקות</TabsTrigger>
          <TabsTrigger value="categories">קטגוריות</TabsTrigger>
          <TabsTrigger value="comparison">השוואה</TabsTrigger>
          <TabsTrigger value="radar">מפת חום</TabsTrigger>
          <TabsTrigger value="details">פירוט</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">סה"כ הוצאות לפי מחלקה</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getDepartmentComparisonData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" name="סה״כ הוצאות" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">ממוצע לעובד לפי מחלקה</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getDepartmentComparisonData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgPerEmployee" fill="hsl(var(--chart-2))" name="ממוצע לעובד" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">פילוח קטגוריות ארגוני</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie data={getCategoryBreakdownData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                    {getCategoryBreakdownData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">קטגוריות - גרף עמודות</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getCategoryBreakdownData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="hsl(var(--chart-3))" name="סכום" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">השוואת מחלקות - מדדים מרובים</h3>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={getDepartmentComparisonData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" name="סה״כ" />
                <Bar dataKey="avgPerEmployee" fill="hsl(var(--chart-2))" name="ממוצע לעובד" />
                <Bar dataKey="reports" fill="hsl(var(--chart-4))" name="מספר דוחות" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="radar">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">מפת חום - קטגוריות לפי מחלקות</h3>
            <ResponsiveContainer width="100%" height={500}>
              <RadarChart data={getDepartmentRadarData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis />
                <Tooltip />
                <Legend />
                {(selectedDepartment === "all" ? departmentStats.slice(0, 3) : departmentStats.filter(d => d.department === selectedDepartment)).map((dept, idx) => (
                  <Radar
                    key={dept.department}
                    name={dept.department}
                    dataKey={dept.department}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">פירוט מלא לפי מחלקות</h3>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מחלקה</TableHead>
                    <TableHead>סה"כ הוצאות</TableHead>
                    <TableHead>דוחות</TableHead>
                    <TableHead>עובדים</TableHead>
                    <TableHead>ממוצע לעובד</TableHead>
                    <TableHead>ממוצע לדוח</TableHead>
                    <TableHead>% מסך הארגון</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentStats.map((dept) => {
                    const percentage = ((dept.totalAmount / totalOrgAmount) * 100).toFixed(1);
                    const trend = dept.totalAmount > (totalOrgAmount / departmentStats.length);
                    
                    return (
                      <TableRow key={dept.department}>
                        <TableCell className="font-medium">{dept.department}</TableCell>
                        <TableCell>{dept.totalAmount.toLocaleString()} ₪</TableCell>
                        <TableCell>{dept.reportCount}</TableCell>
                        <TableCell>{dept.employeeCount}</TableCell>
                        <TableCell>{dept.avgPerEmployee.toLocaleString()} ₪</TableCell>
                        <TableCell>{dept.avgPerReport.toLocaleString()} ₪</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{percentage}%</span>
                            {trend ? (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationalAnalytics;