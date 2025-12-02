import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Edit, Loader2, Printer, Plane, Hotel, Utensils, Car, Package, Calendar, Mail, FileText, Download, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/StatusBadge';
import { ReportHistory } from '@/components/ReportHistory';
import { AccountingComments } from '@/components/AccountingComments';
import AddExpenseByAccounting from '@/components/AddExpenseByAccounting';
import { ManagerExpenseReview } from '@/components/ManagerExpenseReview';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  approval_status?: 'pending' | 'approved' | 'rejected';
  manager_comment?: string;
  reviewed_at?: string;
  manager_attachments?: {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    file_type: string;
    uploaded_at: string;
  }[];
}

interface Report {
  id: string;
  user_id: string;
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
  manager_general_comment?: string | null;
  created_at: string;
  notes?: string;
  daily_allowance?: number;
}

interface Profile {
  full_name: string;
  employee_id: string;
  department: string;
  is_manager: boolean;
  manager_id?: string | null;
  manager_email?: string | null;
  manager_name?: string | null;
  accounting_manager_email?: string | null;
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
  const [isAccountingUser, setIsAccountingUser] = useState(false);
  const [isManagerOfThisReport, setIsManagerOfThisReport] = useState(false);
  
  // Share dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>(['']);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Saved lists state
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [showSaveListDialog, setShowSaveListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList] = useState(false);
  
