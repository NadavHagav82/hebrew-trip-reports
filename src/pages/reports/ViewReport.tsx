import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Edit, Loader2, Printer, Plane, Hotel, Utensils, Car, Package, Calendar, Mail, MessageCircle, Share2, AlertCircle } from 'lucide-react';
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
  status: 'draft' | 'open' | 'closed' | 'pending_approval';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  manager_approval_requested_at?: string | null;
  manager_approval_token?: string | null;
  created_at: string;
  notes?: string;
  daily_allowance?: number;
}

interface Profile {
  full_name: string;
  employee_id: string;
  department: string;
  is_manager: boolean;
  manager_first_name?: string | null;
  manager_last_name?: string | null;
  manager_email?: string | null;
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
  const [recipientEmails, setRecipientEmails] = useState<string[]>(['']);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Saved lists state
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [showSaveListDialog, setShowSaveListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList] = useState(false);

  useEffect(() => {
    if (id) {
      loadReport();
      loadSavedLists();
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

  const printPDF = async () => {
    if (!report) return;
    
    try {
      console.log('Export PDF: Starting PDF generation...');
      const pdfData = await generatePDF();
      if (!pdfData) {
        console.error('Export PDF: PDF generation returned null');
        return;
      }

      console.log('Export PDF: PDF generated successfully, downloading...');
      const url = URL.createObjectURL(pdfData.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `דוח-נסיעה-${report.trip_destination.replace(/[^א-תa-zA-Z0-9]/g, '-')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'הקובץ הורד בהצלחה',
        description: 'ה-PDF נוצר ונשמר במכשיר שלך',
      });
    } catch (error) {
      console.error('Export PDF: Error occurred:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן ליצור את קובץ ה-PDF',
        variant: 'destructive',
      });
    }
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
    
    // Filter out empty emails and validate
    const validEmails = recipientEmails
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    if (validEmails.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין לפחות כתובת מייל אחת',
        variant: 'destructive',
      });
      return;
    }

    // Validate all emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      toast({
        title: 'שגיאה',
        description: `כתובות מייל לא תקינות: ${invalidEmails.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSendingEmail(true);
      
      console.log('Email Send: Generating PDF...');
      
      // Generate PDF first
      const pdfData = await generatePDF();
      if (!pdfData) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן ליצור את קובץ ה-PDF',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Email Send: Sending PDF to edge function...');
      
      // Send email via edge function with PDF
      const { error } = await supabase.functions.invoke('send-report-email', {
        body: {
          recipientEmails: validEmails,
          reportId: report.id,
          pdfBase64: pdfData.base64,
          reportData: {
            report,
            expenses,
            profile,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'המייל נשלח בהצלחה',
        description: `הדוח נשלח ל-${validEmails.length} נמענים`,
      });
      
      setShowEmailDialog(false);
      setRecipientEmails(['']);
    } catch (error: any) {
      console.error('Email Send: Error occurred:', error);
      toast({
        title: 'שגיאה בשליחת המייל',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCloseReport = async () => {
    if (!report || !profile) return;

    try {
      // Check if user is a manager
      if (profile.is_manager) {
        // Manager can close report directly
        await supabase
          .from('reports')
          .update({ status: 'closed', approved_at: new Date().toISOString() })
          .eq('id', report.id);
        
        toast({
          title: 'הדוח נסגר בהצלחה',
          description: 'הדוח נסגר ואושר',
        });
      } else {
        // Employee needs manager approval
        if (!profile.manager_email || !profile.manager_first_name || !profile.manager_last_name) {
          toast({
            title: 'שגיאה',
            description: 'לא נמצאו פרטי מנהל בפרופיל שלך',
            variant: 'destructive',
          });
          return;
        }

        // Request approval from manager
        const { error } = await supabase.functions.invoke('request-report-approval', {
          body: {
            reportId: report.id,
            managerEmail: profile.manager_email,
            managerName: `${profile.manager_first_name} ${profile.manager_last_name}`,
            employeeName: profile.full_name,
            reportDetails: {
              destination: report.trip_destination,
              startDate: format(new Date(report.trip_start_date), 'dd/MM/yyyy'),
              endDate: format(new Date(report.trip_end_date), 'dd/MM/yyyy'),
              purpose: report.trip_purpose,
              totalAmount: report.total_amount_ils,
            },
          },
        });

        if (error) throw error;

        toast({
          title: 'נשלחה בקשת אישור',
          description: `הדוח נשלח לאישור של ${profile.manager_first_name} ${profile.manager_last_name}`,
        });
      }

      loadReport();
    } catch (error: any) {
      console.error('Error closing report:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לסגור את הדוח',
        variant: 'destructive',
      });
    }
  };

  const loadSavedLists = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('recipient_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSavedLists(data);
        
        // Load default list if exists
        const defaultList = data.find(list => list.is_default);
        if (defaultList && showEmailDialog) {
          setRecipientEmails(defaultList.recipient_emails);
        }
      }
    } catch (error) {
      console.error('Error loading saved lists:', error);
    }
  };

  const handleSaveList = async () => {
    if (!user?.id || !newListName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין שם לרשימה',
        variant: 'destructive',
      });
      return;
    }

    const validEmails = recipientEmails.filter(e => e.trim().length > 0);
    if (validEmails.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא להוסיף לפחות כתובת מייל אחת',
        variant: 'destructive',
      });
      return;
    }

    setSavingList(true);
    try {
      const { error } = await supabase
        .from('recipient_lists')
        .insert({
          user_id: user.id,
          list_name: newListName,
          recipient_emails: validEmails,
          is_default: false,
        });

      if (error) throw error;

      toast({
        title: 'הרשימה נשמרה',
        description: `הרשימה "${newListName}" נשמרה בהצלחה`,
      });

      setNewListName('');
      setShowSaveListDialog(false);
      loadSavedLists();
    } catch (error: any) {
      console.error('Error saving list:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הרשימה',
        variant: 'destructive',
      });
    } finally {
      setSavingList(false);
    }
  };

  const handleLoadList = (list: any) => {
    setRecipientEmails(list.recipient_emails);
    toast({
      title: 'רשימה נטענה',
      description: `נטענה רשימת "${list.list_name}"`,
    });
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from('recipient_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      toast({
        title: 'הרשימה נמחקה',
        description: 'הרשימה נמחקה בהצלחה',
      });

      loadSavedLists();
    } catch (error: any) {
      console.error('Error deleting list:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן למחוק את הרשימה',
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
                      onClick={handleCloseReport}
                      className="whitespace-nowrap bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle className="w-4 h-4 ml-1" />
                      {profile?.is_manager ? 'סגור ואשר' : 'שלח לאישור'}
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
                      onClick={handleCloseReport}
                      className="bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle className="w-4 h-4 ml-2" />
                      {profile?.is_manager ? 'סגור ואשר דוח' : 'שלח לאישור מנהל'}
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
        <div id="report-pdf" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl no-print">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] rounded-lg shadow-xl mb-6 p-6 text-white text-center">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">דוח נסיעה עסקית</h1>
            <p className="text-lg opacity-90">
              {report.trip_destination} | {format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}
            </p>
          </div>

          {/* Trip Details Card */}
          <Card className="mb-6 shadow-lg border-0">
            <CardHeader className="pb-4 border-b-2 border-blue-600">
              <CardTitle className="text-xl font-bold text-blue-900">פרטי הנסיעה</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">שם העובד</span>
                  <span className="font-semibold text-gray-900">{profile?.full_name || '-'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">חברה</span>
                  <span className="font-semibold text-gray-900">{profile?.department || '-'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">יעד</span>
                  <span className="font-semibold text-gray-900">{report.trip_destination}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">תאריכי נסיעה</span>
                  <span className="font-semibold text-gray-900">
                    {format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="flex justify-between py-2 sm:col-span-2">
                  <span className="text-gray-600 font-medium">מטרת הנסיעה</span>
                  <span className="font-semibold text-gray-900">{report.trip_purpose}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">מטבע</span>
                  <span className="font-semibold text-gray-900">{grandTotalByCurrency && Object.keys(grandTotalByCurrency)[0]}</span>
                </div>
              </div>
...
            </CardContent>
          </Card>

          <Card className="mb-6 shadow-lg border-0">
            <CardHeader className="pb-4 border-b-2 border-blue-600">
              <CardTitle className="text-xl font-bold text-blue-900">סיכום הוצאות</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white">
                    <th className="px-4 py-3 text-right font-semibold text-sm">#</th>
                    <th className="px-4 py-3 text-right font-semibold text-sm">תאריך</th>
                    <th className="px-4 py-3 text-right font-semibold text-sm">תיאור</th>
                    <th className="px-4 py-3 text-right font-semibold text-sm">סכום</th>
                    <th className="px-4 py-3 text-right font-semibold text-sm">קטגוריה</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, idx) => {
                    const CategoryIcon = getCategoryIcon(expense.category);
                    return (
                      <tr key={expense.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm">{format(new Date(expense.expense_date), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3 text-sm font-medium">{expense.description}</td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {expense.amount.toFixed(2)} {expense.currency}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            <CategoryIcon className="w-3 h-3" />
                            {getCategoryLabel(expense.category)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="mb-6 shadow-lg border-0">
            <CardHeader className="pb-4 border-b-2 border-blue-600">
              <CardTitle className="text-xl font-bold text-blue-900">סיכום לפי קטגוריות</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-right font-semibold text-sm text-gray-700">קטגוריה</th>
                    <th className="px-4 py-3 text-right font-semibold text-sm text-gray-700">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categoryTotalsByCurrency).map(([category, data]) => {
                    const CategoryIcon = getCategoryIcon(category);
                    return (
                      <tr key={category} className="border-b border-gray-200">
                        <td className="px-4 py-3 text-sm flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-blue-600" />
                          {getCategoryLabel(category)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {Object.entries(data.currencies).map(([currency, amount], idx) => (
                            <span key={currency}>
                              {idx > 0 && ' + '}
                              {amount.toFixed(2)} {currency}
                            </span>
                          ))}
                          {' = '}₪{data.totalILS.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#1e3a8a] text-white font-bold">
                    <td className="px-4 py-4 text-base">סה"כ כולל</td>
                    <td className="px-4 py-4 text-base">
                      {Object.entries(grandTotalByCurrency).map(([currency, amount], idx) => (
                        <span key={currency}>
                          {idx > 0 && ' + '}
                          {amount.toFixed(2)} {currency}
                        </span>
                      ))}
                      {' = '}₪{report.total_amount_ils.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {report.notes && (
            <Card className="mb-6 shadow-lg border-0 bg-blue-50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  הערות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{report.notes}</p>
              </CardContent>
            </Card>
          )}
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
                <span style={{ color: '#6b7280', fontWeight: '500' }}>שם העובד</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{profile?.full_name || 'לא זמין'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>חברה</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{profile?.department || 'לא זמין'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>יעד</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{report?.trip_destination}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>מטרה</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>{report?.trip_purpose}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>תאריכי נסיעה</span>
                <span style={{ marginRight: '8px', fontWeight: '600' }}>
                  {report && format(new Date(report.trip_start_date), 'dd/MM/yyyy')} - {report && format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>מטבע</span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>שלח דוח במייל</DialogTitle>
            <DialogDescription>
              הדוח יישלח כקובץ HTML מצורף למייל לכל הנמענים
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>כתובות מייל</Label>
              {recipientEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="example@company.com"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...recipientEmails];
                      newEmails[index] = e.target.value;
                      setRecipientEmails(newEmails);
                    }}
                    dir="ltr"
                    className="flex-1"
                  />
                  {recipientEmails.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newEmails = recipientEmails.filter((_, i) => i !== index);
                        setRecipientEmails(newEmails);
                      }}
                      disabled={sendingEmail}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecipientEmails([...recipientEmails, ''])}
                disabled={sendingEmail}
                className="w-full"
              >
                + הוסף נמען
              </Button>
            </div>
            <div className="border-t pt-4 space-y-3">
              {savedLists.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">רשימות שמורות</Label>
                  <div className="space-y-2">
                    {savedLists.map((list) => (
                      <div key={list.id} className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadList(list)}
                          disabled={sendingEmail}
                          className="flex-1 justify-start"
                        >
                          {list.list_name} ({list.recipient_emails.length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteList(list.id)}
                          disabled={sendingEmail}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveListDialog(true)}
                disabled={sendingEmail || recipientEmails.filter(e => e.trim()).length === 0}
                className="w-full"
              >
                שמור רשימה זו
              </Button>
              
              <Label className="text-xs text-muted-foreground">תבניות מהירות</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hasEmpty = recipientEmails.some(e => e.trim() === '');
                    if (hasEmpty) {
                      const newEmails = recipientEmails.map(e => e.trim() === '' ? 'manager@company.com' : e);
                      setRecipientEmails(newEmails);
                    } else {
                      setRecipientEmails([...recipientEmails, 'manager@company.com']);
                    }
                  }}
                  disabled={sendingEmail}
                >
                  מנהל אחראי
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hasEmpty = recipientEmails.some(e => e.trim() === '');
                    if (hasEmpty) {
                      const newEmails = recipientEmails.map(e => e.trim() === '' ? 'accounting@company.com' : e);
                      setRecipientEmails(newEmails);
                    } else {
                      setRecipientEmails([...recipientEmails, 'accounting@company.com']);
                    }
                  }}
                  disabled={sendingEmail}
                >
                  הנהלת חשבונות
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEmailDialog(false);
              setRecipientEmails(['']);
            }} disabled={sendingEmail}>
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

      {/* Save List Dialog */}
      <Dialog open={showSaveListDialog} onOpenChange={setShowSaveListDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>שמור רשימת נמענים</DialogTitle>
            <DialogDescription>
              שמור את רשימת הנמענים הנוכחית לשימוש חוזר
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="list_name">שם הרשימה</Label>
              <Input
                id="list_name"
                placeholder="למשל: צוות הנהלת חשבונות"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                disabled={savingList}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              רשימה זו תכלול {recipientEmails.filter(e => e.trim()).length} נמענים
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSaveListDialog(false);
                setNewListName('');
              }}
              disabled={savingList}
            >
              ביטול
            </Button>
            <Button onClick={handleSaveList} disabled={savingList}>
              {savingList ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                'שמור'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ViewReport;
