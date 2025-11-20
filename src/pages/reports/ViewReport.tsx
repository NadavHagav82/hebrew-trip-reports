import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Edit, Loader2, Printer, Plane, Hotel, Utensils, Car, Package, Calendar, Mail, MessageCircle, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/StatusBadge';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pdf } from '@react-pdf/renderer';
import { ReportPdf } from '@/pdf/ReportPdf';

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
  daily_allowance?: number;
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
  
  // Share dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      flights: Plane,
      accommodation: Hotel,
      food: Utensils,
      transportation: Car,
      miscellaneous: Package,
    };
    return icons[category] || Package;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      flights: 'bg-category-flights text-category-flights-fg',
      accommodation: 'bg-category-accommodation text-category-accommodation-fg',
      food: 'bg-category-food text-category-food-fg',
      transportation: 'bg-category-transportation text-category-transportation-fg',
      miscellaneous: 'bg-category-miscellaneous text-category-miscellaneous-fg',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  const printPDF = () => {
    if (!report) return;
    window.print();
  };

  const categoryLabels = {
    flights: 'טיסות',
    accommodation: 'לינה / חדרי ישיבות',
    food: 'אוכל ואירוח',
    transportation: 'תחבורה מקומית',
    miscellaneous: 'שונות',
  };

  const generatePDF = async (): Promise<{ blob: Blob; base64: string } | null> => {
    if (!report) {
      console.error('PDF Generation: No report found');
      return null;
    }

    try {
      console.log('PDF Generation: Starting with @react-pdf/renderer...');
      
      const pdfDoc = <ReportPdf report={report} expenses={expenses} profile={profile} />;
      const blob = await pdf(pdfDoc).toBlob();
      
      console.log('PDF Generation: Blob created, size:', blob.size);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('PDF Generation: Success!');
      return { blob, base64 };
    } catch (error) {
      console.error('PDF Generation: Error occurred:', error);
      toast({
        title: 'שגיאה ביצירת PDF',
        description: error instanceof Error ? error.message : 'שגיאה לא ידועה',
        variant: 'destructive',
      });
      return null;
    }
  };

  const shareViaWhatsApp = async () => {
    if (!report) return;
    
    try {
      console.log('WhatsApp Share: Starting PDF generation...');
      const pdfData = await generatePDF();
      if (!pdfData) {
        console.error('WhatsApp Share: PDF generation returned null');
        return;
      }

      console.log('WhatsApp Share: PDF generated successfully, creating download link...');
      const url = URL.createObjectURL(pdfData.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `דוח-נסיעה-${report.trip_destination.replace(/[^א-תa-zA-Z0-9]/g, '-')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      console.log('WhatsApp Share: File downloaded');
      toast({
        title: 'הקובץ הורד',
        description: 'כעת ניתן לשתף אותו ב-WhatsApp',
      });
    } catch (error) {
      console.error('WhatsApp Share: Error occurred:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן ליצור את הקובץ',
        variant: 'destructive',
      });
    }
  };

  const handleSendEmail = async () => {
    if (!report) return;
    
    if (!recipientEmail) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין כתובת מייל',
        variant: 'destructive',
      });
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast({
        title: 'שגיאה',
        description: 'כתובת מייל לא תקינה',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSendingEmail(true);
      
      console.log('Email Send: Starting PDF generation...');
      const pdfData = await generatePDF();
      if (!pdfData) {
        console.error('Email Send: PDF generation returned null');
        throw new Error('Failed to generate PDF');
      }
      
      console.log('Email Send: PDF generated, size:', pdfData.blob.size, 'bytes');
      
      // Send email via edge function
      const { error } = await supabase.functions.invoke('send-report-email', {
        body: {
          recipientEmail,
          reportId: report.id,
          pdfBase64: pdfData.base64,
          reportDetails: {
            destination: report.trip_destination,
            startDate: report.trip_start_date,
            endDate: report.trip_end_date,
            purpose: report.trip_purpose,
            totalAmount: report.total_amount_ils || 0,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'המייל נשלח בהצלחה',
        description: `הדוח נשלח ל-${recipientEmail}`,
      });
      
      setShowEmailDialog(false);
      setRecipientEmail('');
    } catch (error: any) {
      toast({
        title: 'שגיאה בשליחת המייל',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
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
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
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
      
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 font-sans">
        {/* Header */}
        <header className="bg-card/95 backdrop-blur-sm border-b shadow-sm sticky top-0 z-10 no-print">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {/* Mobile Layout */}
            <div className="flex md:hidden flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/')}
                    className="hover:bg-accent"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <h1 className="text-lg font-bold bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text text-transparent">
                    צפייה בדוח
                  </h1>
                </div>
                <StatusBadge status={report.status} />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {report.status === 'open' && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/reports/edit/${report.id}`)}
                      className="whitespace-nowrap shadow-sm hover:shadow-md transition-shadow"
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
                          loadReport();
                        } catch (error) {
                          toast({ title: 'שגיאה', variant: 'destructive' });
                        }
                      }}
                      className="whitespace-nowrap bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle className="w-4 h-4 ml-1" />
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
                        loadReport();
                      } catch (error) {
                        toast({ title: 'שגיאה', variant: 'destructive' });
                      }
                    }}
                    className="whitespace-nowrap bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Edit className="w-4 h-4 ml-1" />
                    פתח דוח מחדש
                  </Button>
                )}
                <Button 
                  onClick={printPDF}
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap shadow-sm hover:shadow-md transition-shadow"
                >
                  <Printer className="w-4 h-4 ml-1" />
                  ייצא PDF
                </Button>
                {report.status === 'closed' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="whitespace-nowrap">
                        <Share2 className="w-4 h-4 ml-1" />
                        שתף
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setShowEmailDialog(true)} className="cursor-pointer">
                        <Mail className="w-4 h-4 ml-2" />
                        <span>שלח במייל</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={shareViaWhatsApp} className="cursor-pointer">
                        <MessageCircle className="w-4 h-4 ml-2" />
                        <span>שתף ב-WhatsApp</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/')}
                  className="hover:bg-accent"
                >
                  <ArrowRight className="w-4 h-4 ml-2" />
                  חזרה
                </Button>
                <h1 className="text-xl font-bold bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text text-transparent">
                  צפייה בדוח
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {report.status === 'open' && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/reports/edit/${report.id}`)}
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      עריכה
                    </Button>
                    <Button 
                      onClick={async () => {
                        try {
                          await supabase
                            .from('reports')
                            .update({ status: 'closed' })
                            .eq('id', report.id);
                          loadReport();
                        } catch (error) {
                          toast({ title: 'שגיאה', variant: 'destructive' });
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle className="w-4 h-4 ml-2" />
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
                        loadReport();
                      } catch (error) {
                        toast({ title: 'שגיאה', variant: 'destructive' });
                      }
                    }}
                    className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Edit className="w-4 h-4 ml-2" />
                    פתח דוח מחדש
                  </Button>
                )}
                <Button 
                  onClick={printPDF}
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  <Printer className="w-4 h-4 ml-2" />
                  ייצא PDF
                </Button>
                {report.status === 'closed' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <Share2 className="w-4 h-4 ml-2" />
                        שתף
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setShowEmailDialog(true)} className="cursor-pointer">
                        <Mail className="w-4 h-4 ml-2" />
                        <span>שלח במייל</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={shareViaWhatsApp} className="cursor-pointer">
                        <MessageCircle className="w-4 h-4 ml-2" />
                        <span>שתף ב-WhatsApp</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Screen View */}
        <div id="report-pdf" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl no-print">
          <Card className="mb-4 sm:mb-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary">
            <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-l from-muted/30 to-transparent">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base sm:text-lg font-bold">סטטוס הדוח</CardTitle>
                <StatusBadge status={report.status} />
              </div>
            </CardHeader>
          </Card>

          <Card className="mb-4 sm:mb-6 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-l from-muted/30 to-transparent border-b">
              <CardTitle className="text-base sm:text-lg font-bold">פרטי הנסיעה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-1">יעד:</span>
                  <p className="font-semibold text-sm sm:text-base">{report.trip_destination}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-1">מטרה:</span>
                  <p className="font-semibold text-sm sm:text-base">{report.trip_purpose}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-1">תאריך התחלה:</span>
                  <p className="font-semibold text-sm sm:text-base">{format(new Date(report.trip_start_date), 'dd/MM/yyyy')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-1">תאריך סיום:</span>
                  <p className="font-semibold text-sm sm:text-base">{format(new Date(report.trip_end_date), 'dd/MM/yyyy')}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-1">משך הנסיעה:</span>
                  <p className="font-bold text-sm sm:text-base text-primary">{calculateTripDuration()} ימים</p>
                </div>
                {report.daily_allowance && (
                  <div className="p-3 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors border border-accent/30">
                    <span className="text-xs sm:text-sm text-muted-foreground block mb-1">אש״ל ליום:</span>
                    <p className="font-bold text-sm sm:text-base">${report.daily_allowance}</p>
                    <span className="text-xs text-muted-foreground">סה״כ: ${report.daily_allowance * calculateTripDuration()}</span>
                  </div>
                )}
              </div>
              {report.notes && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <span className="text-xs sm:text-sm text-muted-foreground block mb-2">הערות:</span>
                  <p className="font-medium text-sm sm:text-base whitespace-pre-wrap p-3 bg-muted/30 rounded-lg">{report.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>הוצאות ({expenses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expenses.map((expense) => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  const categoryColor = getCategoryColor(expense.category);
                  return (
                    <div key={expense.id} className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-semibold text-base">{expense.description}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${categoryColor}`}>
                              <CategoryIcon className="w-3 h-3" />
                              {getCategoryLabel(expense.category)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                          </p>
                          {expense.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic border-r-2 border-muted pr-2">
                              {expense.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="text-xl font-bold text-foreground">
                            ₪{expense.amount_in_ils.toFixed(2)}
                          </div>
                          <div className="text-sm bg-muted/50 px-2 py-0.5 rounded">
                            <span className="font-medium">{expense.currency}</span>
                            <span className="mx-1">•</span>
                            <span>{expense.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>סיכום</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(categoryTotals).map(([category, total]) => {
                  const CategoryIcon = getCategoryIcon(category);
                  const categoryColor = getCategoryColor(category);
                  return (
                    <div key={category} className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className={`p-1 rounded ${categoryColor}`}>
                          <CategoryIcon className="w-3.5 h-3.5" />
                        </div>
                        {getCategoryLabel(category)}:
                      </span>
                      <span className="font-medium">₪{total.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-lg mb-2">
                    <span>סה"כ:</span>
                    <span>₪{report.total_amount_ils.toFixed(2)}</span>
                  </div>
                  {Object.entries(grandTotalByCurrency).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm text-muted-foreground mb-2 font-semibold">סה"כ לפי מטבעות:</div>
                      <div className="space-y-1">
                        {Object.entries(grandTotalByCurrency).map(([currency, amount]) => (
                          <div key={currency} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{currency}:</span>
                            <span className="font-medium">{amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שלח דוח במייל</DialogTitle>
            <DialogDescription>
              הדוח יישלח כקובץ PDF מצורף למייל
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">כתובת מייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={sendingEmail}>
              ביטול
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 ml-2" />
                  שלח
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ViewReport;
