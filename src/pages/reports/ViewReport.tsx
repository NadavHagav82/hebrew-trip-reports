import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, CheckCircle, Edit, Loader2, Printer, Plane, Hotel, Utensils, Car, Package, Calendar, Mail, FileText, Download, Send, ChevronLeft, ChevronRight, CreditCard, Wallet, Receipt, Calculator } from 'lucide-react';
import { DuplicateExpenseDetector } from '@/components/DuplicateExpenseDetector';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/StatusBadge';
import { ReportHistory } from '@/components/ReportHistory';
import { AccountingComments } from '@/components/AccountingComments';
import { BudgetComparisonCard } from '@/components/BudgetComparisonCard';
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
  payment_method?: 'company_card' | 'out_of_pocket';
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
  const { user, loading: authLoading } = useAuth();
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
  
  // Receipt preview modal state
  const [previewReceipts, setPreviewReceipts] = useState<{ url: string; name: string; type: string }[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (id && user) {
      loadReport();
      loadSavedLists();
    }
  }, [id, authLoading, user, navigate]);

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      if (reportError) throw reportError;
      setReport(reportData as Report);
      
      
      // SEO
      const safeDestination = (reportData?.trip_destination || 'דוח נסיעה').toString();
      document.title = `צפייה בדוח נסיעה – ${safeDestination}`.slice(0, 60);
      const metaDesc = `צפייה בדוח נסיעה ל${safeDestination} כולל הוצאות, חשבוניות וסיכום.`.slice(0, 160);
      const metaEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (metaEl) metaEl.content = metaDesc;

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

      // IMPORTANT: don't block the whole page on signed-url generation (can timeout).
      // Render the report ASAP, then hydrate signed URLs in the background.
      const baseExpenses: Expense[] = (expensesData || []).map((e: any) => ({
        ...e,
        receipts: e.receipts || [],
        manager_attachments: e.manager_comment_attachments || [],
      }));

      setExpenses(baseExpenses);

      const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
          ),
        ]);
      };

      // Hydrate receipts/attachments signed URLs in background (best-effort)
      void (async () => {
        try {
          const enriched = await Promise.all(
            baseExpenses.map(async (expense: any) => {
              const receiptsResults = await Promise.allSettled(
                (expense.receipts || []).map(async (receipt: any) => {
                  try {
                    const { data } = await withTimeout(
                      supabase.storage
                        .from('receipts')
                        .createSignedUrl(receipt.file_url, 60 * 60),
                      6000
                    );

                    const signedUrl = (data as any)?.signedUrl as string | undefined;
                    const absoluteSignedUrl = signedUrl
                      ? signedUrl.startsWith('http')
                        ? signedUrl
                        : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signedUrl}`
                      : null;

                    return {
                      ...receipt,
                      file_url:
                        absoluteSignedUrl ||
                        `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/receipts/${receipt.file_url}`,
                    };
                  } catch {
                    // Keep original path; UI will show placeholder if it can't load.
                    return receipt;
                  }
                })
              );

              const attachmentsResults = await Promise.allSettled(
                (expense.manager_attachments || []).map(async (attachment: any) => {
                  try {
                    const { data } = await withTimeout(
                      supabase.storage
                        .from('manager-attachments')
                        .createSignedUrl(attachment.file_url, 60 * 60),
                      6000
                    );

                    const signedUrl = (data as any)?.signedUrl as string | undefined;
                    const absoluteSignedUrl = signedUrl
                      ? signedUrl.startsWith('http')
                        ? signedUrl
                        : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signedUrl}`
                      : null;

                    return {
                      ...attachment,
                      signed_url: absoluteSignedUrl,
                    };
                  } catch {
                    return { ...attachment, signed_url: null };
                  }
                })
              );

              return {
                ...expense,
                receipts: receiptsResults
                  .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
                  .map(r => r.value),
                manager_attachments: attachmentsResults
                  .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
                  .map(r => r.value),
              } as Expense;
            })
          );

          setExpenses(enriched);
        } catch {
          // silent; page already rendered
        }
      })();

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
      if (user) {
        try {
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
            .maybeSingle();

          // Get the report owner's profile to check if current user is their manager
          const { data: reportOwnerProfile } = await supabase
            .from('profiles')
            .select('manager_id')
            .eq('id', reportData.user_id)
            .maybeSingle();

          const isManager = currentUserProfile?.is_manager && 
                           reportData.user_id !== user.id &&
                           reportOwnerProfile?.manager_id === user.id;
          
          setIsManagerOfThisReport(isManager || false);
        } catch (roleError) {
          console.error('Error checking user roles:', roleError);
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
      console.log('PDF Generation: Expenses count:', expenses.length);
      
      // Convert images to base64 data URIs to avoid Buffer issues in browser
      const expensesWithBase64Images = await Promise.all(
        expenses.map(async (expense) => {
          const receiptsWithBase64 = await Promise.all(
            (expense.receipts || []).map(async (receipt: any) => {
              try {
                // Only process image receipts
                const isImage = receipt.file_type === 'image' || 
                  receipt.file_name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
                
                if (!isImage) {
                  return receipt;
                }

                // Extract the storage path from the file_url
                // The file_url can be: 
                // 1. Just a path like "user_id/filename.jpg"
                // 2. A full signed URL starting with http
                // 3. A path with storage prefix like "/storage/v1/object/..."
                let storagePath = receipt.file_url;
                
                if (storagePath.startsWith('http')) {
                  // Extract path from full URL - look for /receipts/ in the URL
                  const receiptsMatch = storagePath.match(/\/receipts\/(.+?)(?:\?|$)/);
                  if (receiptsMatch) {
                    storagePath = decodeURIComponent(receiptsMatch[1]);
                  } else {
                    console.log('PDF Generation: Could not extract path from URL:', storagePath);
                    return receipt;
                  }
                } else if (storagePath.includes('/storage/v1/')) {
                  // Extract path from storage URL
                  const receiptsMatch = storagePath.match(/\/receipts\/(.+?)(?:\?|$)/);
                  if (receiptsMatch) {
                    storagePath = decodeURIComponent(receiptsMatch[1]);
                  }
                }
                
                console.log('PDF Generation: Generating signed URL for path:', storagePath);
                
                const { data, error } = await supabase.storage
                  .from('receipts')
                  .createSignedUrl(storagePath, 60 * 60);
                
                if (error) {
                  console.error('PDF Generation: Error creating signed URL:', error);
                  return receipt;
                }
                
                const signedUrl = data?.signedUrl;
                
                if (!signedUrl) {
                  console.log('PDF Generation: No signed URL for receipt:', receipt.file_name);
                  return receipt;
                }

                console.log('PDF Generation: Fetching image from signed URL...');
                
                // Fetch the image and convert to base64 data URI
                const response = await fetch(signedUrl);
                if (!response.ok) {
                  console.error('PDF Generation: Failed to fetch image:', response.status);
                  return receipt;
                }
                
                const arrayBuffer = await response.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                  binary += String.fromCharCode(uint8Array[i]);
                }
                const base64 = btoa(binary);
                
                // Determine MIME type from file extension
                const ext = receipt.file_name?.toLowerCase().split('.').pop() || 'jpeg';
                const mimeType = ext === 'png' ? 'image/png' : 
                                 ext === 'gif' ? 'image/gif' : 
                                 ext === 'webp' ? 'image/webp' : 'image/jpeg';
                
                const dataUri = `data:${mimeType};base64,${base64}`;
                
                console.log('PDF Generation: Image converted to base64:', receipt.file_name);
                
                return {
                  ...receipt,
                  file_url: dataUri,
                };
              } catch (err) {
                console.error('PDF Generation: Error processing receipt:', receipt.file_name, err);
                return receipt;
              }
            })
          );
          
          return {
            ...expense,
            receipts: receiptsWithBase64,
          };
        })
      );
      
      console.log('PDF Generation: All images converted to base64, generating PDF...');
      
      const pdfDoc = <ReportPdf report={report} expenses={expensesWithBase64Images} profile={profile} />;
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
      const expenseReviewsForEmail = reviewsArray.map(r => ({
        expenseId: r.expenseId,
        status: r.status,
        comment: r.comment,
      }));
      
      await supabase.functions.invoke('notify-employee-review', {
        body: {
          employeeEmail: (profile as any)?.email,
          employeeName: profile?.full_name,
          reportId: report.id,
          reportDetails: {
            destination: report.trip_destination,
            startDate: report.trip_start_date,
            endDate: report.trip_end_date,
            totalAmount: report.total_amount_ils || 0,
          },
          expenseReviews: expenseReviewsForEmail,
          generalComment: managerGeneralComment || null,
          allApproved: !hasRejected,
        },
      });

      // Create in-app notification for employee
      const approvedCount = reviewsArray.filter(r => r.status === 'approved').length;
      const rejectedCount = reviewsArray.filter(r => r.status === 'rejected').length;
      
      const notificationType = hasRejected ? 'report_rejected' : 'report_approved';
      const notificationTitle = hasRejected 
        ? 'הדוח שלך דורש תיקונים' 
        : 'הדוח שלך אושר';
      const notificationMessage = hasRejected
        ? `הדוח ל${report.trip_destination} הוחזר אליך עם הערות. ${rejectedCount} הוצאות דורשות תיקון.`
        : `הדוח ל${report.trip_destination} אושר על ידי המנהל.`;

      await supabase.from('notifications').insert({
        user_id: report.user_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        report_id: report.id,
      });

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
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-blue-50/30 dark:from-slate-950 dark:via-background dark:to-blue-950/20 font-sans">
        {/* Background decorations */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/3 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg fixed top-0 inset-x-0 z-50 no-print">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-5">
            {/* Mobile Layout */}
            <div className="flex md:hidden flex-col gap-3">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/')}
                    className="hover:bg-white/20 text-white rounded-xl"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <h1 className="text-lg font-bold text-white">
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
                      className="whitespace-nowrap bg-white/10 border-white/30 text-white hover:bg-white/20 transition-all rounded-xl"
                    >
                      <Edit className="w-4 h-4 ml-1" />
                      עריכה
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleCloseReport}
                      className="whitespace-nowrap bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-md hover:shadow-lg transition-all rounded-xl"
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
                    className="whitespace-nowrap bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-md hover:shadow-lg transition-all rounded-xl"
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
                    className="whitespace-nowrap bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all rounded-xl"
                  >
                    <Edit className="w-4 h-4 ml-1" />
                    עריכה
                  </Button>
                )}
                <Button 
                  onClick={printPDF}
                  size="sm"
                  className="whitespace-nowrap bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-all rounded-xl"
                >
                  <Printer className="w-4 h-4 ml-1" />
                  ייצא PDF
                </Button>
                {report.status === 'closed' && (
                  <Button 
                    size="sm" 
                    onClick={() => setShowEmailDialog(true)}
                    className="whitespace-nowrap bg-white/10 border border-white/30 text-white hover:bg-white/20 rounded-xl"
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
                  className="hover:bg-white/20 text-white rounded-xl"
                >
                  <ArrowRight className="w-4 h-4 ml-2" />
                  חזרה
                </Button>
                <h1 className="text-xl font-bold text-white">
                  צפייה בדוח
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {report.status === 'open' && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/reports/edit/${report.id}`)}
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 transition-all rounded-xl"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      עריכה
                    </Button>
                    <Button 
                      onClick={handleCloseReport}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-md hover:shadow-lg transition-all rounded-xl"
                    >
                      <CheckCircle className="w-4 h-4 ml-2" />
                      הפק דוח
                    </Button>
                  </>
                )}
                {report.status === 'pending_approval' && isManagerOfThisReport && (
                  <Button 
                    onClick={handleApproveReport}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-md hover:shadow-lg transition-all rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    אשר דוח
                  </Button>
                )}
                {report.status === 'closed' && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/reports/edit/${report.id}`)}
                    className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-sm hover:shadow-md transition-all rounded-xl"
                  >
                    <Edit className="w-4 h-4 ml-2" />
                    עריכה
                  </Button>
                )}
                <Button 
                  onClick={printPDF}
                  className="shadow-md hover:shadow-lg transition-all rounded-xl bg-white/10 border border-white/30 text-white hover:bg-white/20"
                >
                  <Printer className="w-4 h-4 ml-2" />
                  ייצא PDF
                </Button>
                {report.status === 'closed' && (
                  <Button 
                    onClick={() => setShowEmailDialog(true)}
                    className="rounded-xl bg-white/10 border border-white/30 text-white hover:bg-white/20"
                  >
                    <Mail className="w-4 h-4 ml-2" />
                    שלח במייל
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Screen View */}
        <div id="report-pdf" className="container mx-auto px-3 sm:px-4 pt-36 pb-4 sm:pt-40 sm:pb-8 max-w-5xl no-print relative">
          {/* Hero Section */}
          <Card className="mb-6 shadow-xl border-0 overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 relative group">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-primary to-indigo-600" />
            
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-2xl" />
            
            <CardContent className="p-6 sm:p-8 relative">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">דוח נסיעה עסקית</h2>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-sm sm:text-base flex-wrap">
                    <span className="font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">{report.trip_destination}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={report.status} />
                  <div className="text-3xl sm:text-4xl font-black text-primary">
                    ₪{report.total_amount_ils?.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Trip Details */}
          <Card className="mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-card/80 backdrop-blur-sm overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <CardHeader className="pb-4 bg-gradient-to-l from-primary/5 to-transparent">
              <CardTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                פרטי הנסיעה
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-card p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:shadow-md transition-all">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide block mb-1">שם העובד</span>
                  <span className="font-bold text-lg text-foreground">{profile?.full_name || '-'}</span>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-card p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 hover:shadow-md transition-all">
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wide block mb-1">חברה</span>
                  <span className="font-bold text-lg text-foreground">{profile?.department || '-'}</span>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 hover:shadow-md transition-all">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide block mb-1">יעד</span>
                  <span className="font-bold text-lg text-foreground">{report.trip_destination}</span>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 hover:shadow-md transition-all">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide block mb-1">תאריכי נסיעה</span>
                  <span className="font-bold text-base text-foreground">
                    {format(new Date(report.trip_start_date), "dd/MM/yyyy")} - {format(new Date(report.trip_end_date), "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card p-4 rounded-xl border border-sky-100 dark:border-sky-900/50 hover:shadow-md transition-all">
                  <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wide block mb-1">מספר ימים</span>
                  <span className="font-bold text-lg text-foreground">{calculateTripDuration()}</span>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-card p-4 rounded-xl border border-rose-100 dark:border-rose-900/50 sm:col-span-2 hover:shadow-md transition-all">
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide block mb-1">מטרת הנסיעה</span>
                  <span className="font-bold text-lg text-foreground">{report.trip_purpose}</span>
                </div>
              </div>
              {report.notes && (
                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 rounded-xl border-r-4 border-amber-400">
                  <span className="text-sm text-amber-800 dark:text-amber-300 font-semibold block mb-2">הערות:</span>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{report.notes}</p>
                </div>
              )}
              {report.manager_general_comment && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 rounded-xl border-r-4 border-blue-400">
                  <span className="text-sm text-blue-800 dark:text-blue-300 font-semibold block mb-2">הערת מנהל על הדוח:</span>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{report.manager_general_comment}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Duplicate Expense Detector */}
          {expenses.length > 1 && (
            <DuplicateExpenseDetector expenses={expenses} />
          )}

          {/* Expenses List */}
          <Card className="mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-card/80 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />
            <CardHeader className="pb-4 bg-gradient-to-l from-orange-500/10 to-transparent">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-2xl">הוצאות</span>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">רשימת כל ההוצאות בנסיעה</p>
                  </div>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md">
                    {expenses.length} פריטים
                  </div>
                  {isAccountingUser && (
                    <AddExpenseByAccounting reportId={report.id} onExpenseAdded={loadReport} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expenses.map((expense, index) => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  const categoryColor = getCategoryColor(expense.category);
                  return (
                    <div key={expense.id} className="group relative bg-white dark:bg-slate-900 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                      {/* Top colored bar based on category */}
                      <div className={`h-1.5 ${
                        expense.category === 'flights' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                        expense.category === 'accommodation' ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                        expense.category === 'food' ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                        expense.category === 'transportation' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                        'bg-gradient-to-r from-slate-400 to-slate-600'
                      }`} />
                      
                      <div className="p-5">
                        {/* Header row with number, amount and category */}
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-800 dark:bg-slate-700 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">
                              {index + 1}
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 ${categoryColor} shadow-sm`}>
                              <CategoryIcon className="w-4 h-4" />
                              {getCategoryLabel(expense.category)}
                            </span>
                          </div>
                          <div className="text-2xl font-black text-slate-800 dark:text-white">
                            ₪{expense.amount_in_ils.toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Description */}
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-3 leading-relaxed">
                          {expense.description}
                        </h3>
                        
                        {/* Details row */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                            <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {expense.currency} {expense.amount.toFixed(2)}
                            </span>
                          </div>
                          {/* Payment method indicator */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${
                            expense.payment_method === 'company_card'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {expense.payment_method === 'company_card' ? (
                              <>
                                <CreditCard className="w-4 h-4" />
                                <span>כרטיס חברה</span>
                              </>
                            ) : (
                              <>
                                <Wallet className="w-4 h-4" />
                                <span>הוצאה עצמית</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Notes */}
                        {expense.notes && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl mb-4">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              <span className="font-semibold">הערות: </span>
                              {expense.notes}
                            </p>
                          </div>
                        )}
                        
                        {/* Manager approval status */}
                        {expense.approval_status && expense.approval_status !== 'pending' && (
                          <div className={`p-3 rounded-xl border-2 mb-4 ${
                            expense.approval_status === 'approved'
                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                          }`}>
                            <div className={`text-sm font-bold ${
                              expense.approval_status === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                            }`}>
                              {expense.approval_status === 'approved' ? '✓ אושר על ידי מנהל' : '✗ נדחה על ידי מנהל'}
                            </div>
                            {expense.manager_comment && (
                              <p className={`text-sm mt-2 ${
                                expense.approval_status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                <span className="font-semibold">הערה: </span>
                                {expense.manager_comment}
                              </p>
                            )}
                            {expense.manager_attachments && expense.manager_attachments.length > 0 && (
                              <div className="mt-3 space-y-1">
                                <div className={`text-xs font-semibold mb-1 ${
                                  expense.approval_status === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                }`}>
                                  קבצים מצורפים מהמנהל:
                                </div>
                                {expense.manager_attachments.map((attachment: any) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.signed_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 text-xs p-2 rounded-lg border ${
                                      expense.approval_status === 'approved'
                                        ? 'bg-green-100 border-green-300 hover:bg-green-200 text-green-800'
                                        : 'bg-red-100 border-red-300 hover:bg-red-200 text-red-800'
                                    } transition-colors`}
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate flex-1">{attachment.file_name}</span>
                                    <Download className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Receipt buttons */}
                        {expense.receipts && expense.receipts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {expense.receipts.map((receipt: any, idx: number) => (
                              <button
                                key={receipt.id || idx}
                                onClick={() => {
                                  const allReceipts = expense.receipts.map((r: any, i: number) => ({
                                    url: r.file_url,
                                    name: r.file_name || `חשבונית ${i + 1}`,
                                    type: r.file_type || 'image'
                                  }));
                                  setPreviewReceipts(allReceipts);
                                  setPreviewIndex(idx);
                                }}
                                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow transition-all cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                                {expense.receipts.length === 1 ? 'צפה בחשבונית' : `חשבונית ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Manager Review UI */}
                      {isManagerOfThisReport && report.status === 'pending_approval' && (
                        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
                          <ManagerExpenseReview
                            expenseId={expense.id}
                            currentStatus={expense.approval_status}
                            currentComment={expense.manager_comment}
                            onReview={handleManagerExpenseReview}
                            disabled={submittingReview}
                          />
                        </div>
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

          {/* Daily Allowance Section - View Only */}
          {report.daily_allowance && (
            <Card id="daily-allowance-section" className="mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-card/80 backdrop-blur-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
              <CardHeader className="pb-4 bg-gradient-to-l from-blue-500/5 to-transparent">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  אש"ל יומי
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 p-5 rounded-xl border-2 border-blue-300 dark:border-blue-700">
                  <div className="flex justify-between items-center">
                    <div className="text-right">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">סה"כ אש"ל לתקופה ({calculateTripDuration()} ימים × ${report.daily_allowance}/יום)</p>
                    </div>
                    <span className="font-black text-3xl text-blue-900 dark:text-blue-100">
                      ${(report.daily_allowance * calculateTripDuration()).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="shadow-xl border-0 overflow-hidden bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/50 dark:via-green-950/50 dark:to-teal-950/50 relative">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
            
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-500/10 to-transparent rounded-full blur-2xl" />
            
            <CardHeader className="pb-4 relative">
              <CardTitle className="text-xl font-bold flex items-center gap-3 text-foreground">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                סיכום הוצאות
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 relative">
              <div className="space-y-3">
                {Object.entries(categoryTotals).map(([category, total]) => {
                  const CategoryIcon = getCategoryIcon(category);
                  const categoryColor = getCategoryColor(category);
                  return (
                    <div key={category} className="flex justify-between items-center bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 hover:shadow-md transition-all duration-200">
                      <span className="font-semibold text-foreground flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${categoryColor} shadow-sm`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        {getCategoryLabel(category)}
                      </span>
                      <span className="font-bold text-lg text-foreground">₪{total.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-5 rounded-xl shadow-lg mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xl text-white">סה"כ כולל:</span>
                    <span className="font-black text-3xl text-white">₪{report.total_amount_ils.toFixed(2)}</span>
                  </div>
                </div>
                {Object.entries(grandTotalByCurrency).length > 0 && (
                  <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 mt-3">
                    <div className="text-sm text-muted-foreground mb-3 font-semibold">סה"כ לפי מטבעות:</div>
                    <div className="space-y-2">
                      {Object.entries(grandTotalByCurrency).map(([currency, amount]) => (
                        <div key={currency} className="flex justify-between items-center p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg">
                          <span className="text-muted-foreground font-medium">{currency}</span>
                          <span className="font-bold text-foreground">{amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Summary */}
          <Card className="shadow-xl border-t-4 border-t-purple-500 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-br from-purple-600 to-violet-700 text-white">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <div className="w-1 h-6 bg-white rounded-full"></div>
                סיכום לפי סוג תשלום
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-purple-50 to-violet-50">
              <div className="space-y-4">
                {/* Company Card Total */}
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="font-semibold text-gray-700 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 shadow-sm">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    כרטיס חברה
                  </span>
                  <span className="font-bold text-lg text-gray-900">
                    ₪{expenses
                      .filter(e => e.payment_method === 'company_card')
                      .reduce((sum, e) => sum + e.amount_in_ils, 0)
                      .toFixed(2)}
                  </span>
                </div>
                
                {/* Out of Pocket Total */}
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="font-semibold text-gray-700 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 shadow-sm">
                      <Wallet className="w-5 h-5" />
                    </div>
                    הוצאה עצמית (להחזר)
                  </span>
                  <span className="font-bold text-lg text-gray-900">
                    ₪{expenses
                      .filter(e => e.payment_method === 'out_of_pocket' || !e.payment_method)
                      .reduce((sum, e) => sum + e.amount_in_ils, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report History */}
          <ReportHistory reportId={report.id} />

          {/* Budget Comparison (if linked to approved travel) */}
          <BudgetComparisonCard reportId={report.id} />
          
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
        <DialogContent className="max-w-md p-0 overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-0 shadow-2xl">
          {/* Header with gradient accent */}
          <div className="relative">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-primary to-indigo-600" />
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">שלח דוח במייל</DialogTitle>
                  <DialogDescription className="text-sm mt-0.5">
                    הדוח יישלח כקובץ PDF מצורף למייל לכל הנמענים
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="px-6 pb-6 space-y-5">
            {/* Email inputs section */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">כתובות מייל</Label>
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
                    className="flex-1 h-11 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-base transition-all"
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
                      className="h-11 w-11 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-950/30 transition-all"
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
                className="w-full h-10 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
              >
                + הוסף נמען
              </Button>
            </div>
            
            {/* Saved lists and templates section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
              {savedLists.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">רשימות שמורות</Label>
                  <div className="space-y-2">
                    {savedLists.map((list) => (
                      <div key={list.id} className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadList(list)}
                          disabled={sendingEmail}
                          className="flex-1 justify-start h-10 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
                        >
                          {list.list_name} ({list.recipient_emails.length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteList(list.id)}
                          disabled={sendingEmail}
                          className="h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-all"
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
                className="w-full h-10 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                שמור רשימה זו
              </Button>
              
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">תבניות מהירות</Label>
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
                    className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 transition-all"
                  >
                    מנהל אחראי
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const accountingEmail = profile?.accounting_manager_email || 'accounting@company.com';
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
                    className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 transition-all"
                  >
                    הנהלת חשבונות
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEmailDialog(false);
                setRecipientEmails(['']);
              }} 
              disabled={sendingEmail}
              className="h-11 px-6 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              ביטול
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendingEmail}
              className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
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
        <DialogContent className="max-w-md p-0 overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-0 shadow-2xl">
          {/* Header with gradient accent */}
          <div className="relative">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">שמור רשימת נמענים</DialogTitle>
                  <DialogDescription className="text-sm mt-0.5">
                    שמור את רשימת הנמענים הנוכחית לשימוש חוזר
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list_name" className="text-sm font-semibold text-foreground">שם הרשימה</Label>
              <Input
                id="list_name"
                placeholder="למשל: צוות הנהלת חשבונות"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                disabled={savingList}
                className="h-11 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-base transition-all"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{recipientEmails.filter(e => e.trim()).length}</span>
              </div>
              <span className="text-sm text-emerald-700 dark:text-emerald-300">נמענים ברשימה זו</span>
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSaveListDialog(false);
                setNewListName('');
              }}
              disabled={savingList}
              className="h-11 px-6 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              ביטול
            </Button>
            <Button 
              onClick={handleSaveList} 
              disabled={savingList}
              className="h-11 px-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
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

      {/* Receipt Preview Modal */}
      <Dialog open={previewReceipts.length > 0} onOpenChange={() => { setPreviewReceipts([]); setPreviewIndex(0); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="text-right flex items-center justify-between">
              <span>{previewReceipts[previewIndex]?.name || 'תצוגת חשבונית'}</span>
              {previewReceipts.length > 1 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {previewIndex + 1} מתוך {previewReceipts.length}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-right">
              תצוגה מקדימה של הקובץ המצורף
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 min-h-[400px] relative">
            {/* Navigation arrows */}
            {previewReceipts.length > 1 && (
              <>
                <button
                  onClick={() => setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewReceipts.length - 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all hover:scale-110"
                  aria-label="חשבונית קודמת"
                >
                  <ChevronRight className="w-6 h-6 text-slate-700" />
                </button>
                <button
                  onClick={() => setPreviewIndex((prev) => (prev < previewReceipts.length - 1 ? prev + 1 : 0))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all hover:scale-110"
                  aria-label="חשבונית הבאה"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-700" />
                </button>
              </>
            )}
            {previewReceipts[previewIndex] && (
              previewReceipts[previewIndex].type === 'pdf' ? (
                <iframe
                  src={previewReceipts[previewIndex].url}
                  className="w-full h-[70vh] border rounded-lg"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={previewReceipts[previewIndex].url}
                  alt={previewReceipts[previewIndex].name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              )
            )}
          </div>
          <DialogFooter className="p-4 pt-2 border-t flex gap-2 justify-between items-center">
            {/* Dots indicator */}
            {previewReceipts.length > 1 && (
              <div className="flex gap-1.5">
                {previewReceipts.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${idx === previewIndex ? 'bg-primary scale-110' : 'bg-slate-300 hover:bg-slate-400'}`}
                    aria-label={`חשבונית ${idx + 1}`}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPreviewReceipts([]); setPreviewIndex(0); }}>
                סגור
              </Button>
              {previewReceipts[previewIndex] && (
                <a
                  href={previewReceipts[previewIndex].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button>
                    <Download className="w-4 h-4 ml-2" />
                    פתח בחלון חדש
                  </Button>
                </a>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ViewReport;
