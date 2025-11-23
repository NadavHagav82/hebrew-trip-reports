import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Eye, Loader2, ArrowRight, Download, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ApprovedReport {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  total_amount_ils: number;
  submitted_at: string;
  approved_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    employee_id: string;
    department: string;
  };
}

export default function AccountingDashboard() {
  const [reports, setReports] = useState<ApprovedReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ApprovedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadApprovedReports();
  }, [user]);

  useEffect(() => {
    filterResults();
  }, [reports, searchQuery, filterMonth, filterDepartment]);

  const loadApprovedReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          profiles!reports_user_id_fkey (
            full_name,
            employee_id,
            department
          )
        `)
        .eq('status', 'closed')
        .order('approved_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading approved reports:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון דוחות מאושרים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterResults = () => {
    let filtered = [...reports];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.trip_destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.profiles.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.profiles.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Month filter
    if (filterMonth !== 'all') {
      filtered = filtered.filter(r => {
        const approvedDate = new Date(r.approved_at);
        const reportMonth = `${approvedDate.getFullYear()}-${String(approvedDate.getMonth() + 1).padStart(2, '0')}`;
        return reportMonth === filterMonth;
      });
    }

    // Department filter
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(r => r.profiles.department === filterDepartment);
    }

    setFilteredReports(filtered);
  };

  const exportToCSV = () => {
    const headers = ['תאריך אישור', 'שם עובד', 'מס\' עובד', 'מחלקה', 'יעד', 'מטרה', 'תאריכי נסיעה', 'סכום לתשלום'];
    const rows = filteredReports.map(r => [
      format(new Date(r.approved_at), 'dd/MM/yyyy HH:mm', { locale: he }),
      r.profiles.full_name,
      r.profiles.employee_id || 'אין',
      r.profiles.department,
      r.trip_destination,
      r.trip_purpose,
      `${format(new Date(r.trip_start_date), 'dd/MM/yyyy')} - ${format(new Date(r.trip_end_date), 'dd/MM/yyyy')}`,
      `₪${r.total_amount_ils.toLocaleString()}`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דוחות_מאושרים_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();

    toast({
      title: "הקובץ יוצא",
      description: `${filteredReports.length} דוחות יוצאו בהצלחה`,
    });
  };

  const getUniqueMonths = () => {
    const months = new Set<string>();
    reports.forEach(r => {
      const date = new Date(r.approved_at);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  };

  const getUniqueDepartments = () => {
    const departments = new Set<string>();
    reports.forEach(r => departments.add(r.profiles.department));
    return Array.from(departments).sort();
  };

  const getTotalAmount = () => {
    return filteredReports.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalAmount = getTotalAmount();
  const uniqueMonths = getUniqueMonths();
  const uniqueDepartments = getUniqueDepartments();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">דשבורד הנהלת חשבונות</h1>
                <p className="text-sm text-muted-foreground">דוחות מאושרים לתשלום</p>
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
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות מאושרים</p>
                  <p className="text-3xl font-bold text-green-600">{filteredReports.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ לתשלום</p>
                  <p className="text-3xl font-bold text-blue-600">
                    ₪{totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ממוצע לדוח</p>
                  <p className="text-3xl font-bold text-purple-600">
                    ₪{filteredReports.length > 0 ? Math.round(totalAmount / filteredReports.length).toLocaleString() : 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              סינון וחיפוש
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש עובד, יעד, מחלקה..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>

              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="כל החודשים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החודשים</SelectItem>
                  {uniqueMonths.map(month => {
                    const [year, monthNum] = month.split('-');
                    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                    return (
                      <SelectItem key={month} value={month}>
                        {format(date, 'MMMM yyyy', { locale: he })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="כל המחלקות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המחלקות</SelectItem>
                  {uniqueDepartments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={exportToCSV} variant="outline" className="w-full">
                <Download className="w-4 h-4 ml-2" />
                ייצוא ל-Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>דוחות מאושרים</CardTitle>
            <CardDescription>
              רשימת כל הדוחות שאושרו וממתינים לתשלום
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <Calculator className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין דוחות מאושרים</h3>
                <p className="text-muted-foreground">
                  {searchQuery || filterMonth !== 'all' || filterDepartment !== 'all'
                    ? 'לא נמצאו דוחות התואמים לסינון'
                    : 'עדיין לא אושרו דוחות במערכת'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך אישור</TableHead>
                      <TableHead>עובד</TableHead>
                      <TableHead>מחלקה</TableHead>
                      <TableHead>יעד</TableHead>
                      <TableHead>תאריכי נסיעה</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          {format(new Date(report.approved_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{report.profiles.full_name}</div>
                            {report.profiles.employee_id && (
                              <div className="text-sm text-muted-foreground">
                                מס' {report.profiles.employee_id}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{report.profiles.department}</TableCell>
                        <TableCell className="font-medium">{report.trip_destination}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(report.trip_start_date), 'dd/MM', { locale: he })}
                            {' - '}
                            {format(new Date(report.trip_end_date), 'dd/MM/yy', { locale: he })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-semibold">
                            ₪{(report.total_amount_ils || 0).toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/reports/${report.id}`)}
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            צפייה
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
