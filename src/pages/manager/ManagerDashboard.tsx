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
import { Shield, Check, X, Eye, Loader2, ArrowRight, Calendar, DollarSign, CheckSquare, BarChart3 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { he } from "date-fns/locale";

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

  const approveReport = async (reportId: string, showToast = true) => {
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

      // Get user profile for email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, accounting_manager_email')
        .eq('id', report.user_id)
        .single();

      if (profileError) throw profileError;

      // Send emails
      const { error: emailError } = await supabase.functions.invoke('send-accounting-report', {
        body: {
          userEmail: profileData.username,
          accountingEmail: profileData.accounting_manager_email,
          reportId: reportId,
          reportDetails: {
            destination: report.trip_destination,
            startDate: report.trip_start_date,
            endDate: report.trip_end_date,
            totalAmount: report.total_amount_ils,
            employeeName: report.profiles.full_name,
          }
        }
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
      }

      if (showToast) {
        toast({
          title: "הדוח אושר",
          description: "הדוח אושר בהצלחה ונשלח להנהלת חשבונות",
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
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'open',
          manager_approval_requested_at: null,
          manager_approval_token: null,
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "הדוח נדחה",
        description: "הדוח הוחזר לעובד לתיקון",
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">דשבורד מנהל.ת</h1>
                <p className="text-sm text-muted-foreground">אישור דוחות הצוות</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/manager/advanced-reports')}>
                <BarChart3 className="w-4 h-4 ml-2" />
                דוחות מתקדמים
              </Button>
              <Button variant="outline" onClick={() => navigate('/manager/stats')}>
                <BarChart3 className="w-4 h-4 ml-2" />
                סטטיסטיקות
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                חזרה לדשבורד
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </div>
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
                  <p className="text-sm text-muted-foreground">דוחות ממתינים</p>
                  <p className="text-3xl font-bold text-orange-600">{reports.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נבחרו לאישור</p>
                  <p className="text-3xl font-bold text-blue-600">{selectedReports.size}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ לאישור</p>
                  <p className="text-3xl font-bold text-green-600">
                    ₪{reports.filter(r => selectedReports.has(r.id)).reduce((sum, r) => sum + (r.total_amount_ils || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
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
    </div>
  );
}