  // Manager review state
  const [expenseReviews, setExpenseReviews] = useState<Map<string, { expenseId: string; status: 'approved' | 'rejected'; comment: string; attachments: File[] }>>(new Map());
  const [managerGeneralComment, setManagerGeneralComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

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
           receipts (*),
           manager_comment_attachments:manager_comment_attachments(*)`
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

          // Get signed URLs for manager attachments
          const attachmentsWithSignedUrls = await Promise.all(
            (expense.manager_comment_attachments || []).map(async (attachment: any) => {
              const { data } = await supabase
                .storage
                .from('manager-attachments')
                .createSignedUrl(attachment.file_url, 60 * 60);

              return {
                ...attachment,
                signed_url: data?.signedUrl || null,
              };
            })
          );

          return {
            ...expense,
            receipts: receiptsWithSignedUrls,
            manager_attachments: attachmentsWithSignedUrls,
          };
        })
      );

      setExpenses(enhancedExpenses);

      // Load employee profile with manager details (של בעל הדוח, לא של המשתמש המחובר)
      if (reportData?.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', reportData.user_id)
          .single();

        if (!profileError && profileData) {
          let managerEmail: string | null = null;
          let managerName: string | null = null;

          if (profileData.manager_id) {
            const { data: managerProfile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', profileData.manager_id)
              .single();

            managerEmail = managerProfile?.email || null;
            managerName = managerProfile?.full_name || null;
          }

          const profile = {
            ...profileData,
            manager_email: managerEmail,
            manager_name: managerName,
          };

          setProfile(profile as Profile);
        }
      }
      
      // Check if current logged-in user is accounting manager
      if (user?.id) {
        
        // Check if user is accounting manager
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'accounting_manager');
        
        setIsAccountingUser(roles && roles.length > 0);

        // Check if current user is the manager of this report's owner
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('is_manager')
          .eq('id', user.id)
          .single();

        // Get the report owner's profile to check if current user is their manager
        const { data: reportOwnerProfile } = await supabase
          .from('profiles')
          .select('manager_id')
          .eq('id', reportData.user_id)
          .single();

        const isManager = currentUserProfile?.is_manager && 
                         reportData.user_id !== user.id &&
                         reportOwnerProfile?.manager_id === user.id;
        
        setIsManagerOfThisReport(isManager || false);
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
    if (!report || !profile || !user) return;

    try {
      console.log('handleCloseReport debug', {
        currentUserId: user.id,
        reportUserId: report.user_id,
        isOwner: user.id === report.user_id,
        profileUserId: (profile as any).id,
        profileManagerId: profile.manager_id,
        hasManager: profile.manager_id !== null && profile.manager_id !== undefined,
      });

      const isOwner = user.id === report.user_id;
      const hasManager = profile.manager_id !== null && profile.manager_id !== undefined;

      if (!isOwner || !hasManager) {
        // Not the report owner OR owner without manager – close report directly
        await supabase
          .from('reports')
          .update({ 
            status: 'closed', 
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          })
          .eq('id', report.id);
        
        await supabase.from('report_history').insert({
          report_id: report.id,
          action: 'approved',
          performed_by: user.id,
          notes: isOwner
            ? 'הדוח הופק ונסגר (לעובד ללא מנהל אחראי)'
            : 'הדוח אושר ונסגר על ידי משתמש אחר (מנהל / חשבונאות)',
        });
        
        toast({
          title: 'הדוח הופק בהצלחה',
          description: 'הדוח אושר ונסגר',
        });
      } else {
        // Owner with manager – send for approval
        if (!profile.manager_email || !profile.manager_name) {
          toast({
            title: 'שגיאה',
            description: 'לא נמצאו פרטי מנהל בפרופיל העובד',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.functions.invoke('request-report-approval', {
          body: {
            reportId: report.id,
            managerEmail: profile.manager_email,
            managerName: profile.manager_name,
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

        await supabase.from('report_history').insert({
          report_id: report.id,
          action: 'submitted',
          performed_by: user.id,
          notes: `הדוח הוגש לאישור של ${profile.manager_name}`,
        });

        toast({
          title: 'הדוח נשלח לאישור',
          description: `הדוח נשלח לאישור של ${profile.manager_name}`,
        });
      }

      loadReport();
    } catch (error: any) {
      console.error('Error closing report:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן להפיק את הדוח',
        variant: 'destructive',
      });
    }
  };
  const handleApproveReport = async () => {
    if (!report || !user) return;

    // If no individual reviews, approve all expenses at once
    if (expenseReviews.size === 0) {
      try {
        await supabase
          .from('reports')
          .update({ 
            status: 'closed', 
            approved_at: new Date().toISOString(),
            approved_by: user.id 
          })
          .eq('id', report.id);
        
        // Mark all expenses as approved
        await supabase
          .from('expenses')
          .update({ 
            approval_status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('report_id', report.id);
        
        await supabase.from('report_history').insert({
          report_id: report.id,
          action: 'approved',
          performed_by: user.id,
          notes: 'הדוח אושר על ידי מנהל',
        });
        
        toast({
          title: 'הדוח אושר בהצלחה',
          description: 'הדוח אושר ונסגר',
        });

        loadReport();
      } catch (error: any) {
        console.error('Error approving report:', error);
        toast({
          title: 'שגיאה',
          description: error.message || 'לא ניתן לאשר את הדוח',
          variant: 'destructive',
        });
      }
      return;
    }

    // Submit with individual expense reviews
    await handleSubmitManagerReview();
  };

  const handleManagerExpenseReview = (expenseId: string, status: 'approved' | 'rejected', comment: string, attachments: File[]) => {
    setExpenseReviews(prev => {
      const newMap = new Map(prev);
      newMap.set(expenseId, { expenseId, status, comment, attachments });
      return newMap;
    });
  };

  const handleSubmitManagerReview = async () => {
    if (!report || !user) return;

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

    setSubmittingReview(true);
    try {
      const reviewsArray = Array.from(expenseReviews.values());
      
      // Upload attachments first
      for (const review of reviewsArray) {
        if (review.attachments && review.attachments.length > 0) {
          for (const file of review.attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${review.expenseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('manager-attachments')
              .upload(fileName, file);

            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              throw new Error(`שגיאה בהעלאת הקובץ ${file.name}`);
            }

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

      // Update each expense
      for (const review of reviewsArray) {
        await supabase
          .from('expenses')
          .update({
            approval_status: review.status,
            manager_comment: review.comment || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', review.expenseId);
      }

      // Determine overall report status
      const hasRejected = reviewsArray.some(r => r.status === 'rejected');
      const newStatus = hasRejected ? 'open' : 'closed';
      
      await supabase
        .from('reports')
        .update({
          status: newStatus,
          manager_approval_token: null,
          manager_general_comment: managerGeneralComment || null,
          rejection_reason: hasRejected ? 'חלק מההוצאות נדחו או דורשות בירור' : null,
          approved_at: hasRejected ? null : new Date().toISOString(),
          approved_by: hasRejected ? null : user.id,
        })
        .eq('id', report.id);

      // Add history entry
      await supabase.from('report_history').insert({
        report_id: report.id,
        action: hasRejected ? 'rejected' : 'approved',
        performed_by: user.id,
        notes: hasRejected 
          ? `חלק מההוצאות נדחו או דורשות בירור. הדוח הוחזר לעובד.`
          : 'הדוח אושר על ידי מנהל',
      });

      // Send notification to employee
      await supabase.functions.invoke('notify-employee-review', {
        body: {
          reportId: report.id,
          hasRejected,
        },
      });

      const approvedCount = reviewsArray.filter(r => r.status === 'approved').length;
      const rejectedCount = reviewsArray.filter(r => r.status === 'rejected').length;

      if (!hasRejected) {
        toast({
          title: 'הדוח אושר בהצלחה',
          description: 'כל ההוצאות אושרו',
        });
      } else {
        toast({
          title: 'הביקורת הושלמה',
          description: `אושרו ${approvedCount} הוצאות, נדחו/לבירור ${rejectedCount} הוצאות. הדוח הוחזר לעובד`,
        });
      }

      // Reset review state
      setExpenseReviews(new Map());
      setManagerGeneralComment('');
      loadReport();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast({
        title: 'שגיאה בשליחת הביקורת',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReview(false);
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
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 font-sans">
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
                      הפק דוח
                    </Button>
                  </>
                )}
                {report.status === 'pending_approval' && isManagerOfThisReport && (
                  <Button 
                    size="sm"
                    onClick={handleApproveReport}
                    className="whitespace-nowrap bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <CheckCircle className="w-4 h-4 ml-1" />
                    אשר דוח
                  </Button>
                )}
                {report.status === 'closed' && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/reports/edit/${report.id}`)}
                    className="whitespace-nowrap bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Edit className="w-4 h-4 ml-1" />
                    עריכה
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowEmailDialog(true)}
                    className="whitespace-nowrap"
                  >
                    <Mail className="w-4 h-4 ml-1" />
                    שלח במייל
                  </Button>
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
                      הפק דוח
                    </Button>
                  </>
                )}
                {report.status === 'pending_approval' && isManagerOfThisReport && (
                  <Button 
                    onClick={handleApproveReport}
                    className="bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    אשר דוח
                  </Button>
                )}
                {report.status === 'closed' && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/reports/edit/${report.id}`)}
                    className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Edit className="w-4 h-4 ml-2" />
                    עריכה
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
                  <Button onClick={() => setShowEmailDialog(true)}>
                    <Mail className="w-4 h-4 ml-2" />
                    שלח במייל
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Screen View */}
        <div id="report-pdf" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl no-print">
          {/* Hero Section */}
          <Card className="mb-6 shadow-xl border-none overflow-hidden bg-gradient-to-bl from-slate-600 via-slate-700 to-slate-800">
            <CardContent className="p-6 sm:p-8 text-white">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-2">דוח נסיעה עסקית</h2>
                  <p className="text-slate-200 text-sm sm:text-base flex items-center gap-2">
                    <span className="font-medium">{report.trip_destination}</span>
                    <span>•</span>
                    <span>{format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}</span>
                  </p>
                </div>
                <StatusBadge status={report.status} />
              </div>
            </CardContent>
          </Card>

          {/* Trip Details */}
          <Card className="mb-6 shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-t-slate-500">
            <CardHeader className="pb-4 bg-gradient-to-l from-slate-50 to-transparent">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <div className="w-1 h-6 bg-slate-600 rounded-full"></div>
                פרטי הנסיעה
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-lg border border-indigo-100">
                  <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wide block mb-1">שם העובד</span>
                  <span className="font-bold text-lg text-gray-900">{profile?.full_name || '-'}</span>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border border-purple-100">
                  <span className="text-xs text-purple-600 font-semibold uppercase tracking-wide block mb-1">חברה</span>
                  <span className="font-bold text-lg text-gray-900">{profile?.department || '-'}</span>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-lg border border-emerald-100">
                  <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide block mb-1">יעד</span>
                  <span className="font-bold text-lg text-gray-900">{report.trip_destination}</span>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-lg border border-amber-100">
                  <span className="text-xs text-amber-600 font-semibold uppercase tracking-wide block mb-1">תאריכי נסיעה</span>
                  <span className="font-bold text-base text-gray-900">
                    {format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-lg border border-sky-100">
                  <span className="text-xs text-sky-600 font-semibold uppercase tracking-wide block mb-1">מספר ימים</span>
                  <span className="font-bold text-lg text-gray-900">{calculateTripDuration()}</span>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-lg border border-rose-100 sm:col-span-2">
                  <span className="text-xs text-rose-600 font-semibold uppercase tracking-wide block mb-1">מטרת הנסיעה</span>
                  <span className="font-bold text-lg text-gray-900">{report.trip_purpose}</span>
                </div>
              </div>
              {report.notes && (
                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border-r-4 border-amber-400">
                  <span className="text-sm text-amber-800 font-semibold block mb-2">הערות:</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
                </div>
              )}
              {report.manager_general_comment && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-r-4 border-blue-400">
                  <span className="text-sm text-blue-800 font-semibold block mb-2">הערת מנהל על הדוח:</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.manager_general_comment}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card className="mb-6 shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-t-purple-500">
            <CardHeader className="pb-4 bg-gradient-to-l from-purple-50 to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-purple-900 flex items-center gap-2">
                  <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                  הוצאות
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
                    {expenses.length} פריטים
                  </div>
                  {isAccountingUser && (
                    <AddExpenseByAccounting reportId={report.id} onExpenseAdded={loadReport} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expenses.map((expense, index) => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  const categoryColor = getCategoryColor(expense.category);
                  return (
                    <div key={expense.id} className="group relative border-2 border-gray-100 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 hover:from-slate-50 hover:to-indigo-50 hover:border-slate-200 transition-all duration-300 hover:shadow-md">
                      <div className="absolute top-3 left-3 bg-gray-100 text-gray-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold group-hover:bg-slate-600 group-hover:text-white transition-all">
                        {index + 1}
                      </div>
                      <div className="flex items-start justify-between gap-4 mr-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span className="font-bold text-lg text-gray-900">{expense.description}</span>
                            <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 ${categoryColor} shadow-sm`}>
                              <CategoryIcon className="w-4 h-4" />
                              {getCategoryLabel(expense.category)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-2 font-medium">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                          </p>
                          {expense.notes && (
                            <p className="text-sm text-gray-600 mt-3 italic bg-slate-50 p-3 rounded-lg border-r-2 border-slate-400">
                              {expense.notes}
                            </p>
                          )}
                          {expense.approval_status && expense.approval_status !== 'pending' && (
                            <div className={`mt-3 p-3 rounded-lg border-2 ${
                              expense.approval_status === 'approved'
                                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                            }`}>
                              <div className="flex items-start gap-2">
                                <div className={`text-sm font-bold ${
                                  expense.approval_status === 'approved' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                                }`}>
                                  {expense.approval_status === 'approved' ? '✓ אושר על ידי מנהל' : '✗ נדחה על ידי מנהל'}
                                </div>
                              </div>
                              {expense.manager_comment && (
                                <div className={`text-xs mt-2 ${
                                  expense.approval_status === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                }`}>
                                  <span className="font-semibold">הערה: </span>
                                  {expense.manager_comment}
                                </div>
                              )}
                              {expense.manager_attachments && expense.manager_attachments.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  <div className={`text-xs font-semibold mb-1 ${
                                    expense.approval_status === 'approved' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                                  }`}>
                                    קבצים מצורפים מהמנהל:
                                  </div>
                                  {expense.manager_attachments.map((attachment: any) => (
                                    <a
                                      key={attachment.id}
                                      href={attachment.signed_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 text-xs p-2 rounded border ${
                                        expense.approval_status === 'approved'
                                          ? 'bg-green-100 border-green-300 hover:bg-green-200 text-green-800'
                                          : 'bg-red-100 border-red-300 hover:bg-red-200 text-red-800'
                                      } transition-colors`}
                                    >
                                      {attachment.file_type.startsWith('image/') ? (
                                        <FileText className="w-3 h-3" />
                                      ) : (
                                        <FileText className="w-3 h-3" />
                                      )}
                                      <span className="truncate flex-1">{attachment.file_name}</span>
                                      <Download className="w-3 h-3" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-2xl font-black text-slate-700 bg-slate-100 px-4 py-2 rounded-lg">
                            ₪{expense.amount_in_ils.toFixed(2)}
                          </div>
                          <div className="text-sm bg-gray-100 px-3 py-1 rounded-full font-semibold text-gray-700">
                            <span>{expense.currency}</span>
                            <span className="mx-1.5">•</span>
                            <span>{expense.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Manager Review UI */}
                      {isManagerOfThisReport && report.status === 'pending_approval' && (
                        <ManagerExpenseReview
                          expenseId={expense.id}
                          currentStatus={expense.approval_status}
                          currentComment={expense.manager_comment}
                          onReview={handleManagerExpenseReview}
                          disabled={submittingReview}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Manager Review Submit Section */}
              {isManagerOfThisReport && report.status === 'pending_approval' && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                  <h3 className="font-bold text-lg text-blue-900 mb-4">סיכום ביקורת מנהל</h3>
                  
                  <div className="mb-4">
                    <Label htmlFor="manager-general-comment" className="text-sm font-semibold text-blue-800 mb-2 block">
                      הערה כללית על הדוח (אופציונלי):
                    </Label>
                    <Textarea
                      id="manager-general-comment"
                      placeholder="הוסף הערה כללית על הדוח..."
                      value={managerGeneralComment}
                      onChange={(e) => setManagerGeneralComment(e.target.value)}
                      rows={3}
                      disabled={submittingReview}
                      className="bg-white"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="text-sm text-blue-700">
                      {expenseReviews.size === 0 ? (
                        <span>לחץ "אשר דוח" כדי לאשר את כל ההוצאות, או סמן כל הוצאה בנפרד</span>
                      ) : (
                        <span>
                          נסקרו {expenseReviews.size} מתוך {expenses.length} הוצאות
                          {Array.from(expenseReviews.values()).some(r => r.status === 'rejected') && 
                            ' • ישנן הוצאות שנדחו - הדוח יחזור לעובד'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {expenseReviews.size > 0 && expenseReviews.size < expenses.length && (
                        <span className="text-sm text-amber-600 font-semibold">
                          יש להשלים סקירת {expenses.length - expenseReviews.size} הוצאות נוספות
                        </span>
                      )}
                      <Button
                        onClick={handleSubmitManagerReview}
                        disabled={submittingReview || (expenseReviews.size > 0 && expenseReviews.size < expenses.length)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {submittingReview ? (
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 ml-2" />
                        )}
                        {expenseReviews.size === 0 ? 'אשר את כל ההוצאות' : 'שלח ביקורת'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Allowance Section */}
          <Card className="mb-6 shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-t-blue-500">
            <CardHeader className="pb-4 bg-gradient-to-l from-blue-50 to-transparent">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                אש"ל יומי
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!report.daily_allowance}
                      onChange={async (e) => {
                        const newValue = e.target.checked ? 100 : null;
                        try {
                          await supabase
                            .from('reports')
                            .update({ daily_allowance: newValue })
                            .eq('id', report.id);
                          loadReport();
                          toast({
                            title: e.target.checked ? 'אש"ל יומי הופעל' : 'אש"ל יומי בוטל',
                          });
                        } catch (error) {
                          toast({ title: 'שגיאה', variant: 'destructive' });
                        }
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-bold text-blue-900">הוסף אש"ל יומי לדוח</span>
                  </div>
                  {report.daily_allowance && (
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        value={report.daily_allowance}
                        onChange={async (e) => {
                          const newValue = parseFloat(e.target.value) || 0;
                          try {
                            await supabase
                              .from('reports')
                              .update({ daily_allowance: newValue })
                              .eq('id', report.id);
                            loadReport();
                          } catch (error) {
                            toast({ title: 'שגיאה', variant: 'destructive' });
                          }
                        }}
                        className="w-28 px-3 py-2 border-2 border-blue-300 rounded-lg font-bold text-blue-900 text-center"
                      />
                      <span className="text-blue-700 font-semibold">$ ליום</span>
                    </div>
                  )}
                </div>
                {report.daily_allowance && (
                  <div className="bg-gradient-to-r from-blue-100 to-cyan-100 p-5 rounded-lg border-2 border-blue-300">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xl text-blue-900">
                        סה"כ אש"ל לתקופה ({calculateTripDuration()} ימים)
                      </span>
                      <span className="font-black text-3xl text-blue-900">
                        ${(report.daily_allowance * calculateTripDuration()).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="shadow-xl border-t-4 border-t-green-500 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-br from-green-600 to-emerald-700 text-white">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <div className="w-1 h-6 bg-white rounded-full"></div>
                סיכום הוצאות
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="space-y-4">
                {Object.entries(categoryTotals).map(([category, total]) => {
                  const CategoryIcon = getCategoryIcon(category);
                  const categoryColor = getCategoryColor(category);
                  return (
                    <div key={category} className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <span className="font-semibold text-gray-700 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${categoryColor} shadow-sm`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        {getCategoryLabel(category)}
                      </span>
                      <span className="font-bold text-lg text-gray-900">₪{total.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 p-6 rounded-xl shadow-lg mt-6">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-2xl text-white">סה"כ כולל:</span>
                    <span className="font-black text-3xl text-white">₪{report.total_amount_ils.toFixed(2)}</span>
                  </div>
                </div>
                {Object.entries(grandTotalByCurrency).length > 0 && (
                  <div className="bg-white p-5 rounded-xl border-2 border-slate-200 mt-4">
                    <div className="text-base text-slate-800 mb-3 font-bold">סה"כ לפי מטבעות:</div>
                    <div className="space-y-2">
                      {Object.entries(grandTotalByCurrency).map(([currency, amount]) => (
                        <div key={currency} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                          <span className="text-gray-700 font-semibold">{currency}</span>
                          <span className="font-bold text-slate-800">{amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Report History */}
          <ReportHistory reportId={report.id} />
          
          {/* Accounting Comments */}
          {(report.status === 'closed' || report.status === 'pending_approval' || isAccountingUser) && (
            <AccountingComments reportId={report.id} isAccountingUser={isAccountingUser} />
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
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>סטטוס</th>
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
                    <td style={{ padding: '12px', fontSize: '12px' }}>
                      {expense.approval_status && expense.approval_status !== 'pending' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ 
                            background: expense.approval_status === 'approved' ? '#dcfce7' : '#fee2e2',
                            color: expense.approval_status === 'approved' ? '#166534' : '#991b1b',
                            padding: '3px 8px', 
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {expense.approval_status === 'approved' ? '✓ אושר' : '✗ נדחה'}
                          </span>
                          {expense.manager_comment && (
                            <span style={{ fontSize: '10px', color: '#6b7280' }}>
                              {expense.manager_comment}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '11px' }}>ממתין</span>
                      )}
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
              הדוח יישלח כקובץ PDF מצורף למייל לכל הנמענים
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
                    if (!profile?.manager_email) {
                      toast({
                        title: 'שגיאה',
                        description: 'לא הוגדר מנהל אחראי למשתמש זה',
                        variant: 'destructive',
                      });
                      return;
                    }
                    const managerEmail = profile.manager_email;
                    // Find first empty field, or add new one
                    const firstEmptyIndex = recipientEmails.findIndex(e => e.trim() === '');
                    if (firstEmptyIndex !== -1) {
                      const newEmails = [...recipientEmails];
                      newEmails[firstEmptyIndex] = managerEmail;
                      setRecipientEmails(newEmails);
                    } else {
                      setRecipientEmails([...recipientEmails, managerEmail]);
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
                    const accountingEmail = profile?.accounting_manager_email || 'accounting@company.com';
                    // Find first empty field, or add new one
                    const firstEmptyIndex = recipientEmails.findIndex(e => e.trim() === '');
                    if (firstEmptyIndex !== -1) {
                      const newEmails = [...recipientEmails];
                      newEmails[firstEmptyIndex] = accountingEmail;
                      setRecipientEmails(newEmails);
                    } else {
                      setRecipientEmails([...recipientEmails, accountingEmail]);
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
