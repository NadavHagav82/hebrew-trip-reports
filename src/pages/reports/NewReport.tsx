import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { convertPdfToImages } from '@/utils/pdfToImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Calendar, Camera, Globe, Image as ImageIcon, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ReceiptFile {
  file: File;
  preview: string;
  uploading?: boolean;
  analyzing?: boolean;
  analyzed?: boolean;
}

interface Expense {
  id: string;
  expense_date: string;
  category: 'flights' | 'accommodation' | 'food' | 'transportation' | 'miscellaneous';
  description: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'ILS' | 'PLN' | 'GBP';
  amount_in_ils: number;
  receipts: ReceiptFile[];
}

const categoryLabels = {
  flights: '🛫 טיסות',
  accommodation: '🏨 לינה / חדרי ישיבות',
  food: '🍽️ אוכל ואירוח',
  transportation: '🚗 תחבורה מקומית',
  miscellaneous: '📌 שונות',
};

const currencyLabels = {
  USD: '$ דולר',
  EUR: '€ יורו',
  ILS: '₪ שקל',
  PLN: 'zł זלוטי',
  GBP: '£ לירה',
};

const currencyRates = {
  USD: 3.60,
  EUR: 3.90,
  ILS: 1.00,
  PLN: 0.89,
  GBP: 4.58,
};

