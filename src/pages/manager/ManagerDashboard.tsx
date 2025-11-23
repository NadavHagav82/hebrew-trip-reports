import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Check, X, Eye, Loader2, ArrowRight, Calendar, DollarSign } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);
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
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: true });

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

  const handleApprove = async (reportId: string) => {
    if (!user) return;
    
    setProcessingReportId(reportId);
    try {
      // Get the report details first to find the user
      const reportData = reports.find(r => r.id === reportId);
      if (!reportData) throw new Error('Report not found');

      const { error } = await supabase
        .from('reports')
        .update({
          status: 'closed',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      // Add to history
      await supabase.from('report_history').insert({
        report_id: reportId,
        action: 'approved',
        performed_by: user.id,
        notes: 'אושר על ידי מנהל'
      });

      // Send email to accounting manager if user has accounting email
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('accounting_manager_email, personal_email')
          .eq('id', reportData.user_id)
          .single();

        // Send to accounting manager
        if (profileData?.accounting_manager_email) {
          await supabase.functions.invoke('send-accounting-report', {
            body: {
              reportId: reportId,
              accountingEmail: profileData.accounting_manager_email,
            }
          });
        }

        // Send to user's personal email
        if (profileData?.personal_email) {
          await supabase.functions.invoke('send-accounting-report', {
            body: {
              reportId: reportId,
              accountingEmail: profileData.personal_email,
            }
          });
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't block the approval if email fails
      }

      toast({
        title: "דוח אושר",
        description: "הדוח אושר בהצלחה ונשלח למנהל החשבונות",
      });

      loadPendingReports();
    } catch (error) {
      console.error('Error approving report:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לאשר את הדוח",
        variant: "destructive",
      });
    } finally {
      setProcessingReportId(null);
    }
  };

  const handleReject = async (reportId: string) => {
    if (!user) return;
    
    const reason = prompt('סיבת הדחייה (אופציונלי):');
    
    setProcessingReportId(reportId);
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'open',
          rejection_reason: reason || 'נדחה על ידי מנהל',
          manager_approval_requested_at: null,
          manager_approval_token: null
        })
        .eq('id', reportId);

      if (error) throw error;

      // Add to history
      await supabase.from('report_history').insert({
        report_id: reportId,
        action: 'rejected',
        performed_by: user.id,
        notes: reason || 'נדחה על ידי מנהל'
      });

      toast({
        title: "דוח נדחה",
        description: "הדוח הוחזר לעובד לתיקון",
      });

      loadPendingReports();
    } catch (error) {
      console.error('Error rejecting report:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לדחות את הדוח",
        variant: "destructive",
      });
    } finally {
      setProcessingReportId(null);
    }
  };

  const calculateDaysWaiting = (submittedAt: string) => {
    const submitted = new Date(submittedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - submitted.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">דשבורד מנהלים</h1>
                <p className="text-sm text-muted-foreground">אישור דוחות נסיעה</p>
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
                  <p className="text-sm text-muted-foreground">דוחות ממתינים</p>
                  <p className="text-3xl font-bold text-orange-600">{reports.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ סכום</p>
                  <p className="text-3xl font-bold">
                    ₪{reports.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ממוצע ימי המתנה</p>
                  <p className="text-3xl font-bold">
                    {reports.length > 0
                      ? Math.round(reports.reduce((sum, r) => sum + calculateDaysWaiting(r.submitted_at), 0) / reports.length)
                      : 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>דוחות ממתינים לאישור</CardTitle>
            <CardDescription>
              דוחות שהוגשו לאישור ממתינים לסקירה ואישור שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין דוחות ממתינים</h3>
                <p className="text-muted-foreground">כל הדוחות אושרו. עבודה מצוינת! 🎉</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>עובד</TableHead>
                      <TableHead>מחלקה</TableHead>
                      <TableHead>יעד</TableHead>
                      <TableHead>תאריכים</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>הוגש</TableHead>
                      <TableHead>ימי המתנה</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const daysWaiting = calculateDaysWaiting(report.submitted_at);
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{report.profiles.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {report.profiles.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{report.profiles.department}</TableCell>
                          <TableCell className="font-medium">{report.trip_destination}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(report.trip_start_date), 'dd/MM/yyyy', { locale: he })}
                              {' - '}
                              {format(new Date(report.trip_end_date), 'dd/MM/yyyy', { locale: he })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              ₪{(report.total_amount_ils || 0).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={daysWaiting > 7 ? "destructive" : daysWaiting > 3 ? "secondary" : "outline"}>
                              {daysWaiting} ימים
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/reports/${report.id}`)}
                                title="צפייה בדוח"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(report.id)}
                                disabled={processingReportId === report.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {processingReportId === report.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-1" />
                                    אשר
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(report.id)}
                                disabled={processingReportId === report.id}
                              >
                                {processingReportId === report.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <X className="w-4 h-4 mr-1" />
                                    דחה
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
