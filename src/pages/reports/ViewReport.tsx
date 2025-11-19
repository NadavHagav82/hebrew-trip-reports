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
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap');
        
        @media print {
          body, * {
            font-family: 'Heebo', sans-serif !important;
          }
          
          header, .no-print {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          #report-print {
            display: block !important;
          }
        }
        
        @media screen {
          #report-print {
            display: none;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-background font-sans">
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
              <Button onClick={printPDF}>
                <Printer className="w-4 h-4 ml-2" />
                הדפס דוח
              </Button>
            </div>
          </div>
        </header>

        {/* Screen View */}
        <div id="report-pdf" className="container mx-auto px-4 py-8 max-w-4xl no-print">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>סטטוס הדוח</CardTitle>
                <StatusBadge status={report.status} />
              </div>
            </CardHeader>
          </Card>

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
              </div>
            </CardContent>
          </Card>

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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
        
        {/* Print Version */}
        <div id="report-print" style={{ fontFamily: 'Heebo, sans-serif', direction: 'rtl', padding: '20px', background: 'white' }}>
          <div style={{ border: '3px solid #1e3a8a', padding: '30px', borderRadius: '8px' }}>
            {/* כותרת */}
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              color: '#1e3a8a', 
              marginBottom: '30px',
              borderBottom: '2px solid #1e3a8a',
              paddingBottom: '15px'
            }}>
              דוח הוצאות נסיעה עסקית
            </h1>

            {/* קופסה 1 - פרטי הנסיעה */}
            <div style={{ 
              background: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              borderRadius: '6px', 
              padding: '20px', 
              marginBottom: '20px' 
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: '#1e3a8a', 
                marginBottom: '15px' 
              }}>
                פרטי הנסיעה
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong>יעד:</strong> {report?.trip_destination}
                </div>
                <div>
                  <strong>מטרה:</strong> {report?.trip_purpose}
                </div>
                <div>
                  <strong>תאריך התחלה:</strong> {report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')}
                </div>
                <div>
                  <strong>תאריך סיום:</strong> {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
                </div>
                <div>
                  <strong>משך:</strong> {calculateTripDuration()} ימים
                </div>
              </div>
            </div>

            {/* קופסה 2 - טבלת הוצאות */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: '#1e3a8a', 
                marginBottom: '15px' 
              }}>
                טבלת הוצאות
              </h2>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                border: '1px solid #d1d5db',
                background: '#f9fafb'
              }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: 'white' }}>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>תאריך</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>קטגוריה</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>תיאור</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>סכום</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>מטבע</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>בשקלים</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, idx) => (
                    <tr key={expense.id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                        {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                        {getCategoryLabel(expense.category)}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                        {expense.description}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                        {expense.amount.toFixed(2)}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                        {expense.currency}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>
                        ₪{expense.amount_in_ils.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* קופסה 3 - סיכום לפי קטגוריות */}
            <div style={{ 
              background: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              borderRadius: '6px', 
              padding: '20px', 
              marginBottom: '20px' 
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: '#1e3a8a', 
                marginBottom: '15px' 
              }}>
                סיכום לפי קטגוריות
              </h2>
              {Object.entries(categoryTotals).map(([category, total]) => (
                <div key={category} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px 0',
                  fontSize: '16px'
                }}>
                  <span>{getCategoryLabel(category)}:</span>
                  <span style={{ fontWeight: 'bold' }}>₪{total.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ 
                borderTop: '2px solid #1e3a8a', 
                marginTop: '10px', 
                paddingTop: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                <span>סה"כ:</span>
                <span>₪{report?.total_amount_ils.toFixed(2)}</span>
              </div>
            </div>

            {/* קופסה 4 - קבלות מצורפות */}
            {expenses.some(exp => exp.receipts && exp.receipts.length > 0) && (
              <div>
                <h2 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#1e3a8a', 
                  marginBottom: '15px' 
                }}>
                  קבלות מצורפות
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '20px' 
                }}>
                  {expenses.flatMap((expense, expIdx) => 
                    (expense.receipts || []).map((receipt, idx) => (
                      <div key={receipt.id} style={{ textAlign: 'center' }}>
                        <img 
                          src={receipt.file_url} 
                          alt={`קבלה ${expIdx + idx + 1}`}
                          style={{ 
                            width: '150px', 
                            height: '150px', 
                            objectFit: 'cover', 
                            border: '2px solid #d1d5db',
                            borderRadius: '4px',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          קבלה #{expIdx + idx + 1}
                        </div>
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
