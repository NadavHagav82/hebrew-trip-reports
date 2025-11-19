import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Download, Edit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/StatusBadge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_ils: number;
  receipts: any[];
}

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  status: 'draft' | 'open' | 'pending' | 'approved' | 'rejected' | 'closed';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

const ViewReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    try {
      // Load report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      if (reportError) throw reportError;
      setReport(reportData);

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          receipts (*)
        `)
        .eq('report_id', id)
        .order('expense_date', { ascending: true });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הדוח',
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
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

  const downloadPDF = async () => {
    if (!report) return;

    try {
      const element = document.getElementById('report-pdf');
      if (!element) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא תוכן הדוח ליצירת PDF',
          variant: 'destructive',
        });
        return;
      }

      const doc = new jsPDF('p', 'pt', 'a4');

      await doc.html(element, {
        html2canvas: {
          scale: 0.8,
        },
        callback: (docInstance) => {
          docInstance.save(
            `דוח_נסיעה_${report.trip_destination}_${format(new Date(), 'dd-MM-yyyy')}.pdf`,
          );

          toast({
            title: 'הדוח הורד בהצלחה',
            description: 'הקובץ נשמר במחשב שלך',
          });
        },
      });
    } catch (error) {
      console.error('Failed generating report PDF', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוריד את הדוח',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const categoryTotals = expenses.reduce((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = 0;
    acc[exp.category] += exp.amount_in_ils;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה
              </Button>
              <h1 className="text-xl font-bold">צפייה בדוח</h1>
            </div>
            <div className="flex items-center gap-2">
              {report.status === 'draft' && (
                <Button variant="outline" onClick={() => navigate(`/reports/edit/${id}`)}>
                  <Edit className="w-4 h-4 ml-2" />
                  ערוך דוח
                </Button>
              )}
              <Button onClick={downloadPDF}>
                <Download className="w-4 h-4 ml-2" />
                הורד PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div id="report-pdf" className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Report Status */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>סטטוס הדוח</CardTitle>
              <StatusBadge status={report.status} />
            </div>
          </CardHeader>
        </Card>

        {/* Trip Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>פרטי הנסיעה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">יעד:</span>
                <p className="font-medium">{report.trip_destination}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">מטרה:</span>
                <p className="font-medium">{report.trip_purpose}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">תאריך התחלה:</span>
                <p className="font-medium">{format(new Date(report.trip_start_date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">תאריך סיום:</span>
                <p className="font-medium">{format(new Date(report.trip_end_date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">משך הנסיעה:</span>
                <p className="font-medium">{calculateTripDuration()} ימים</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">תאריך יצירה:</span>
                <p className="font-medium">{format(new Date(report.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>הוצאות ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{expense.description}</span>
                        <span className="text-sm px-2 py-0.5 bg-primary/10 text-primary rounded">
                          {getCategoryLabel(expense.category)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">₪{expense.amount_in_ils.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.amount} {expense.currency}
                      </p>
                    </div>
                  </div>
                  {expense.receipts && expense.receipts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        {expense.receipts.length} קבלות מצורפות
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>סיכום</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryTotals).map(([category, total]) => (
                <div key={category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getCategoryLabel(category)}:</span>
                  <span className="font-medium">₪{total.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>סה"כ:</span>
                <span>₪{report.total_amount_ils.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewReport;
