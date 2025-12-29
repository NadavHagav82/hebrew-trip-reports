import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Save, AlertTriangle, TrendingUp, Calendar, DollarSign, PieChart as PieIcon, BarChart3, UserPlus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters, startOfYear, endOfYear } from "date-fns";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Report {
  id: string;
  user_id: string;
  status: string;
  total_amount_ils: number;
  trip_destination: string;
  created_at: string;
  user_profile?: { full_name: string; department: string };
}

interface Expense {
  id: string;
  report_id: string;
  category: string;
  amount: number;
  amount_in_ils: number;
  currency: string;
  expense_date: string;
  approval_status: string;
}

interface SavedPreference {
  id: string;
  name: string;
  filters: any;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const categoryLabels: Record<string, string> = {
  flights: "טיסות",
  accommodation: "לינה",
  food: "אוכל",
  transportation: "תחבורה",
  miscellaneous: "שונות",
};

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  open: "פתוח",
  pending_approval: "ממתין לאישור",
  closed: "סגור",
};

const AdvancedReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // Filters
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year">("month");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("all");
  
  // Saved preferences
  const [savedPreferences, setSavedPreferences] = useState<SavedPreference[]>([]);
  const [preferenceName, setPreferenceName] = useState("");
  
  // Alerts
  const [alertThreshold, setAlertThreshold] = useState<number>(10000);
  const [showAlerts, setShowAlerts] = useState(true);
  
  // Request employee dialog
  const [showRequestEmployeeDialog, setShowRequestEmployeeDialog] = useState(false);
  const [requestEmployeeForm, setRequestEmployeeForm] = useState({
    employeeName: "",
    employeeEmail: "",
    department: "",
    notes: "",
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  useEffect(() => {
    checkManagerAndLoadData();
    loadSavedPreferences();
  }, []);

  useEffect(() => {
    if (teamMembers.length > 0) {
      loadData();
    } else if (teamMembers !== undefined) {
      // If we have loaded team members but the list is empty, stop loading
      setLoading(false);
    }
  }, [periodType, periodOffset, selectedEmployee, selectedCategory, selectedStatus, selectedCurrency, teamMembers]);

  const checkManagerAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "manager")
      .maybeSingle();

    if (!roles) {
      toast({
        title: "אין הרשאה",
        description: "דף זה מיועד למנהלים בלבד",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    await loadTeamMembers(user.id);
  };

  const loadTeamMembers = async (managerId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, department")
      .eq("manager_id", managerId);

    if (error) {
      console.error("Error loading team members:", error);
      setLoading(false);
      return;
    }

    setTeamMembers(data || []);
    
    // If no team members, stop loading
    if (!data || data.length === 0) {
      setLoading(false);
    }
  };

  const getPeriodDates = () => {
    const now = new Date();
    let start: Date, end: Date;

    if (periodType === "month") {
      const targetDate = subMonths(now, periodOffset);
      start = startOfMonth(targetDate);
      end = endOfMonth(targetDate);
    } else if (periodType === "quarter") {
      const targetDate = subQuarters(now, periodOffset);
      start = startOfQuarter(targetDate);
      end = endOfQuarter(targetDate);
    } else {
      start = startOfYear(now);
      end = endOfYear(now);
    }

    return { start, end };
  };

  const loadData = async () => {
    setLoading(true);
    
    // If no team members, show empty state
    if (teamMembers.length === 0) {
      setReports([]);
      setExpenses([]);
      setLoading(false);
      return;
    }
    
    const { start, end } = getPeriodDates();

    let reportsQuery = supabase
      .from("reports")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (selectedEmployee !== "all") {
      reportsQuery = reportsQuery.eq("user_id", selectedEmployee);
    } else {
      const memberIds = teamMembers.map(m => m.id);
      reportsQuery = reportsQuery.in("user_id", memberIds);
    }

    if (selectedStatus !== "all") {
      reportsQuery = reportsQuery.eq("status", selectedStatus as any);
    }

    const { data: reportsData, error: reportsError } = await reportsQuery;

    if (reportsError) {
      console.error("Error loading reports:", reportsError);
      setLoading(false);
      return;
    }

    // Fetch profiles for these reports
    const reportsWithProfiles = await Promise.all(
      (reportsData || []).map(async (report) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, department")
          .eq("id", report.user_id)
          .single();
        return { ...report, user_profile: profile || undefined };
      })
    );

    setReports(reportsWithProfiles);

    if (reportsWithProfiles && reportsWithProfiles.length > 0) {
      const reportIds = reportsWithProfiles.map(r => r.id);
      let expensesQuery = supabase
        .from("expenses")
        .select("*")
        .in("report_id", reportIds);

      if (selectedCategory !== "all") {
        expensesQuery = expensesQuery.eq("category", selectedCategory as any);
      }

      if (selectedCurrency !== "all") {
        expensesQuery = expensesQuery.eq("currency", selectedCurrency as any);
      }

      const { data: expensesData, error: expensesError } = await expensesQuery;

      if (expensesError) {
        console.error("Error loading expenses:", expensesError);
      } else {
        setExpenses(expensesData || []);
      }
    } else {
      setExpenses([]);
    }

    setLoading(false);
  };

  const loadSavedPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("report_preferences")
      .select("*")
      .eq("user_id", user.id);

    if (data) {
      setSavedPreferences(data);
    }
  };

  const savePreference = async () => {
    if (!preferenceName.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין שם למועדף",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filters = {
      periodType,
      periodOffset,
      selectedEmployee,
      selectedCategory,
      selectedStatus,
      selectedCurrency,
    };

    const { error } = await supabase
      .from("report_preferences")
      .insert({
        user_id: user.id,
        name: preferenceName,
        filters,
      });

    if (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את המועדף",
        variant: "destructive",
      });
    } else {
      toast({
        title: "נשמר בהצלחה",
        description: "המועדף נשמר בהצלחה",
      });
      setPreferenceName("");
      loadSavedPreferences();
    }
  };

  const loadPreference = (pref: SavedPreference) => {
    const filters = pref.filters;
    setPeriodType(filters.periodType || "month");
    setPeriodOffset(filters.periodOffset || 0);
    setSelectedEmployee(filters.selectedEmployee || "all");
    setSelectedCategory(filters.selectedCategory || "all");
    setSelectedStatus(filters.selectedStatus || "all");
    setSelectedCurrency(filters.selectedCurrency || "all");
  };

  const getCategoryData = () => {
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = categoryLabels[exp.category] || exp.category;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount_in_ils;
    });

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  };

  const getStatusData = () => {
    const statusTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const status = statusLabels[exp.approval_status] || exp.approval_status;
      statusTotals[status] = (statusTotals[status] || 0) + 1;
    });

    return Object.entries(statusTotals).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const getTimelineData = () => {
    const monthlyTotals: Record<string, number> = {};
    
    expenses.forEach(exp => {
      const month = format(new Date(exp.expense_date), "MM/yyyy");
      monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount_in_ils;
    });

    return Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month,
        amount: Math.round(amount),
      }));
  };

  const getCurrencyData = () => {
    const currencyTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      currencyTotals[exp.currency] = (currencyTotals[exp.currency] || 0) + exp.amount;
    });

    return Object.entries(currencyTotals).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  };

  const getEmployeeData = () => {
    const employeeTotals: Record<string, { name: string; amount: number; count: number }> = {};
    
    reports.forEach(report => {
      const empId = report.user_id;
      const empName = report.user_profile?.full_name || "לא ידוע";
      const reportExpenses = expenses.filter(e => e.report_id === report.id);
      const totalAmount = reportExpenses.reduce((sum, e) => sum + e.amount_in_ils, 0);

      if (!employeeTotals[empId]) {
        employeeTotals[empId] = { name: empName, amount: 0, count: 0 };
      }
      employeeTotals[empId].amount += totalAmount;
      employeeTotals[empId].count += 1;
    });

    return Object.values(employeeTotals)
      .map(emp => ({
        name: emp.name,
        amount: Math.round(emp.amount),
        count: emp.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  const getOutliers = () => {
    const employeeData = getEmployeeData();
    if (employeeData.length === 0) return [];

    const avgAmount = employeeData.reduce((sum, e) => sum + e.amount, 0) / employeeData.length;
    
    return employeeData.filter(emp => emp.amount > alertThreshold || emp.amount > avgAmount * 1.5);
  };

  const handleRequestEmployee = async () => {
    if (!requestEmployeeForm.employeeName || !requestEmployeeForm.employeeEmail || !requestEmployeeForm.department) {
      toast({
        title: "שגיאה",
        description: "נא למלא את כל השדות הנדרשים",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingRequest(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "שגיאה",
          description: "משתמש לא מחובר",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.functions.invoke("request-add-employee", {
        body: {
          managerName: profile?.full_name || "",
          managerEmail: profile?.email || user.email,
          employeeName: requestEmployeeForm.employeeName,
          employeeEmail: requestEmployeeForm.employeeEmail,
          department: requestEmployeeForm.department,
          notes: requestEmployeeForm.notes,
        },
      });

      if (error) throw error;

      toast({
        title: "הצלחה",
        description: "הבקשה נשלחה בהצלחה למנהל הנהלת החשבונות",
      });
      setShowRequestEmployeeDialog(false);
      setRequestEmployeeForm({
        employeeName: "",
        employeeEmail: "",
        department: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Error requesting employee:", error);
      toast({
        title: "שגיאה",
        description: "שגיאה בשליחת הבקשה: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const exportToExcel = () => {
    const categoryData = getCategoryData();
    const employeeData = getEmployeeData();
    const timelineData = getTimelineData();

    const wb = XLSX.utils.book_new();
    
    const categoryWs = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, categoryWs, "לפי קטגוריה");

    const employeeWs = XLSX.utils.json_to_sheet(employeeData);
    XLSX.utils.book_append_sheet(wb, employeeWs, "לפי עובד");

    const timelineWs = XLSX.utils.json_to_sheet(timelineData);
    XLSX.utils.book_append_sheet(wb, timelineWs, "מגמות");

    const detailedData = expenses.map(exp => {
      const report = reports.find(r => r.id === exp.report_id);
      return {
        "עובד": report?.user_profile?.full_name || "",
        "תאריך": format(new Date(exp.expense_date), "dd/MM/yyyy"),
        "קטגוריה": categoryLabels[exp.category] || exp.category,
        "תיאור": "",
        "סכום": exp.amount,
        "מטבע": exp.currency,
        "בשקלים": exp.amount_in_ils,
        "סטטוס": statusLabels[exp.approval_status] || exp.approval_status,
      };
    });
    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedWs, "פירוט מלא");

    const { start, end } = getPeriodDates();
    const filename = `דוח_מתקדם_${format(start, "dd-MM-yyyy")}_עד_${format(end, "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "הדוח יוצא בהצלחה",
      description: "הקובץ הורד למחשב",
    });
  };

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount_in_ils, 0);
  const outliers = showAlerts ? getOutliers() : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">טוען נתונים...</div>
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <div className="container mx-auto p-4 sm:p-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">דוחות מתקדמים</h1>
          <Button size="sm" onClick={() => navigate("/manager/dashboard")}>חזרה לדשבורד</Button>
        </div>
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <AlertTriangle className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">אין עובדים בצוות</h2>
            <p className="text-muted-foreground max-w-md">
              לא נמצאו עובדים המשויכים אליך כמנהל. תוכל לבקש הוספת עובדים באמצעות הכפתור למטה.
            </p>
            <Button 
              onClick={() => setShowRequestEmployeeDialog(true)}
              className="mt-4"
            >
              <UserPlus className="ml-2 h-4 w-4" />
              בקש הוספת עובד
            </Button>
          </div>
        </Card>

        <Dialog open={showRequestEmployeeDialog} onOpenChange={setShowRequestEmployeeDialog}>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>בקשה להוספת עובד</DialogTitle>
              <DialogDescription>
                מלא את הפרטים והבקשה תישלח למנהל הנהלת החשבונות
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="employeeName">שם מלא *</Label>
                <Input
                  id="employeeName"
                  value={requestEmployeeForm.employeeName}
                  onChange={(e) => setRequestEmployeeForm({ ...requestEmployeeForm, employeeName: e.target.value })}
                  placeholder="הזן שם מלא"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employeeEmail">אימייל *</Label>
                <Input
                  id="employeeEmail"
                  type="email"
                  value={requestEmployeeForm.employeeEmail}
                  onChange={(e) => setRequestEmployeeForm({ ...requestEmployeeForm, employeeEmail: e.target.value })}
                  placeholder="example@company.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">מחלקה *</Label>
                <Input
                  id="department"
                  value={requestEmployeeForm.department}
                  onChange={(e) => setRequestEmployeeForm({ ...requestEmployeeForm, department: e.target.value })}
                  placeholder="הזן מחלקה"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">הערות</Label>
                <Textarea
                  id="notes"
                  value={requestEmployeeForm.notes}
                  onChange={(e) => setRequestEmployeeForm({ ...requestEmployeeForm, notes: e.target.value })}
                  placeholder="הערות נוספות (אופציונלי)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRequestEmployeeDialog(false)}
                disabled={isSubmittingRequest}
              >
                ביטול
              </Button>
              <Button
                onClick={handleRequestEmployee}
                disabled={isSubmittingRequest}
              >
                {isSubmittingRequest ? "שולח..." : "שלח בקשה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">דוחות מתקדמים</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/manager/dashboard")}>
            <span className="hidden sm:inline">חזרה לדשבורד</span>
            <span className="sm:hidden">חזרה</span>
          </Button>
          <Button size="sm" onClick={exportToExcel} variant="outline">
            <Download className="ml-1 h-4 w-4" />
            <span className="hidden sm:inline">ייצוא ל-Excel</span>
            <span className="sm:hidden">ייצוא</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">פילטרים</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <Label>תקופה</Label>
            <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
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
            <Label>החלף תקופה</Label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setPeriodOffset(periodOffset + 1)} variant="outline">◄</Button>
              <Button size="sm" onClick={() => periodOffset > 0 && setPeriodOffset(periodOffset - 1)} variant="outline">►</Button>
            </div>
          </div>

          <div>
            <Label>עובד</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כולם</SelectItem>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>קטגוריה</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>סטטוס</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>מטבע</Label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="ILS">ILS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save Preferences */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="שם המועדף"
            value={preferenceName}
            onChange={(e) => setPreferenceName(e.target.value)}
            className="max-w-full sm:max-w-xs"
          />
          <Button size="sm" onClick={savePreference} className="w-full sm:w-auto">
            <Save className="ml-1 h-4 w-4" />
            שמור מועדף
          </Button>
        </div>

        {savedPreferences.length > 0 && (
          <div className="mt-4">
            <Label>מועדפים שמורים</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {savedPreferences.map(pref => (
                <Button key={pref.id} variant="outline" size="sm" onClick={() => loadPreference(pref)}>
                  {pref.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Outliers Alert */}
      {outliers.length > 0 && (
        <Card className="p-4 mb-6 bg-destructive/10 border-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">התראות חריגה</h3>
          </div>
          <div className="mt-2">
            {outliers.map((emp, idx) => (
              <div key={idx} className="text-sm">
                {emp.name} - {emp.amount.toLocaleString()} ₪ (חורג מהממוצע)
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">סה"כ הוצאות</p>
              <p className="text-2xl font-bold">{totalAmount.toLocaleString()} ₪</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">מספר דוחות</p>
              <p className="text-2xl font-bold">{reports.length}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">מספר הוצאות</p>
              <p className="text-2xl font-bold">{expenses.length}</p>
            </div>
            <PieIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ממוצע להוצאה</p>
              <p className="text-2xl font-bold">
                {expenses.length > 0 ? Math.round(totalAmount / expenses.length).toLocaleString() : 0} ₪
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="category" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="category">קטגוריות</TabsTrigger>
          <TabsTrigger value="timeline">מגמות</TabsTrigger>
          <TabsTrigger value="employees">עובדים</TabsTrigger>
          <TabsTrigger value="currency">מטבעות</TabsTrigger>
          <TabsTrigger value="status">סטטוס</TabsTrigger>
          <TabsTrigger value="details">פירוט</TabsTrigger>
        </TabsList>

        <TabsContent value="category">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">התפלגות לפי קטגוריה (עוגה)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={getCategoryData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {getCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">השוואה לפי קטגוריה (עמודות)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getCategoryData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">מגמות לאורך זמן</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={getTimelineData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">הוצאות לפי עובד</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getEmployeeData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Legend />
                <Bar dataKey="amount" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="currency">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">התפלגות לפי מטבע</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={getCurrencyData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {getCurrencyData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">סטטוס אישורים</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getStatusData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">טבלת פירוט מלא</h3>
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>עובד</TableHead>
                    <TableHead>קטגוריה</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>מטבע</TableHead>
                    <TableHead>בשקלים</TableHead>
                    <TableHead>סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map(exp => {
                    const report = reports.find(r => r.id === exp.report_id);
                    return (
                      <TableRow key={exp.id}>
                        <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{report?.user_profile?.full_name || "-"}</TableCell>
                        <TableCell>{categoryLabels[exp.category]}</TableCell>
                        <TableCell>{exp.amount.toLocaleString()}</TableCell>
                        <TableCell>{exp.currency}</TableCell>
                        <TableCell>{exp.amount_in_ils.toLocaleString()}</TableCell>
                        <TableCell>{statusLabels[exp.approval_status]}</TableCell>
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

export default AdvancedReports;