export default function NewReport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  // Trip details
  const [tripDestination, setTripDestination] = useState('');
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [currentExpenseForUpload, setCurrentExpenseForUpload] = useState<string | null>(null);

  // Load existing report if in edit mode
  useEffect(() => {
    if (id && user) {
      setIsEditMode(true);
      setReportId(id);
      loadReport(id);
    }
  }, [id, user]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      
      // Load report details
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) throw reportError;

      // Set trip details
      setTripDestination(report.trip_destination);
      setTripStartDate(report.trip_start_date);
      setTripEndDate(report.trip_end_date);
      setTripPurpose(report.trip_purpose);

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('report_id', reportId);

      if (expensesError) throw expensesError;

      // Transform expenses to local format
      const transformedExpenses: Expense[] = expensesData.map(exp => ({
        id: exp.id,
        expense_date: exp.expense_date,
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        currency: exp.currency,
        amount_in_ils: exp.amount_in_ils,
        receipts: [], // Receipts will be loaded separately if needed
      }));

      setExpenses(transformedExpenses);

      toast({
        title: 'דוח נטען בהצלחה',
        description: 'ניתן להמשיך לערוך את הדוח',
      });
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לטעון את הדוח',
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = () => {
    const newExpense: Expense = {
      id: Date.now().toString(),
      expense_date: '',
      category: 'miscellaneous',
      description: '',
      amount: 0,
      currency: 'USD',
      amount_in_ils: 0,
      receipts: [],
    };
    setExpenses([...expenses, newExpense]);
    setExpandedExpense(newExpense.id);
  };

  const updateExpense = (id: string, field: keyof Expense, value: any) => {
    setExpenses(expenses.map(exp => {
      if (exp.id === id) {
        const updated = { ...exp, [field]: value };
        // Auto-convert to ILS
        if (field === 'amount' || field === 'currency') {
          const amount = field === 'amount' ? value : exp.amount;
          const currency = field === 'currency' ? value : exp.currency;
          updated.amount_in_ils = amount * currencyRates[currency as keyof typeof currencyRates];
        }
        return updated;
      }
      return exp;
    }));
  };

  const removeExpense = (id: string) => {
    const expense = expenses.find(exp => exp.id === id);
    if (expense) {
      // Cleanup preview URLs
      expense.receipts.forEach(receipt => {
        URL.revokeObjectURL(receipt.preview);
      });
    }
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  const handleFileSelect = async (expenseId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    let allFiles: File[] = [];

    // Process each file
    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        toast({
          title: 'הקובץ גדול מדי',
          description: 'מקסימום 10MB לכל קובץ',
          variant: 'destructive',
        });
        continue;
      }

      // Check if it's a PDF and convert to images
      if (file.type === 'application/pdf') {
        try {
          toast({
            title: 'ממיר PDF לתמונות...',
            description: 'אנא המתן',
          });
          const images = await convertPdfToImages(file);
          allFiles.push(...images);
          toast({
            title: 'PDF הומר בהצלחה',
            description: `נוצרו ${images.length} תמונות`,
          });
        } catch (error) {
          toast({
            title: 'שגיאה בהמרת PDF',
            description: error instanceof Error ? error.message : 'נסה שוב',
            variant: 'destructive',
          });
        }
      } else {
        // Check if it's a valid image type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
        if (validTypes.includes(file.type)) {
          allFiles.push(file);
        } else {
          toast({
            title: 'פורמט קובץ לא נתמך',
            description: 'נא להעלות תמונות או PDF בלבד',
            variant: 'destructive',
          });
        }
      }
    }

    if (allFiles.length === 0) return;

    const newReceipts: ReceiptFile[] = allFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
    }));

    setExpenses(expenses.map(exp => {
      if (exp.id === expenseId) {
        const totalReceipts = exp.receipts.length + newReceipts.length;
        if (totalReceipts > 10) {
          toast({
            title: 'יותר מדי קבצים',
            description: 'מקסימום 10 קבלות לכל הוצאה',
            variant: 'destructive',
          });
          return exp;
        }
        return { ...exp, receipts: [...exp.receipts, ...newReceipts] };
      }
      return exp;
    }));
  };

  const removeReceipt = (expenseId: string, receiptIndex: number) => {
    setExpenses(expenses.map(exp => {
      if (exp.id === expenseId) {
        const receipt = exp.receipts[receiptIndex];
        URL.revokeObjectURL(receipt.preview);
        return {
          ...exp,
          receipts: exp.receipts.filter((_, idx) => idx !== receiptIndex)
        };
      }
      return exp;
    }));
  };

  const openFileDialog = (expenseId: string) => {
    setCurrentExpenseForUpload(expenseId);
    fileInputRef.current?.click();
  };

  const openCameraDialog = (expenseId: string) => {
    setCurrentExpenseForUpload(expenseId);
    cameraInputRef.current?.click();
  };

  const analyzeReceipt = async (expenseId: string, receiptIndex: number) => {
    const expense = expenses.find(exp => exp.id === expenseId);
    if (!expense) return;

    const receipt = expense.receipts[receiptIndex];
    if (!receipt || receipt.analyzed) return;

    // Check if file is an image
    if (!receipt.file.type.startsWith('image/')) {
      toast({
        title: 'לא ניתן לנתח',
        description: 'ניתן לנתח רק תמונות של קבלות',
        variant: 'destructive',
      });
      return;
    }

    // Mark as analyzing
    setExpenses(expenses.map(exp => {
      if (exp.id === expenseId) {
        return {
          ...exp,
          receipts: exp.receipts.map((r, idx) =>
            idx === receiptIndex ? { ...r, analyzing: true } : r
          )
        };
      }
      return exp;
    }));

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert file'));
          }
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(receipt.file);
      const imageBase64 = await base64Promise;

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { imageBase64 }
      });

      if (error) throw error;

      if (data?.data) {
        const { date, amount, currency, category, description } = data.data;
        
        // Update expense with analyzed data
        setExpenses(expenses.map(exp => {
          if (exp.id === expenseId) {
            const updated = { ...exp };
            if (date) updated.expense_date = date;
            if (amount) updated.amount = parseFloat(amount);
            if (currency) updated.currency = currency;
            if (category) updated.category = category;
            if (description) updated.description = description;
            
            // Calculate ILS amount
            if (amount && currency) {
              updated.amount_in_ils = parseFloat(amount) * currencyRates[currency as keyof typeof currencyRates];
            }

            // Mark receipt as analyzed
            updated.receipts = exp.receipts.map((r, idx) =>
              idx === receiptIndex ? { ...r, analyzing: false, analyzed: true } : r
            );

            return updated;
          }
          return exp;
        }));

        toast({
          title: 'הקבלה נותחה בהצלחה! ✨',
          description: 'הפרטים מולאו אוטומטית',
        });
      }
    } catch (error: any) {
      console.error('Error analyzing receipt:', error);
      
      // Remove analyzing state
      setExpenses(expenses.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            receipts: exp.receipts.map((r, idx) =>
              idx === receiptIndex ? { ...r, analyzing: false } : r
            )
          };
        }
        return exp;
      }));

      toast({
        title: 'שגיאה בניתוח הקבלה',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    }
  };

  const calculateTotalByCategory = () => {
    const totals: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!totals[exp.category]) totals[exp.category] = 0;
      totals[exp.category] += exp.amount_in_ils;
    });
    return totals;
  };

  const calculateGrandTotal = () => {
    return expenses.reduce((sum, exp) => sum + exp.amount_in_ils, 0);
  };

  const handleSave = async (submitForApproval: boolean = false) => {
    if (!user) return;

    // Validation
    if (!tripDestination || !tripStartDate || !tripEndDate || !tripPurpose) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל פרטי הנסיעה',
        variant: 'destructive',
      });
      return;
    }

    if (submitForApproval && expenses.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'יש להוסיף לפחות הוצאה אחת',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let report;
      
      if (isEditMode && reportId) {
        // Update existing report
        const { data: updatedReport, error: reportError } = await supabase
          .from('reports')
          .update({
            trip_destination: tripDestination,
            trip_start_date: tripStartDate,
            trip_end_date: tripEndDate,
            trip_purpose: tripPurpose,
            status: submitForApproval ? 'open' : 'draft',
            submitted_at: submitForApproval ? new Date().toISOString() : null,
            total_amount_ils: calculateGrandTotal(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId)
          .select()
          .single();

        if (reportError) throw reportError;
        report = updatedReport;

        // Delete existing expenses for this report
        await supabase
          .from('expenses')
          .delete()
          .eq('report_id', reportId);
      } else {
        // Create new report
        const { data: newReport, error: reportError } = await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            trip_destination: tripDestination,
            trip_start_date: tripStartDate,
            trip_end_date: tripEndDate,
            trip_purpose: tripPurpose,
            status: submitForApproval ? 'open' : 'draft',
            submitted_at: submitForApproval ? new Date().toISOString() : null,
            total_amount_ils: calculateGrandTotal(),
          })
          .select()
          .single();

        if (reportError) throw reportError;
        report = newReport;
      }

      // Create/Update expenses
      if (expenses.length > 0) {
        for (const exp of expenses) {
          // Insert expense
          const { data: expenseData, error: expenseError } = await supabase
            .from('expenses')
            .insert({
              report_id: report.id,
              expense_date: exp.expense_date,
              category: exp.category,
              description: exp.description,
              amount: exp.amount,
              currency: exp.currency,
              amount_in_ils: exp.amount_in_ils,
            })
            .select()
            .single();

          if (expenseError) throw expenseError;

          // Upload receipts
          if (exp.receipts.length > 0) {
            for (const receipt of exp.receipts) {
              const fileExt = receipt.file.name.split('.').pop();
              const fileName = `${user.id}/${expenseData.id}/${Date.now()}.${fileExt}`;

              const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(fileName, receipt.file);

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(fileName);

              // Save receipt record
              await supabase.from('receipts').insert({
                expense_id: expenseData.id,
                file_name: receipt.file.name,
                file_url: fileName,
                file_type: receipt.file.type.startsWith('image') ? 'image' : 'pdf',
                file_size: receipt.file.size,
              });
            }
          }
        }
      }

      // Create history record
      await supabase.from('report_history').insert({
        report_id: report.id,
        action: isEditMode ? 'edited' : (submitForApproval ? 'submitted' : 'created'),
        performed_by: user.id,
      });

      toast({
        title: isEditMode ? 'הדוח עודכן בהצלחה' : (submitForApproval ? 'הדוח הוגש בהצלחה' : 'הדוח נשמר כטיוטה'),
        description: submitForApproval ? 'הדוח נשלח לאישור' : 'ניתן להמשיך לערוך מאוחר יותר',
      });

      navigate(`/reports/${report.id}`);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת הדוח',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTripDuration = () => {
    if (!tripStartDate || !tripEndDate) return 0;
    const start = new Date(tripStartDate);
    const end = new Date(tripEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    return diffDays;
  };

  const categoryTotals = calculateTotalByCategory();
  const grandTotal = calculateGrandTotal();

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
              <h1 className="text-xl font-bold">{isEditMode ? 'עריכת דוח נסיעה' : 'דוח נסיעה חדש'}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={loading}>
                <Save className="w-4 h-4 ml-2" />
                שמור כטיוטה
              </Button>
              <Button onClick={() => handleSave(true)} disabled={loading}>
                <Save className="w-4 h-4 ml-2" />
                שמור והגש לאישור
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Trip Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              פרטי הנסיעה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="destination">יעד הנסיעה *</Label>
              <Input
                id="destination"
                placeholder="לדוגמה: ניו יורק, ארה״ב"
                value={tripDestination}
                onChange={(e) => setTripDestination(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">תאריך התחלה *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">תאריך סיום *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  min={tripStartDate}
                />
              </div>
              <div>
                <Label>משך הנסיעה</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                  <span className="font-semibold">
                    {calculateTripDuration()} ימים
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="purpose">מטרת הנסיעה *</Label>
              <Textarea
                id="purpose"
                placeholder="תאר את מטרת הנסיעה העסקית"
                rows={3}
                value={tripPurpose}
                onChange={(e) => setTripPurpose(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                💰 הוצאות
              </CardTitle>
              <Button onClick={addExpense}>
                <Plus className="w-4 h-4 ml-2" />
                הוסף הוצאה
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">עדיין לא הוספת הוצאות</p>
                <p className="text-sm text-muted-foreground">לחץ על "הוסף הוצאה" כדי להתחיל</p>
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense, index) => (
                  <Card key={expense.id} className="border-2">
                    <div
                      className="p-4 cursor-pointer flex items-center justify-between hover:bg-muted/50"
                      onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">הוצאה #{index + 1}</span>
                        {expense.description && (
                          <>
                            <span className="text-muted-foreground">-</span>
                            <span>{expense.description}</span>
                          </>
                        )}
                        {expense.amount > 0 && (
                          <>
                            <span className="text-muted-foreground">-</span>
                            <span className="font-semibold">
                              {expense.amount.toFixed(2)} {currencyLabels[expense.currency]}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeExpense(expense.id);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedExpense === expense.id && (
                      <div className="p-4 border-t space-y-4">
                        {/* Receipt Upload - First */}
                        <div>
                          <Label className="text-base font-semibold">צלם או העלה קבלה</Label>
                          <div className="space-y-3 mt-2">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => openCameraDialog(expense.id)}
                              >
                                <Camera className="w-4 h-4 ml-2" />
                                צלם קבלה
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => openFileDialog(expense.id)}
                              >
                                <Upload className="w-4 h-4 ml-2" />
                                העלה מהמכשיר
                              </Button>
                            </div>

                            {expense.receipts.length > 0 && (
                              <div className="grid grid-cols-3 gap-2">
                                {expense.receipts.map((receipt, idx) => (
                                  <div key={idx} className="relative group">
                                    <div className="aspect-square rounded-lg border-2 overflow-hidden bg-muted">
                                      {receipt.file.type.startsWith('image') ? (
                                        <img
                                          src={receipt.preview}
                                          alt={`קבלה ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center flex-col">
                                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                          <span className="text-xs mt-2">PDF</span>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute -top-2 -left-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeReceipt(expense.id, idx)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                    {!receipt.analyzed && !receipt.analyzing && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="absolute bottom-1 left-1 right-1 text-xs h-7"
                                        onClick={() => analyzeReceipt(expense.id, idx)}
                                      >
                                        ✨ אישור וניתוח
                                      </Button>
                                    )}
                                    {receipt.analyzing && (
                                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                        <span className="text-xs">מנתח...</span>
                                      </div>
                                    )}
                                    {receipt.analyzed && (
                                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Expense Details - After Receipt Upload */}
                        <div>
                          <Label>תאריך *</Label>
                          <Input
                            type="date"
                            value={expense.expense_date}
                            onChange={(e) => updateExpense(expense.id, 'expense_date', e.target.value)}
                            min={tripStartDate}
                            max={tripEndDate}
                          />
                        </div>

                        <div>
                          <Label>קטגוריה *</Label>
                          <Select
                            value={expense.category}
                            onValueChange={(value) => updateExpense(expense.id, 'category', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>תיאור *</Label>
                          <Input
                            placeholder="תאר את ההוצאה"
                            value={expense.description}
                            onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>סכום *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={expense.amount || ''}
                              onChange={(e) => updateExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <Label>מטבע *</Label>
                            <Select
                              value={expense.currency}
                              onValueChange={(value) => updateExpense(expense.id, 'currency', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(currencyLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">סכום בשקלים</p>
                          <p className="text-lg font-bold">
                            {expense.amount_in_ils.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {expenses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>סיכום הוצאות</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold mb-3">סיכום לפי קטגוריה:</p>
                <div className="space-y-2">
                  {Object.entries(categoryTotals).map(([category, total]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span>{categoryLabels[category as keyof typeof categoryLabels]}</span>
                      <span className="font-semibold">
                        {total.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="bg-primary text-primary-foreground p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">סה"כ כללי:</span>
                  <span className="text-2xl font-bold">
                    {grandTotal.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/heic,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (currentExpenseForUpload) {
            handleFileSelect(currentExpenseForUpload, e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (currentExpenseForUpload) {
            handleFileSelect(currentExpenseForUpload, e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
