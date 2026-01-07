import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Shield, Check, X, Eye, Loader2, ArrowRight, Calendar, DollarSign, CheckSquare, BarChart3, FileText, PieChart } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SendToAccountingDialog } from "@/components/SendToAccountingDialog";

interface PendingReport {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  status: string;
  total_amount_ils: number;
  submitted_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    employee_id: string;
    department: string;
  };
}

export default function ManagerDashboard() {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [showAccountingDialog, setShowAccountingDialog] = useState(false);
  const [approvedReportData, setApprovedReportData] = useState<{
    reportId: string;
    destination: string;
    employeeName: string;
  } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkManagerStatus();
  }, [user]);

  useEffect(() => {
    if (isManager) {
      // Set up real-time subscription for new pending reports
      const channel = supabase
        .channel('manager-reports-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reports',
            filter: 'status=eq.pending_approval'
          },
          () => {
            loadPendingReports();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isManager]);

  const checkManagerStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const { data, error } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'manager' });

    if (error) {
      console.error('Error checking manager status:', error);
      navigate('/');
      return;
    }

    if (!data) {
      toast({
        title: "גישה נדחתה",
        description: "אין לך הרשאות למנהל",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsManager(true);
    loadPendingReports();
  };

  const loadPendingReports = async () => {
    if (!user) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          profiles!reports_user_id_fkey (
            full_name,
            employee_id,
            department,
            manager_id
          )
        `)
        .eq('status', 'pending_approval')
        .eq('profiles.manager_id', user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading pending reports:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון דוחות ממתינים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedReports.size === reports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports.map(r => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedReports.size === 0) {
      toast({
        title: "לא נבחרו דוחות",
        description: "נא לבחור לפחות דוח אחד לאישור",
        variant: "destructive",
      });
      return;
    }

    setBulkApproving(true);
    let successCount = 0;
    let failCount = 0;

    for (const reportId of selectedReports) {
      try {
        await approveReport(reportId, false);
        successCount++;
      } catch (error) {
        console.error(`Failed to approve report ${reportId}:`, error);
        failCount++;
      }
    }

    setBulkApproving(false);
    setSelectedReports(new Set());
    
    if (failCount === 0) {
      toast({
        title: "הדוחות אושרו בהצלחה",
        description: `${successCount} דוחות אושרו`,
      });
    } else {
      toast({
        title: "אישור חלקי",
        description: `אושרו ${successCount} דוחות, ${failCount} נכשלו`,
        variant: "destructive",
      });
    }

    loadPendingReports();
  };

  const approveReport = async (reportId: string, showToast = true, skipDialog = false) => {
    if (showToast) {
      setProcessingReportId(reportId);
    }

    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) throw new Error('דוח לא נמצא');

      // Update report status
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'closed',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      // Also approve all expenses in this report
      const { error: expensesError } = await supabase
        .from('expenses')
        .update({
          approval_status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('report_id', reportId);

      if (expensesError) {
        console.error('Error approving expenses:', expensesError);
      }

      // Create notification for the employee
      await supabase.from('notifications').insert({
        user_id: report.user_id,
        type: 'report_approved',
        title: 'הדוח שלך אושר',
        message: `הדוח ל${report.trip_destination} אושר על ידי המנהל.`,
        report_id: reportId,
      });

      if (showToast && !skipDialog) {
        // Show dialog to send to accounting - set data BEFORE reloading reports
        setApprovedReportData({
          reportId: reportId,
          destination: report.trip_destination,
          employeeName: report.profiles.full_name,
        });
        setShowAccountingDialog(true);
        // Reload reports after setting dialog data
        loadPendingReports();
        
        toast({
          title: "הדוח אושר",
          description: "כעת ניתן לשלוח להנהלת חשבונות",
        });
      } else if (showToast) {
        toast({
          title: "הדוח אושר",
          description: "הדוח אושר בהצלחה",
        });
        loadPendingReports();
      }
    } catch (error) {
      console.error('Error approving report:', error);
      if (showToast) {
        toast({
          title: "שגיאה באישור הדוח",
          description: error instanceof Error ? error.message : "אירעה שגיאה בלתי צפויה",
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      if (showToast) {
        setProcessingReportId(null);
      }
    }
  };

  const rejectReport = async (reportId: string) => {
    setProcessingReportId(reportId);
    
    try {
      // Get the report to find the user_id and destination
      const { data: reportData } = await supabase
        .from('reports')
        .select('user_id, trip_destination')
        .eq('id', reportId)
        .single();

      const { error } = await supabase
        .from('reports')
        .update({
          status: 'open',
          manager_approval_requested_at: null,
          manager_approval_token: null,
        })
        .eq('id', reportId);

      if (error) throw error;

      // Create notification for the employee
      if (reportData?.user_id) {
        await supabase.from('notifications').insert({
          user_id: reportData.user_id,
          type: 'report_returned',
          title: 'הדוח הוחזר לבירור',
          message: `הדוח ל${reportData.trip_destination || 'נסיעה'} הוחזר אליך עם הערות מהמנהל.`,
          report_id: reportId,
        });
      }

      toast({
        title: "הדוח הוחזר לבירור",
        description: "הדוח הוחזר לעובד עם הערות",
      });

      loadPendingReports();
    } catch (error) {
      console.error('Error rejecting report:', error);
      toast({
        title: "שגיאה בדחיית הדוח",
        description: error instanceof Error ? error.message : "אירעה שגיאה בלתי צפויה",
        variant: "destructive",
      });
    } finally {
      setProcessingReportId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isManager) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/50 dark:via-amber-950/50 dark:to-yellow-950/50 border-b border-orange-100 dark:border-orange-900/30 fixed top-0 inset-x-0 z-50 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">דשבורד מנהל.ת</h1>
                <p className="text-sm text-muted-foreground mt-0.5">אישור דוחות הצוות</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={() => navigate('/manager/advanced-reports')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all"
                title="רשימת דוחות מפורטת עם סינון וייצוא"
              >
                <FileText className="w-4 h-4 ml-1.5" />
                <span className="hidden sm:inline">דוחות</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/manager/stats')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all"
                title="גרפים וניתוח מגמות"
              >
                <PieChart className="w-4 h-4 ml-1.5" />
                <span className="hidden sm:inline">סטט'</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <span className="hidden sm:inline">חזרה</span>
                <ArrowRight className="w-4 h-4 mr-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-32 pb-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות ממתינים</p>
                  <p className="text-3xl font-bold text-orange-600">{reports.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/50 dark:to-orange-800/50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נבחרו לאישור</p>
                  <p className="text-3xl font-bold text-blue-600">{selectedReports.size}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 rounded-xl flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ לאישור</p>
                  <p className="text-3xl font-bold text-green-600">
                    ₪{reports.filter(r => selectedReports.has(r.id)).reduce((sum, r) => sum + (r.total_amount_ils || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/50 dark:to-emerald-800/50 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        {selectedReports.size > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    נבחרו {selectedReports.size} דוחות
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedReports(new Set())}
                    disabled={bulkApproving}
                  >
                    בטל בחירה
                  </Button>
                  <Button 
                    onClick={handleBulkApprove}
                    disabled={bulkApproving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {bulkApproving ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        מאשר...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 ml-2" />
                        אשר הכל ({selectedReports.size})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>דוחות ממתינים לאישור</CardTitle>
            <CardDescription>
              דוחות שהוגשו על ידי עובדים וממתינים לאישור שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין דוחות ממתינים</h3>
                <p className="text-muted-foreground">
                  כל הדוחות אושרו! 🎉
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedReports.size === reports.length && reports.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>תאריך הגשה</TableHead>
                      <TableHead>עובד</TableHead>
                      <TableHead>מחלקה</TableHead>
                      <TableHead>יעד</TableHead>
                      <TableHead>תאריכי נסיעה</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id} className={selectedReports.has(report.id) ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedReports.has(report.id)}
                            onCheckedChange={() => toggleReportSelection(report.id)}
                            disabled={bulkApproving}
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/reports/view/${report.id}`)}
                              disabled={processingReportId === report.id || bulkApproving}
                              title="בדוק הוצאות בודדות ואשר/דחה כל אחת בנפרד"
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              בדוק פירוט
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveReport(report.id)}
                              disabled={processingReportId === report.id || bulkApproving}
                              title="אשר את כל ההוצאות בדוח"
                            >
                              {processingReportId === report.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 ml-1" />
                                  אשר הכל
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectReport(report.id)}
                              disabled={processingReportId === report.id || bulkApproving}
                              title="דחה את כל הדוח"
                            >
                              <X className="w-4 h-4 ml-1" />
                              דחה הכל
                            </Button>
                          </div>
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

      {/* Send to Accounting Dialog */}
      {approvedReportData && (
        <SendToAccountingDialog
          open={showAccountingDialog}
          onOpenChange={setShowAccountingDialog}
          reportId={approvedReportData.reportId}
          reportDestination={approvedReportData.destination}
          employeeName={approvedReportData.employeeName}
        />
      )}
    </div>
  );
}
