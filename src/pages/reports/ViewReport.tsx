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
  notes?: string;
}

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  status: 'draft' | 'open' | 'closed';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  notes?: string;
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

      const enhancedExpenses: Expense[] = await Promise.all(
        (expensesData || []).map(async (expense: any) => {
          const receiptsWithSignedUrls = await Promise.all(
            (expense.receipts || []).map(async (receipt: any) => {
              const { data } = await supabase
                .storage
                .from('receipts')
                .createSignedUrl(receipt.file_url, 60 * 60); // שעה תוקף

              return {
                ...receipt,
                file_url:
                  data?.signedUrl ||
                  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/receipts/${receipt.file_url}`,
              };
            })
          );

          return {
            ...expense,
            receipts: receiptsWithSignedUrls,
          };
        })
      );

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

  // Calculate category totals by original currency
  const categoryTotalsByCurrency = expenses.reduce((acc, exp) => {
    if (!acc[exp.category]) {
      acc[exp.category] = { currencies: {}, totalILS: 0 };
    }
    if (!acc[exp.category].currencies[exp.currency]) {
      acc[exp.category].currencies[exp.currency] = 0;
    }
    acc[exp.category].currencies[exp.currency] += exp.amount;
    acc[exp.category].totalILS += exp.amount_in_ils;
    return acc;
  }, {} as Record<string, { currencies: Record<string, number>, totalILS: number }>);

  // Calculate grand total by currency
  const grandTotalByCurrency = expenses.reduce((acc, exp) => {
    if (!acc[exp.currency]) acc[exp.currency] = 0;
    acc[exp.currency] += exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');
        
        @media print {
          body, * {
            font-family: 'Heebo', sans-serif !important;
          }
          
          header, .no-print {
            display: none !important;
          }
          
          body {
            background: #f5f5f5 !important;
          }
          
          @page {
            margin: 1cm;
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
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {/* Mobile Layout */}
            <div className="flex md:hidden flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <h1 className="text-lg font-bold">צפייה בדוח</h1>
                </div>
                <StatusBadge status={report.status} />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {report.status === 'open' && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/reports/edit/${report.id}`)}
                      className="whitespace-nowrap"
                    >
                      <Edit className="w-4 h-4 ml-1" />
                      עריכה
                    </Button>
                    <Button 
                      size="sm"
                      onClick={async () => {
                        try {
                          await supabase
                            .from('reports')
                            .update({ status: 'closed' })
                            .eq('id', report.id);
                          toast({ title: 'הדוח נסגר בהצלחה' });
                          loadReport();
                        } catch (error) {
                          toast({ title: 'שגיאה', variant: 'destructive' });
                        }
                      }}
                      className="whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 ml-1" />
                      סגור
                    </Button>
                  </>
                )}
                {report.status === 'closed' && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await supabase
                          .from('reports')
                          .update({ status: 'open' })
                          .eq('id', report.id);
                        toast({ title: 'הדוח נפתח מחדש בהצלחה' });
                        loadReport();
                      } catch (error) {
                        toast({ title: 'שגיאה', variant: 'destructive' });
                      }
                    }}
                    className="whitespace-nowrap"
                  >
                    <Edit className="w-4 h-4 ml-1" />
                    פתח דוח מחדש
                  </Button>
                )}
                <Button 
                  onClick={printPDF}
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  <Printer className="w-4 h-4 ml-1" />
                  ייצא PDF
                </Button>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                  <ArrowRight className="w-4 h-4 ml-2" />
                  חזרה
                </Button>
                <h1 className="text-xl font-bold">צפייה בדוח</h1>
              </div>
              <div className="flex items-center gap-2">
                {report.status === 'open' && (
                  <>
                    <Button variant="outline" onClick={() => navigate(`/reports/edit/${report.id}`)}>
                      <Edit className="w-4 h-4 ml-2" />
                      עריכה
                    </Button>
                    <Button onClick={async () => {
                      try {
                        await supabase
                          .from('reports')
                          .update({ status: 'closed' })
                          .eq('id', report.id);
                        toast({ title: 'הדוח נסגר בהצלחה' });
                        loadReport();
                      } catch (error) {
                        toast({ title: 'שגיאה', variant: 'destructive' });
                      }
                    }}>
                      <Download className="w-4 h-4 ml-2" />
                      סגור דוח
                    </Button>
                  </>
                )}
                {report.status === 'closed' && (
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      try {
                        await supabase
                          .from('reports')
                          .update({ status: 'open' })
                          .eq('id', report.id);
                        toast({ title: 'הדוח נפתח מחדש בהצלחה' });
                        loadReport();
                      } catch (error) {
                        toast({ title: 'שגיאה', variant: 'destructive' });
                      }
                    }}
                  >
                    <Edit className="w-4 h-4 ml-2" />
                    פתח דוח מחדש
                  </Button>
                )}
                <Button onClick={printPDF}>
                  <Printer className="w-4 h-4 ml-2" />
                  ייצא PDF
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Screen View */}
        <div id="report-pdf" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl no-print">
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base sm:text-lg">סטטוס הדוח</CardTitle>
                <StatusBadge status={report.status} />
              </div>
            </CardHeader>
          </Card>

          <Card className="mb-4 sm:mb-6">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">פרטי הנסיעה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <span className="text-xs sm:text-sm text-muted-foreground">יעד:</span>
                  <p className="font-medium text-sm sm:text-base">{report.trip_destination}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-muted-foreground">מטרה:</span>
                  <p className="font-medium text-sm sm:text-base">{report.trip_purpose}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-muted-foreground">תאריך התחלה:</span>
                  <p className="font-medium text-sm sm:text-base">{format(new Date(report.trip_start_date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-muted-foreground">תאריך סיום:</span>
                  <p className="font-medium text-sm sm:text-base">{format(new Date(report.trip_end_date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-muted-foreground">משך הנסיעה:</span>
                  <p className="font-medium text-sm sm:text-base">{calculateTripDuration()} ימים</p>
                </div>
              </div>
              {report.notes && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <span className="text-xs sm:text-sm text-muted-foreground">הערות:</span>
                  <p className="font-medium text-sm sm:text-base whitespace-pre-wrap">{report.notes}</p>
                </div>
              )}
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
                        {expense.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            הערה: {expense.notes}
                          </p>
                        )}
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
        <div id="report-print" style={{ 
          fontFamily: 'Heebo, sans-serif', 
          direction: 'rtl', 
          padding: '30px', 
          background: '#f5f5f5',
          minHeight: '100vh'
        }}>
          {/* כותרת ראשית */}
          <div style={{ 
            background: 'white', 
            padding: '30px', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              color: '#1e3a8a', 
              marginBottom: '10px'
            }}>
              דוח נסיעה עסקית
            </h1>
            <div style={{ 
              fontSize: '18px', 
              color: '#4b5563',
              fontWeight: '500'
            }}>
              {report?.trip_destination} | {report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')} - {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
            </div>
          </div>

          {/* פרטי נסיעה */}
          <div style={{ 
            background: 'white', 
            padding: '25px', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1e3a8a', 
              marginBottom: '20px',
              borderBottom: '2px solid #1e3a8a',
              paddingBottom: '10px'
            }}>
              פרטי נסיעה
            </h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '15px',
              fontSize: '15px'
            }}>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>שם העובד:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{profile?.full_name || 'לא זמין'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>חברה:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{profile?.department || 'לא זמין'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>יעד:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{report?.trip_destination}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>מטרה:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{report?.trip_purpose}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>תאריכי נסיעה:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>
                  {report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')} - {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>מטבע:</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>ILS (₪)</span>
              </div>
            </div>
          </div>

          {/* טבלת הוצאות */}
          <div style={{ 
            background: 'white', 
            padding: '25px', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1e3a8a', 
              marginBottom: '20px',
              borderBottom: '2px solid #1e3a8a',
              paddingBottom: '10px'
            }}>
              טבלת הוצאות
            </h2>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ background: '#1e3a8a', color: 'white' }}>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>#</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>תאריך</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>ספק</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>סכום</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>מטבע</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>בשקלים</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense, idx) => (
                  <tr key={expense.id} style={{ 
                    background: idx % 2 === 0 ? '#f9fafb' : 'white',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{idx + 1}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{expense.description}</td>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                      {expense.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {expense.currency}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                      ₪{expense.amount_in_ils.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <span style={{ 
                        background: '#dbeafe', 
                        color: '#1e40af', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getCategoryLabel(expense.category)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* סיכום קטגוריות */}
          <div style={{ 
            background: 'white', 
            padding: '25px', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1e3a8a', 
              marginBottom: '20px',
              borderBottom: '2px solid #1e3a8a',
              paddingBottom: '10px'
            }}>
              סיכום לפי קטגוריות
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    קטגוריה
                  </th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    סכום
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(categoryTotalsByCurrency).map(([category, data]) => (
                  <tr key={category} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px', fontSize: '15px' }}>{getCategoryLabel(category)}</td>
                    <td style={{ padding: '10px', fontSize: '15px', fontWeight: '600' }}>
                      {Object.entries(data.currencies).map(([currency, amount], idx) => (
                        <span key={currency}>
                          {idx > 0 && ' + '}
                          {amount.toFixed(2)} {currency}
                        </span>
                      ))}
                      {' = '}₪{data.totalILS.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ 
                  background: '#1e3a8a', 
                  color: 'white', 
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  <td style={{ padding: '12px' }}>סה"כ כולל</td>
                  <td style={{ padding: '12px' }}>
                    {Object.entries(grandTotalByCurrency).map(([currency, amount], idx) => (
                      <span key={currency}>
                        {idx > 0 && ' + '}
                        {amount.toFixed(2)} {currency}
                      </span>
                    ))}
                    {' = '}₪{report?.total_amount_ils.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* קבלות */}
          {expenses.some(exp => exp.receipts && exp.receipts.length > 0) && (
            <div style={{ 
              background: 'white', 
              padding: '25px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: '#1e3a8a', 
                marginBottom: '20px',
                borderBottom: '2px solid #1e3a8a',
                paddingBottom: '10px'
              }}>
                קבלות
              </h2>
              {expenses.map((expense) => 
                expense.receipts && expense.receipts.length > 0 ? (
                  expense.receipts.map((receipt, idx) => {
                    const receiptNumber = expenses
                      .slice(0, expenses.indexOf(expense))
                      .reduce((sum, e) => sum + (e.receipts?.length || 0), 0) + idx + 1;
                    
                    return (
                      <div key={receipt.id} style={{ 
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '25px',
                        marginBottom: '25px',
                        background: '#fafafa',
                        pageBreakInside: 'avoid'
                      }}>
                        <h3 style={{ 
                          fontSize: '18px', 
                          fontWeight: 'bold', 
                          color: '#1e3a8a',
                          marginBottom: '20px',
                          borderBottom: '1px solid #d1d5db',
                          paddingBottom: '10px'
                        }}>
                          חשבונית #{receiptNumber} - {expense.description} - {getCategoryLabel(expense.category)}
                        </h3>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr',
                          gap: '20px'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '15px',
                            background: 'white',
                            borderRadius: '6px',
                            fontSize: '15px'
                          }}>
                            <div style={{ display: 'flex', gap: '30px' }}>
                              <div>
                                <span style={{ color: '#6b7280', fontWeight: '500' }}>תאריך: </span>
                                <span style={{ fontWeight: '600' }}>
                                  {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#6b7280', fontWeight: '500' }}>סכום: </span>
                                <span style={{ fontWeight: '600' }}>
                                  {expense.amount.toFixed(2)} {expense.currency} = ₪{expense.amount_in_ils.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#6b7280', fontWeight: '500' }}>קטגוריה: </span>
                                <span style={{ fontWeight: '600' }}>
                                  {getCategoryLabel(expense.category)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '15px',
                            background: 'white',
                            borderRadius: '6px'
                          }}>
                            <img 
                              src={receipt.file_url} 
                              alt={`קבלה ${receiptNumber}`}
                              style={{ 
                                width: '100%',
                                maxWidth: '600px',
                                height: 'auto',
                                border: '2px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}
                              onError={(e) => {
                                console.error('Failed to load receipt image:', receipt.file_url);
                                e.currentTarget.style.display = 'none';
                                const errorDiv = document.createElement('div');
                                errorDiv.style.cssText = 'padding: 40px; text-align: center; color: #ef4444; border: 2px dashed #ef4444; border-radius: 6px;';
                                errorDiv.textContent = 'שגיאה בטעינת התמונה';
                                e.currentTarget.parentElement?.appendChild(errorDiv);
                              }}
                            />
                          </div>
                          <div style={{ 
                            padding: '15px',
                            background: 'white',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}>
                            <span style={{ color: '#6b7280', fontWeight: '500' }}>פירוט: </span>
                            <span style={{ fontWeight: '600' }}>
                              {expense.description}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : null
              )}
            </div>
          )}

          {/* הערות */}
          <div style={{ 
            background: '#e0f2fe', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #7dd3fc',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: '#075985',
              marginBottom: '15px'
            }}>
              הערות
            </h3>
            <ul style={{ 
              listStyle: 'disc', 
              paddingRight: '20px',
              margin: 0,
              fontSize: '14px',
              color: '#0c4a6e'
            }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>מטרה:</strong> {report?.trip_purpose}
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>תקופה:</strong> {calculateTripDuration()} ימים ({report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')} - {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')})
              </li>
              <li>
                <strong>מסמכים מצורפים:</strong> {expenses.reduce((total, exp) => total + (exp.receipts?.length || 0), 0)} קבלות
              </li>
            </ul>
          </div>

          {/* תחתית */}
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            borderTop: '2px solid #e5e7eb',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            מוגש על ידי: <strong>{profile?.full_name || 'לא זמין'}</strong> | חברה: <strong>{profile?.department || 'לא זמין'}</strong>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViewReport;
