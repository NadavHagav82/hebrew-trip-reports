import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  total_amount_ils: number;
  daily_allowance?: number;
  status: string;
}

interface Expense {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_ils: number;
}

const ApproveReport = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employeeName, setEmployeeName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  useEffect(() => {
    loadReport();
  }, [token]);

  const loadReport = async () => {
    if (!token) {
      toast({
        title: 'שגיאה',
        description: 'קישור לא תקף',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get report by token
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*, profiles!reports_user_id_fkey(full_name)')
        .eq('manager_approval_token', token)
        .single();

      if (reportError || !reportData) {
        toast({
          title: 'שגיאה',
          description: 'דוח לא נמצא או אישור כבר בוצע',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Check if already processed
      if (reportData.status !== 'pending_approval') {
        toast({
          title: 'שימו לב',
          description: 'דוח זה כבר אושר או נדחה',
          variant: 'default',
        });
        setLoading(false);
        return;
      }

      setReport(reportData as Report);
      setEmployeeName((reportData as any).profiles?.full_name || 'לא ידוע');

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('report_id', reportData.id)
        .order('expense_date', { ascending: true });

      if (!expensesError && expensesData) {
        setExpenses(expensesData as Expense[]);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הדוח',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!token) return;

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-report', {
        body: {
          token,
          action: 'approve',
        },
      });

      if (error) throw error;

      toast({
        title: 'הדוח אושר בהצלחה',
        description: 'הדוח אושר ונשלח להנהלת חשבונות',
      });

      // Reload to show success state
      await loadReport();
    } catch (error: any) {
      console.error('Error approving report:', error);
      toast({
        title: 'שגיאה באישור',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!token || !rejectionReason.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין סיבת דחייה',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-report', {
        body: {
          token,
          action: 'reject',
          rejectionReason,
        },
      });

      if (error) throw error;

      toast({
        title: 'הדוח נדחה',
        description: 'הדוח הוחזר לעובד לתיקון',
      });

      // Reload to show success state
      await loadReport();
    } catch (error: any) {
      console.error('Error rejecting report:', error);
      toast({
        title: 'שגיאה בדחייה',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const calculateTripDuration = () => {
    if (!report) return 0;
    const start = new Date(report.trip_start_date);
    const end = new Date(report.trip_end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!report || report.status !== 'pending_approval') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle>דוח לא זמין</CardTitle>
            <CardDescription>
              {report?.status === 'closed' ? 'דוח זה כבר אושר' : report?.status === 'open' ? 'דוח זה כבר נדחה' : 'הדוח לא נמצא או שהאישור כבר בוצע'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto max-w-4xl py-8">
        <Card className="mb-6 shadow-lg">
          <CardHeader className="text-center border-b bg-gradient-to-l from-muted/30 to-transparent">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">בקשת אישור דוח נסיעה</CardTitle>
            <CardDescription className="text-base">מוגש על ידי {employeeName}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="mb-6 shadow-md">
          <CardHeader className="pb-4 bg-gradient-to-l from-muted/30 to-transparent border-b">
            <CardTitle>פרטי הנסיעה</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold">{report.trip_destination}</span>
                <span className="text-muted-foreground">:יעד</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold">{report.trip_purpose}</span>
                <span className="text-muted-foreground">:מטרת הנסיעה</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold">{format(new Date(report.trip_start_date), 'dd/MM/yyyy')}</span>
                <span className="text-muted-foreground">:תאריך התחלה</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold">{format(new Date(report.trip_end_date), 'dd/MM/yyyy')}</span>
                <span className="text-muted-foreground">:תאריך סיום</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold text-primary">{calculateTripDuration()} ימים</span>
                <span className="text-muted-foreground">:משך הנסיעה</span>
              </div>
              {report.daily_allowance && (
                <div className="flex justify-between py-2 border-b">
                  <span className="font-semibold">
                    ${report.daily_allowance} (סה״כ ${report.daily_allowance * calculateTripDuration()})
                  </span>
                  <span className="text-muted-foreground">:אש״ל ליום</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 shadow-md">
          <CardHeader className="pb-4 bg-gradient-to-l from-muted/30 to-transparent border-b">
            <CardTitle>הוצאות ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {expenses.map((expense, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{expense.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {getCategoryLabel(expense.category)} • {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold">₪{expense.amount_in_ils.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between font-bold text-xl">
                  <span>₪{report.total_amount_ils.toFixed(2)}</span>
                  <span>:סה"כ</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!showRejectionForm ? (
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowRejectionForm(true)}
              disabled={processing}
              className="min-w-[150px]"
            >
              <XCircle className="w-5 h-5 ml-2" />
              דחה דוח
            </Button>
            <Button
              size="lg"
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 min-w-[150px]"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  מאשר...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 ml-2" />
                  אשר דוח
                </>
              )}
            </Button>
          </div>
        ) : (
          <Card className="shadow-md">
            <CardHeader className="pb-4">
              <CardTitle>דחיית דוח</CardTitle>
              <CardDescription>נא להזין את הסיבה לדחיית הדוח</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rejection_reason">סיבת הדחייה *</Label>
                  <Textarea
                    id="rejection_reason"
                    placeholder="הזן סיבה מפורטת לדחיית הדוח..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    disabled={processing}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectionForm(false);
                      setRejectionReason('');
                    }}
                    disabled={processing}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={processing || !rejectionReason.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        מעבד...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 ml-2" />
                        אשר דחייה
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ApproveReport;
