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
import { ManagerAttachmentUpload } from '@/components/ManagerAttachmentUpload';
import { useAuth } from '@/contexts/AuthContext';

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
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_ils: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  manager_comment?: string;
}

interface ExpenseReview {
  expenseId: string;
  status: 'approved' | 'rejected';
  comment: string;
  attachments?: File[];
}

const ApproveReport = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employeeName, setEmployeeName] = useState('');
  const [expenseReviews, setExpenseReviews] = useState<Map<string, ExpenseReview>>(new Map());
  const [generalComment, setGeneralComment] = useState('');

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

  const handleExpenseReview = (expenseId: string, status: 'approved' | 'rejected', comment: string = '', attachments?: File[]) => {
    setExpenseReviews(prev => {
      const newMap = new Map(prev);
      const existingReview = prev.get(expenseId);
      newMap.set(expenseId, { 
        expenseId, 
        status, 
        comment,
        attachments: attachments !== undefined ? attachments : existingReview?.attachments || []
      });
      return newMap;
    });
  };

  const handleAttachmentsChange = (expenseId: string, files: File[]) => {
    const existingReview = expenseReviews.get(expenseId);
    if (existingReview) {
      handleExpenseReview(expenseId, existingReview.status, existingReview.comment, files);
    }
  };

  const handleSubmitReview = async () => {
    if (!token || !report) return;

    // Check if all expenses have been reviewed
    const unreviewedExpenses = expenses.filter(exp => !expenseReviews.has(exp.id));
    if (unreviewedExpenses.length > 0) {
      toast({
        title: 'יש להשלים את הביקורת',
        description: `נותרו ${unreviewedExpenses.length} הוצאות שטרם נבדקו`,
        variant: 'destructive',
      });
      return;
    }

    // Check if rejected expenses have comments
    const rejectedWithoutComments = Array.from(expenseReviews.values())
      .filter(review => review.status === 'rejected' && !review.comment.trim());
    
    if (rejectedWithoutComments.length > 0) {
      toast({
        title: 'חסרות הערות',
        description: 'יש להוסיף הערות לכל ההוצאות שנדחו',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      if (!user?.id) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן לזהות משתמש',
          variant: 'destructive',
        });
        return;
      }

      const reviewsArray = Array.from(expenseReviews.values());
      
      // Upload attachments first
      for (const review of reviewsArray) {
        if (review.attachments && review.attachments.length > 0) {
          for (const file of review.attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${review.expenseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            // Upload file to storage
            const { error: uploadError } = await supabase.storage
              .from('manager-attachments')
              .upload(fileName, file);

            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              throw new Error(`שגיאה בהעלאת הקובץ ${file.name}`);
            }

            // Save attachment metadata to database
            const { error: dbError } = await supabase
              .from('manager_comment_attachments')
              .insert({
                expense_id: review.expenseId,
                file_name: file.name,
                file_url: fileName,
                file_size: file.size,
                file_type: file.type,
                uploaded_by: user.id,
              });

            if (dbError) {
              console.error('Error saving attachment metadata:', dbError);
              throw new Error(`שגיאה בשמירת פרטי הקובץ ${file.name}`);
            }
          }
        }
      }
      
      // Send reviews to edge function (without file objects)
      const reviewsForSubmit = reviewsArray.map(({ attachments, ...review }) => review);
      
      const { error } = await supabase.functions.invoke('approve-report', {
        body: {
          token,
          expenseReviews: reviewsForSubmit,
          generalComment: generalComment.trim() || null,
        },
      });

      if (error) throw error;

      const approvedCount = reviewsArray.filter(r => r.status === 'approved').length;
      const rejectedCount = reviewsArray.filter(r => r.status === 'rejected').length;

      if (rejectedCount === 0) {
        toast({
          title: 'הדוח אושר בהצלחה',
          description: 'כל ההוצאות אושרו והדוח נשלח להנהלת חשבונות',
        });
      } else {
        toast({
          title: 'הביקורת הושלמה',
          description: `אושרו ${approvedCount} הוצאות, נדחו ${rejectedCount} הוצאות. הדוח הוחזר לעובד`,
        });
      }

      // Reload to show success state
      await loadReport();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast({
        title: 'שגיאה בשליחת הביקורת',
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
            <CardTitle>הוצאות לביקורת ({expenses.length})</CardTitle>
            <CardDescription>סמן כל הוצאה כמאושרת או נדחית והוסף הערות לפי הצורך</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {expenses.map((expense) => {
                const review = expenseReviews.get(expense.id);
                return (
                  <div key={expense.id} className={`border-2 rounded-lg p-4 transition-all ${
                    review?.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                    review?.status === 'rejected' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
                    'border-border bg-card'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
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
                    
                    <div className="flex gap-2 mb-3">
                      <Button
                        size="sm"
                        variant={review?.status === 'approved' ? 'default' : 'outline'}
                        className={review?.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                        onClick={() => handleExpenseReview(expense.id, 'approved', review?.comment || '')}
                        disabled={processing}
                      >
                        <CheckCircle className="w-4 h-4 ml-1" />
                        אשר
                      </Button>
                      <Button
                        size="sm"
                        variant={review?.status === 'rejected' ? 'default' : 'outline'}
                        className={review?.status === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
                        onClick={() => handleExpenseReview(expense.id, 'rejected', review?.comment || '')}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        דחה
                      </Button>
                    </div>

                    {review?.status === 'rejected' && (
                      <div className="space-y-2">
                        <Label htmlFor={`comment-${expense.id}`} className="text-sm mb-1">הערה (חובה):</Label>
                        <Textarea
                          id={`comment-${expense.id}`}
                          placeholder="הוסף הערה מדוע ההוצאה נדחתה..."
                          value={review.comment}
                          onChange={(e) => handleExpenseReview(expense.id, 'rejected', e.target.value, review.attachments)}
                          rows={2}
                          className="text-sm"
                          disabled={processing}
                        />
                        <ManagerAttachmentUpload
                          expenseId={expense.id}
                          onFilesChange={(files) => handleAttachmentsChange(expense.id, files)}
                          disabled={processing}
                        />
                      </div>
                    )}

                    {review?.status === 'approved' && (
                      <div className="space-y-2">
                        <Label htmlFor={`comment-${expense.id}`} className="text-sm mb-1">הערה (אופציונלי):</Label>
                        <Textarea
                          id={`comment-${expense.id}`}
                          placeholder="הוסף הערה..."
                          value={review.comment}
                          onChange={(e) => handleExpenseReview(expense.id, 'approved', e.target.value, review.attachments)}
                          rows={2}
                          className="text-sm"
                          disabled={processing}
                        />
                        <ManagerAttachmentUpload
                          expenseId={expense.id}
                          onFilesChange={(files) => handleAttachmentsChange(expense.id, files)}
                          disabled={processing}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between font-bold text-xl">
                  <span>₪{report.total_amount_ils.toFixed(2)}</span>
                  <span>:סה"כ</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 shadow-md">
          <CardHeader className="pb-4 bg-gradient-to-l from-muted/30 to-transparent border-b">
            <CardTitle>הערה כללית על הדוח (אופציונלי)</CardTitle>
            <CardDescription>הוסף הערה כללית שתישלח לעובד על הדוח כולו</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Textarea
              placeholder="הוסף הערה כללית על הדוח..."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              rows={4}
              className="text-sm"
              disabled={processing}
            />
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSubmitReview}
            disabled={processing || expenseReviews.size !== expenses.length}
            className="bg-primary hover:bg-primary/90 min-w-[200px]"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                שולח ביקורת...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 ml-2" />
                שלח ביקורת ({expenseReviews.size}/{expenses.length})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApproveReport;
