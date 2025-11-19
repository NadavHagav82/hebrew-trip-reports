import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Download, Edit, Loader2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/StatusBadge';
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

interface Profile {
  full_name: string;
  employee_id: string;
  department: string;
}

const ViewReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

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
      setReport(reportData as Report);

      // Load expenses with receipts
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(
          `*,
           receipts (*)`
        )
        .eq('report_id', id)
        .order('expense_date', { ascending: true });

      if (expensesError) throw expensesError;

      const enhancedExpenses: Expense[] = (expensesData || []).map((expense: any) => ({
        ...expense,
        receipts: (expense.receipts || []).map((receipt: any) => ({
          ...receipt,
          file_url: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/receipts/${receipt.file_url}`,
        })),
      }));

      setExpenses(enhancedExpenses);

      // Load employee profile
      if (user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileError && profileData) {
          setProfile(profileData as Profile);
        }
      }
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

  const printPDF = () => {
    if (!report) return;
    window.print();
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
    <>
      <style>{`
        @media print {
          /* Hide non-printable elements */
          header, .no-print {
            display: none !important;
          }
          
          /* Remove backgrounds and borders */
          body {
            background: white !important;
          }
          
          /* Page setup */
          @page {
            margin: 2cm;
            size: A4;
          }
          
          /* RTL alignment */
          * {
            direction: rtl !important;
            text-align: right !important;
          }
          
          /* Ensure print container is visible */
          #report-print {
            display: block !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Card styling for print */
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 1.5rem;
            border: 1px solid #e5e7eb;
            padding: 1rem;
          }
          
          .print-card-title {
            font-size: 1.25rem;
            font-weight: bold;
            margin-bottom: 1rem;
            border-bottom: 2px solid #000;
            padding-bottom: 0.5rem;
          }
          
          /* Expense table */
          .print-expense {
            border: 1px solid #e5e7eb;
            padding: 0.75rem;
            margin-bottom: 0.75rem;
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1rem;
          }
          
          /* Category totals */
          .print-summary-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .print-summary-total {
            display: flex;
            justify-content: space-between;
            padding: 0.75rem 0;
            font-weight: bold;
            font-size: 1.125rem;
            border-top: 2px solid #000;
            margin-top: 0.5rem;
          }
          
          /* Receipt images grid */
          .print-receipts-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-top: 1rem;
          }
          
          .print-receipt-item {
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .print-receipt-item img {
            width: 5cm;
            height: 5cm;
            object-fit: cover;
            border: 1px solid #e5e7eb;
            display: block;
            margin: 0 auto 0.5rem auto;
          }
          
          .print-receipt-label {
            font-size: 0.875rem;
            font-weight: 600;
          }
        }
        
        @media screen {
          #report-print {
            display: none;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b sticky top-0 z-10 no-print">
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
              <Button onClick={printPDF}>
                <Printer className="w-4 h-4 ml-2" />
                ייצא ל-PDF
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
      
      {/* Hidden print version */}
      <div id="report-print">
        <div style={{ padding: '20px' }}>
          {/* Header */}
          <div style={{ marginBottom: '30px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
              דוח נסיעה - Travel Report
            </h1>
            {profile && (
              <div style={{ fontSize: '14px', color: '#666' }}>
                {profile.full_name} | {profile.employee_id} | {profile.department}
              </div>
            )}
          </div>
          
          {/* Report Status */}
          <div className="print-card">
            <div className="print-card-title">סטטוס הדוח</div>
            <div style={{ fontSize: '18px', fontWeight: '600' }}>
              {report?.status === 'draft' && 'טיוטה'}
              {report?.status === 'open' && 'פתוח'}
              {report?.status === 'pending' && 'ממתין לאישור'}
              {report?.status === 'approved' && 'אושר'}
              {report?.status === 'rejected' && 'נדחה'}
              {report?.status === 'closed' && 'סגור'}
            </div>
          </div>
          
          {/* Trip Details */}
          <div className="print-card">
            <div className="print-card-title">פרטי הנסיעה</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>יעד:</div>
                <div style={{ fontWeight: '500' }}>{report?.trip_destination}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>מטרה:</div>
                <div style={{ fontWeight: '500' }}>{report?.trip_purpose}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>תאריך התחלה:</div>
                <div style={{ fontWeight: '500' }}>
                  {report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>תאריך סיום:</div>
                <div style={{ fontWeight: '500' }}>
                  {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>משך הנסיעה:</div>
                <div style={{ fontWeight: '500' }}>{calculateTripDuration()} ימים</div>
              </div>
            </div>
          </div>
          
          {/* Expenses */}
          <div className="print-card">
            <div className="print-card-title">הוצאות ({expenses.length})</div>
            {expenses.map((expense) => (
              <div key={expense.id} className="print-expense">
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {expense.description}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {format(new Date(expense.expense_date), 'dd/MM/yyyy')} | {getCategoryLabel(expense.category)}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold' }}>₪{expense.amount_in_ils.toFixed(2)}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {expense.amount} {expense.currency}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Summary */}
          <div className="print-card">
            <div className="print-card-title">סיכום</div>
            {Object.entries(categoryTotals).map(([category, total]) => (
              <div key={category} className="print-summary-row">
                <span>{getCategoryLabel(category)}</span>
                <span style={{ fontWeight: '500' }}>₪{total.toFixed(2)}</span>
              </div>
            ))}
            <div className="print-summary-total">
              <span>סה"כ</span>
              <span>₪{report?.total_amount_ils.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Receipts Grid */}
          {expenses.some(exp => exp.receipts && exp.receipts.length > 0) && (
            <div className="print-card">
              <div className="print-card-title">קבלות</div>
              <div className="print-receipts-grid">
                {expenses.flatMap((expense) => 
                  (expense.receipts || []).map((receipt, idx) => (
                    <div key={receipt.id} className="print-receipt-item">
                      <img src={receipt.file_url} alt={`קבלה ${idx + 1}`} />
                      <div className="print-receipt-label">קבלה #{idx + 1}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default ViewReport;
