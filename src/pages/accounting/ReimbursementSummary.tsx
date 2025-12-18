import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  ArrowRight,
  Loader2,
  Download,
  Users,
  Wallet,
  CreditCard,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

interface EmployeeReimbursement {
  userId: string;
  fullName: string;
  department: string;
  totalOutOfPocket: number;
  totalCompanyCard: number;
  reportCount: number;
  reports: {
    id: string;
    tripDestination: string;
    outOfPocket: number;
    companyCard: number;
    status: string;
  }[];
}

export default function ReimbursementSummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAccountingManager, setIsAccountingManager] = useState(false);
  const [reimbursements, setReimbursements] = useState<EmployeeReimbursement[]>([]);
  const [statusFilter, setStatusFilter] = useState<"closed" | "pending_approval">("closed");
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  useEffect(() => {
    checkAccountingManagerStatus();
  }, [user]);

  useEffect(() => {
    if (isAccountingManager) {
      loadReimbursementData();
    }
  }, [isAccountingManager, statusFilter]);

  const checkAccountingManagerStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "accounting_manager");

      if (!roles || roles.length === 0) {
        toast({
          title: "אין הרשאה",
          description: "רק מנהלי הנהלת חשבונות יכולים לגשת לדף זה",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAccountingManager(true);
    } catch (error) {
      console.error("Error checking accounting manager status:", error);
      navigate('/');
    }
  };

  const loadReimbursementData = async () => {
    setLoading(true);
    try {
      // Load reports with their expenses and profiles
      const { data: reports, error: reportsError } = await supabase
        .from("reports")
        .select(`
          id,
          user_id,
          trip_destination,
          status,
          profiles!reports_user_id_fkey (
            full_name,
            department
          )
        `)
        .eq("status", statusFilter);

      if (reportsError) throw reportsError;

      if (!reports || reports.length === 0) {
        setReimbursements([]);
        setLoading(false);
        return;
      }

      // Get all expenses for these reports
      const reportIds = reports.map(r => r.id);
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("report_id, amount_in_ils, payment_method")
        .in("report_id", reportIds);

      if (expensesError) throw expensesError;

      // Group by employee
      const employeeMap = new Map<string, EmployeeReimbursement>();

      reports.forEach(report => {
        const reportExpenses = expenses?.filter(e => e.report_id === report.id) || [];
        const outOfPocket = reportExpenses
          .filter(e => e.payment_method === 'out_of_pocket')
          .reduce((sum, e) => sum + (e.amount_in_ils || 0), 0);
        const companyCard = reportExpenses
          .filter(e => e.payment_method === 'company_card')
          .reduce((sum, e) => sum + (e.amount_in_ils || 0), 0);

        if (!employeeMap.has(report.user_id)) {
          employeeMap.set(report.user_id, {
            userId: report.user_id,
            fullName: report.profiles?.full_name || 'לא ידוע',
            department: report.profiles?.department || 'לא ידוע',
            totalOutOfPocket: 0,
            totalCompanyCard: 0,
            reportCount: 0,
            reports: []
          });
        }

        const employee = employeeMap.get(report.user_id)!;
        employee.totalOutOfPocket += outOfPocket;
        employee.totalCompanyCard += companyCard;
        employee.reportCount += 1;
        employee.reports.push({
          id: report.id,
          tripDestination: report.trip_destination,
          outOfPocket,
          companyCard,
          status: report.status
        });
      });

      // Sort by total reimbursement needed (descending)
      const sortedReimbursements = Array.from(employeeMap.values())
        .sort((a, b) => b.totalOutOfPocket - a.totalOutOfPocket);

      setReimbursements(sortedReimbursements);
    } catch (error) {
      console.error("Error loading reimbursement data:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את נתוני ההחזרים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = reimbursements.map(emp => ({
      'שם העובד': emp.fullName,
      'מחלקה': emp.department,
      'מספר דוחות': emp.reportCount,
      'הוצאות מכיס (₪)': emp.totalOutOfPocket,
      'כרטיס חברה (₪)': emp.totalCompanyCard,
      'סה"כ (₪)': emp.totalOutOfPocket + emp.totalCompanyCard,
    }));

    // Add summary row
    const totalOutOfPocket = reimbursements.reduce((sum, e) => sum + e.totalOutOfPocket, 0);
    const totalCompanyCard = reimbursements.reduce((sum, e) => sum + e.totalCompanyCard, 0);
    data.push({
      'שם העובד': 'סה"כ',
      'מחלקה': '',
      'מספר דוחות': reimbursements.reduce((sum, e) => sum + e.reportCount, 0),
      'הוצאות מכיס (₪)': totalOutOfPocket,
      'כרטיס חברה (₪)': totalCompanyCard,
      'סה"כ (₪)': totalOutOfPocket + totalCompanyCard,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'סיכום החזרים');
    
    const statusText = statusFilter === 'closed' ? 'מאושרים' : 'ממתינים';
    XLSX.writeFile(wb, `סיכום_החזרים_${statusText}_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "יצוא הושלם",
      description: "הקובץ הורד בהצלחה",
    });
  };

  const totalOutOfPocket = reimbursements.reduce((sum, e) => sum + e.totalOutOfPocket, 0);
  const totalCompanyCard = reimbursements.reduce((sum, e) => sum + e.totalCompanyCard, 0);
  const totalReports = reimbursements.reduce((sum, e) => sum + e.reportCount, 0);

  if (loading && !isAccountingManager) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAccountingManager) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">סיכום החזרים לעובדים</h1>
                <p className="text-sm text-muted-foreground">דוח מנהלי - הוצאות מכיס וכרטיס חברה</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/accounting/home')}>
              חזרה לדשבורד
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" dir="rtl">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "closed" | "pending_approval")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סטטוס דוחות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closed">דוחות מאושרים</SelectItem>
                <SelectItem value="pending_approval">ממתינים לאישור</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportToExcel} disabled={reimbursements.length === 0}>
            <Download className="w-4 h-4 ml-2" />
            ייצוא לאקסל
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">עובדים</p>
                  <p className="text-3xl font-bold text-blue-600">{reimbursements.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות</p>
                  <p className="text-3xl font-bold text-purple-600">{totalReports}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ להחזר</p>
                  <p className="text-3xl font-bold text-orange-600">₪{totalOutOfPocket.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">כרטיס חברה</p>
                  <p className="text-3xl font-bold text-green-600">₪{totalCompanyCard.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle>פירוט לפי עובד</CardTitle>
            <CardDescription>
              לחץ על שורה לצפייה בפירוט הדוחות
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reimbursements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>אין דוחות בסטטוס זה</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם העובד</TableHead>
                    <TableHead className="text-right">מחלקה</TableHead>
                    <TableHead className="text-center">דוחות</TableHead>
                    <TableHead className="text-left">הוצאות מכיס</TableHead>
                    <TableHead className="text-left">כרטיס חברה</TableHead>
                    <TableHead className="text-left">סה"כ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reimbursements.map((employee) => (
                    <>
                      <TableRow 
                        key={employee.userId}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setExpandedEmployee(
                          expandedEmployee === employee.userId ? null : employee.userId
                        )}
                      >
                        <TableCell className="font-medium">{employee.fullName}</TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{employee.reportCount}</Badge>
                        </TableCell>
                        <TableCell className="text-left font-bold text-orange-600">
                          ₪{employee.totalOutOfPocket.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-left text-muted-foreground">
                          ₪{employee.totalCompanyCard.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-left font-bold">
                          ₪{(employee.totalOutOfPocket + employee.totalCompanyCard).toLocaleString()}
                        </TableCell>
                      </TableRow>
                      {expandedEmployee === employee.userId && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/50">
                            <div className="p-4">
                              <h4 className="font-medium mb-3">פירוט דוחות:</h4>
                              <div className="space-y-2">
                                {employee.reports.map((report) => (
                                  <div 
                                    key={report.id}
                                    className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:border-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/reports/${report.id}`);
                                    }}
                                  >
                                    <span className="font-medium">{report.tripDestination}</span>
                                    <div className="flex items-center gap-4">
                                      <span className="text-orange-600">
                                        מכיס: ₪{report.outOfPocket.toLocaleString()}
                                      </span>
                                      <span className="text-muted-foreground">
                                        חברה: ₪{report.companyCard.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
