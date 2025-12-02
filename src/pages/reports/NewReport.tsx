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
import { format } from 'date-fns';
import { ArrowRight, Calendar, Camera, FileOutput, Globe, Image as ImageIcon, Plus, Save, Trash2, Upload, X, Plane, Hotel, Utensils, Car, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  currency: 'USD' | 'EUR' | 'ILS' | 'GBP' | 'CHF' | 'PLN' | 'BGN' | 'CZK' | 'HUF' | 'RON' | 'SEK' | 'NOK' | 'DKK' | 'ISK' | 'HRK' | 'RSD' | 'UAH' | 'TRY' | 'CAD' | 'MXN' | 'BRL' | 'ARS' | 'CLP' | 'COP' | 'PEN' | 'UYU' | 'JPY' | 'CNY' | 'KRW' | 'HKD' | 'SGD' | 'THB' | 'MYR' | 'IDR' | 'PHP' | 'VND' | 'TWD' | 'INR' | 'ZAR' | 'EGP' | 'MAD' | 'TND' | 'KES' | 'NGN' | 'GHS' | 'AUD' | 'NZD' | 'AED' | 'SAR' | 'QAR' | 'KWD' | 'JOD';
  amount_in_ils: number;
  receipts: ReceiptFile[];
  notes?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  manager_comment?: string;
  reviewed_at?: string;
}

const categoryLabels = {
  flights: 'טיסות',
  accommodation: 'לינה / חדרי ישיבות',
  food: 'אוכל ואירוח',
  transportation: 'תחבורה מקומית',
  miscellaneous: 'שונות',
};

const categoryIcons = {
  flights: Plane,
  accommodation: Hotel,
  food: Utensils,
  transportation: Car,
  miscellaneous: Package,
};

const categoryColors = {
  flights: 'bg-category-flights text-category-flights-fg',
  accommodation: 'bg-category-accommodation text-category-accommodation-fg',
  food: 'bg-category-food text-category-food-fg',
  transportation: 'bg-category-transportation text-category-transportation-fg',
  miscellaneous: 'bg-category-miscellaneous text-category-miscellaneous-fg',
};

const currencyLabels = {
  // Europe
  USD: '$ דולר',
  EUR: '€ יורו',
  GBP: '£ לירה בריטית',
  CHF: 'CHF פרנק שוויצרי',
  PLN: 'zł זלוטי פולני',
  BGN: 'лв לב בולגרי',
  CZK: 'Kč קורונה צ\'כית',
  HUF: 'Ft פורינט הונגרי',
  RON: 'lei ליאו רומני',
  SEK: 'kr קרונה שוודית',
  NOK: 'kr קרונה נורבגית',
  DKK: 'kr קרונה דנית',
  ISK: 'kr קרונה איסלנדית',
  HRK: 'kn קונה קרואטית',
  RSD: 'din דינר סרבי',
  UAH: '₴ הריבניה אוקראינית',
  TRY: '₺ לירה טורקית',
  // Latin America
  CAD: '$ דולר קנדי',
  MXN: '$ פסו מקסיקני',
  BRL: 'R$ ריאל ברזילאי',
  ARS: '$ פסו ארגנטינאי',
  CLP: '$ פסו צ\'יליאני',
  COP: '$ פסו קולומביאני',
  PEN: 'S/ סול פרואני',
  UYU: '$ פסו אורוגוואי',
  // Far East
  JPY: '¥ ין יפני',
  CNY: '¥ יואן סיני',
  KRW: '₩ וון דרום קוריאני',
  HKD: '$ דולר הונג קונג',
  SGD: '$ דולר סינגפורי',
  THB: '฿ באט תאילנדי',
  MYR: 'RM רינגיט מלזי',
  IDR: 'Rp רופיה אינדונזית',
  PHP: '₱ פסו פיליפיני',
  VND: '₫ דונג וייטנאמי',
  TWD: 'NT$ דולר טאיוואני',
  INR: '₹ רופי הודי',
  // Africa
  ZAR: 'R ראנד דרום אפריקאי',
  EGP: '£ לירה מצרית',
  MAD: 'dh דירהם מרוקאי',
  TND: 'dt דינר תוניסאי',
  KES: 'KSh שילינג קנייתי',
  NGN: '₦ נאירה ניגרית',
  GHS: '₵ סדי גאני',
  // Australia & Oceania
  AUD: '$ דולר אוסטרלי',
  NZD: '$ דולר ניו זילנדי',
  // Middle East
  ILS: '₪ שקל ישראלי',
  AED: 'dh דירהם אמירויות',
  SAR: 'ر.س ריאל סעודי',
  QAR: 'ر.ق ריאל קטארי',
  KWD: 'د.ك דינר כוויתי',
  JOD: 'د.ا דינר ירדני',
};

const currencyRates = {
  // Europe
  USD: 3.60,
  EUR: 3.90,
  GBP: 4.58,
  CHF: 4.10,
  PLN: 0.89,
  BGN: 2.00,
  CZK: 0.16,
  HUF: 0.010,
  RON: 0.78,
  SEK: 0.34,
  NOK: 0.33,
  DKK: 0.52,
  ISK: 0.026,
  HRK: 0.52,
  RSD: 0.033,
  UAH: 0.087,
  TRY: 0.11,
  // Latin America
  CAD: 2.58,
  MXN: 0.18,
  BRL: 0.62,
  ARS: 0.0036,
  CLP: 0.0037,
  COP: 0.00082,
  PEN: 0.95,
  UYU: 0.082,
  // Far East
  JPY: 0.024,
  CNY: 0.50,
  KRW: 0.0027,
  HKD: 0.46,
  SGD: 2.67,
  THB: 0.10,
  MYR: 0.81,
  IDR: 0.00023,
  PHP: 0.062,
  VND: 0.00014,
  TWD: 0.11,
  INR: 0.042,
  // Africa
  ZAR: 0.20,
  EGP: 0.073,
  MAD: 0.36,
  TND: 1.15,
  KES: 0.028,
  NGN: 0.0024,
  GHS: 0.24,
  // Australia & Oceania
  AUD: 2.33,
  NZD: 2.13,
  // Middle East
  ILS: 1.00,
  AED: 0.98,
  SAR: 0.96,
  QAR: 0.99,
  KWD: 11.75,
  JOD: 5.08,
};

export default function NewReport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({
    ILS: 1.0,
    USD: 3.60,
    EUR: 3.90,
    GBP: 4.58,
    // ... rest will be loaded from API
  });

  // Trip details
  const [tripDestination, setTripDestination] = useState('');
  const [dailyAllowance, setDailyAllowance] = useState(100);
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  // Countries with $125/day allowance
  const highAllowanceCountries = [
    'ארה"ב', 'ארהב', 'ארה״ב', 'אמריקה',
    'קנדה',
    'בריטניה', 'אנגליה', 'בריטני',
    'אוסטרליה',
    'ניו זילנד', 'ניוזילנד',
    'יפן',
    'סינגפור',
    'הונג קונג', 'הונג-קונג', 'הונגקונג',
    'שווייץ',
    'נורבגיה',
    'דנמרק',
    'שוודיה',
    'איסלנד',
    'לוקסמבורג'
  ];

  // Calculate daily allowance based on country
  const calculateDailyAllowance = (country: string): number => {
    const normalizedCountry = country.trim();
    const isHighAllowance = highAllowanceCountries.some(
      highCountry => normalizedCountry.includes(highCountry) || highCountry.includes(normalizedCountry)
    );
    return isHighAllowance ? 125 : 100;
  };

  // Update daily allowance when destination changes
  useEffect(() => {
    if (tripDestination) {
      const calculatedAllowance = calculateDailyAllowance(tripDestination);
      setDailyAllowance(calculatedAllowance);
    }
  }, [tripDestination]);

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [currentExpenseForUpload, setCurrentExpenseForUpload] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load existing report if in edit mode
  useEffect(() => {
    if (id && user) {
      setIsEditMode(true);
      setReportId(id);
      loadReport(id);
    }
  }, [id, user]);

  // Load live exchange rates on mount
  useEffect(() => {
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-exchange-rates');
      
      if (error) {
        console.error('Error loading exchange rates:', error);
        return; // Keep default rates
      }

      if (data?.rates) {
        setCurrencyRates(data.rates);
        console.log('Live exchange rates loaded:', data.rates);
      }
    } catch (error) {
      console.error('Failed to load exchange rates:', error);
      // Keep default rates on error
    }
  };

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
      setReportNotes(report.notes || '');
      setDailyAllowance(report.daily_allowance || 100);

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
        notes: exp.notes || '',
        approval_status: exp.approval_status || 'pending',
        manager_comment: exp.manager_comment || undefined,
        reviewed_at: exp.reviewed_at || undefined,
      }));

      setExpenses(transformedExpenses);
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
      notes: '',
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
            updated.amount_in_ils = amount * (currencyRates[currency as keyof typeof currencyRates] || 1);
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

      // Call AI analysis with trip destination for currency detection
      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { 
          imageBase64,
          tripDestination: tripDestination || ''
        }
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
              updated.amount_in_ils = parseFloat(amount) * (currencyRates[currency as keyof typeof currencyRates] || 1);
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

  const handleDelete = async () => {
    if (!reportId || !isEditMode) return;

    setLoading(true);
    try {
      // Delete the report (cascade will delete expenses and receipts)
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: 'הדוח נמחק בהצלחה',
        description: 'הדוח והוצאותיו נמחקו מהמערכת',
      });

      navigate('/');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: 'שגיאה במחיקת הדוח',
        description: error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSave = async (saveAsDraft: boolean = false, closeReport: boolean = false) => {
    console.log('handleSave called', { saveAsDraft, closeReport, expensesLength: expenses.length });
    
    if (!user) {
      console.log('No user found');
      return;
    }

    // Validation
    if (!tripDestination || !tripStartDate || !tripEndDate || !tripPurpose) {
      console.log('Missing trip details', { tripDestination, tripStartDate, tripEndDate, tripPurpose });
      toast({
        title: '⚠️ שגיאה',
        description: 'יש למלא את כל פרטי הנסיעה',
        variant: 'destructive',
      });
      return;
    }

    if (closeReport && expenses.length === 0) {
      console.log('No expenses added for closeReport=true');
      toast({
        title: '⚠️ שגיאה',
        description: 'יש להוסיף לפחות הוצאה אחת לפני הפקת הדוח',
        variant: 'destructive',
      });
      return;
    }

    // Validate expenses have all required fields
    if (expenses.length > 0) {
      console.log('Validating expenses', expenses);
      for (let i = 0; i < expenses.length; i++) {
        const expense = expenses[i];
        const expenseNum = expenses.length - i;
        
        if (!expense.expense_date) {
          console.log('Missing expense_date', expense);
          toast({
            title: '⚠️ שגיאה',
            description: `הוצאה #${expenseNum}: יש למלא תאריך`,
            variant: 'destructive',
          });
          setExpandedExpense(expense.id);
          return;
        }
        
        if (!expense.description || expense.description.trim() === '') {
          console.log('Missing description', expense);
          toast({
            title: '⚠️ שגיאה',
            description: `הוצאה #${expenseNum}: יש למלא תיאור`,
            variant: 'destructive',
          });
          setExpandedExpense(expense.id);
          return;
        }
        
        if (!expense.amount || expense.amount <= 0) {
          console.log('Invalid amount', expense);
          toast({
            title: '⚠️ שגיאה',
            description: `הוצאה #${expenseNum}: יש למלא סכום תקין`,
            variant: 'destructive',
          });
          setExpandedExpense(expense.id);
          return;
        }
      }
    }

    setLoading(true);
    try {
      let report;
      
      // Determine status based on action
      let newStatus: 'draft' | 'open' | 'closed';
      if (closeReport) {
        newStatus = 'closed';
      } else if (saveAsDraft) {
        newStatus = 'draft';
      } else {
        newStatus = 'open'; // Default is open
      }
      
      if (isEditMode && reportId) {
        // Update existing report
        const { data: updatedReport, error: reportError } = await supabase
          .from('reports')
          .update({
            trip_destination: tripDestination,
            trip_start_date: tripStartDate,
            trip_end_date: tripEndDate,
            trip_purpose: tripPurpose,
            notes: reportNotes,
            daily_allowance: dailyAllowance,
            status: newStatus,
            submitted_at: (newStatus === 'open' || newStatus === 'closed') ? new Date().toISOString() : null,
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
        // Create new report - default is 'open'
        const { data: newReport, error: reportError } = await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            trip_destination: tripDestination,
            trip_start_date: tripStartDate,
            trip_end_date: tripEndDate,
            trip_purpose: tripPurpose,
            notes: reportNotes,
            daily_allowance: dailyAllowance,
            status: newStatus,
            submitted_at: (newStatus === 'open' || newStatus === 'closed') ? new Date().toISOString() : null,
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
              currency: exp.currency as any,
              amount_in_ils: exp.amount_in_ils,
              notes: exp.notes || null,
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
      const historyAction = isEditMode ? 'edited' : (saveAsDraft ? 'created' : 'submitted');
      
      await supabase.from('report_history').insert({
        report_id: report.id,
        action: historyAction,
        performed_by: user.id,
        notes: closeReport 
          ? 'הדוח סגור והופק' 
          : (saveAsDraft ? 'הדוח נוצר כטיוטה' : (isEditMode ? 'הדוח עודכן' : 'הדוח הוגש לאישור')),
      });

      const toastTitle = closeReport 
        ? 'הדוח הופק בהצלחה' 
        : (saveAsDraft ? 'הדוח נשמר כטיוטה' : (isEditMode ? 'הדוח עודכן בהצלחה' : 'הדוח נוצר בהצלחה'));
      
      const toastDescription = closeReport
        ? 'הדוח נסגר והופק בהצלחה'
        : (saveAsDraft ? 'ניתן להמשיך לערוך מאוחר יותר' : 'הדוח פתוח ופעיל');

      toast({
        title: toastTitle,
        description: toastDescription,
      });

      // Send email to accounting manager if report is closed and user has accounting email
      if (closeReport) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('accounting_manager_email, username')
            .eq('id', user.id)
            .single();

          // Send to accounting manager
          if (profileData?.accounting_manager_email) {
            await supabase.functions.invoke('send-accounting-report', {
              body: {
                reportId: report.id,
                accountingEmail: profileData.accounting_manager_email,
              }
            });
          }

          // Send to user's registration email (stored in username)
          if (profileData?.username) {
            await supabase.functions.invoke('send-accounting-report', {
              body: {
                reportId: report.id,
                accountingEmail: profileData.username,
              }
            });
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Don't block the flow if email fails
        }
      }

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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-9">
                <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
                <span className="text-sm">חזרה</span>
              </Button>
              <h1 className="text-base sm:text-xl font-bold flex-1 sm:flex-none">{isEditMode ? 'עריכת דוח' : 'דוח חדש'}</h1>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:mr-auto">
              {isEditMode && (
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)} 
                  disabled={loading} 
                  className="h-10 w-10 sm:h-9 sm:w-9"
                  title="מחק דוח"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" onClick={() => handleSave(false, false)} disabled={loading} className="flex-1 sm:flex-none h-10 sm:h-9 text-sm">
                <Save className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                <span className="hidden sm:inline">שמור</span>
                <span className="sm:hidden">שמור</span>
              </Button>
              <Button onClick={() => handleSave(false, true)} disabled={loading} className="flex-1 sm:flex-none h-10 sm:h-9 text-sm">
                <FileOutput className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                <span className="hidden sm:inline">הפק דוח</span>
                <span className="sm:hidden">הפק</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
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
              <Label htmlFor="destination">מדינת היעד *</Label>
              <Input
                id="destination"
                placeholder="לדוגמה: ארה״ב, בולגריה, יפן"
                value={tripDestination}
                onChange={(e) => setTripDestination(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">הזן את שם המדינה בלבד</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dailyAllowance">אש״ל ליום (USD) *</Label>
                <Input
                  id="dailyAllowance"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="100"
                  value={dailyAllowance}
                  onChange={(e) => setDailyAllowance(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">מחושב אוטומטית לפי מדינה, ניתן לעריכה</p>
              </div>
              <div>
                <Label>סה״כ אש״ל לנסיעה</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                  <span className="font-semibold">
                    ${dailyAllowance * calculateTripDuration()} ({calculateTripDuration()} ימים × ${dailyAllowance})
                  </span>
                </div>
              </div>
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
            <div>
              <Label htmlFor="reportNotes">הערות כלליות על הדוח</Label>
              <Textarea
                id="reportNotes"
                placeholder="הוסף הערות, הסברים או פרטים נוספים על הדוח (אופציונלי)"
                rows={3}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
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
                {expenses.slice().reverse().map((expense, index) => (
                  <Card key={expense.id} className="border-2">
                    <div
                      className="p-4 cursor-pointer flex items-center justify-between hover:bg-muted/50"
                      onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">הוצאה #{expenses.length - index}</span>
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
                        {expense.approval_status && expense.approval_status !== 'pending' && (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            expense.approval_status === 'approved' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {expense.approval_status === 'approved' ? '✓ אושר' : '✗ נדחה'}
                          </span>
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
                        {/* Manager Review Status */}
                        {expense.approval_status && expense.approval_status !== 'pending' && (
                          <div className={`p-4 rounded-lg border-2 ${
                            expense.approval_status === 'approved'
                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 ${
                                expense.approval_status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {expense.approval_status === 'approved' ? '✓' : '✗'}
                              </div>
                              <div className="flex-1">
                                <div className={`font-bold text-sm mb-1 ${
                                  expense.approval_status === 'approved' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                                }`}>
                                  {expense.approval_status === 'approved' ? 'ההוצאה אושרה על ידי המנהל' : 'ההוצאה נדחתה על ידי המנהל'}
                                </div>
                                {expense.manager_comment && (
                                  <div className={`text-sm mt-2 ${
                                    expense.approval_status === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                  }`}>
                                    <span className="font-semibold">הערת מנהל: </span>
                                    {expense.manager_comment}
                                  </div>
                                )}
                                {expense.reviewed_at && (
                                  <div className={`text-xs mt-1 ${
                                    expense.approval_status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    נבדק בתאריך: {format(new Date(expense.reviewed_at), 'dd/MM/yyyy HH:mm')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Receipt Upload - First */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-base font-semibold">צלם או העלה קבלה</Label>
                            {expense.receipts.length > 0 && (
                              <div className="flex items-center gap-2">
                                <div className={`text-sm px-3 py-1 rounded-full ${
                                  expense.receipts.filter(r => r.analyzed).length === expense.receipts.length
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {expense.receipts.filter(r => r.analyzed).length}/{expense.receipts.length} נותחו
                                </div>
                              </div>
                            )}
                          </div>
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
                              <div className="space-y-4">
                                {expense.receipts.map((receipt, idx) => (
                                  <div key={idx} className="flex gap-3 items-start">
                                    <div className="relative group flex-shrink-0">
                                      <div className="w-32 h-32 rounded-lg border-2 overflow-hidden bg-muted">
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
                                    {!receipt.analyzed && !receipt.analyzing && (
                                      <Button
                                        type="button"
                                        size="default"
                                        className="mt-2"
                                        onClick={() => analyzeReceipt(expense.id, idx)}
                                      >
                                        ✨ אישור וניתוח
                                      </Button>
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
                              <SelectValue>
                                {expense.category && (() => {
                                  const CategoryIcon = categoryIcons[expense.category];
                                  const categoryColor = categoryColors[expense.category];
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div className={`p-1 rounded ${categoryColor}`}>
                                        <CategoryIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <span>{categoryLabels[expense.category]}</span>
                                    </div>
                                  );
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([value, label]) => {
                                const CategoryIcon = categoryIcons[value as keyof typeof categoryIcons];
                                const categoryColor = categoryColors[value as keyof typeof categoryColors];
                                return (
                                  <SelectItem key={value} value={value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`p-1 rounded ${categoryColor}`}>
                                        <CategoryIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <span>{label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
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

                        <div>
                          <Label>הערות על ההוצאה</Label>
                          <Textarea
                            placeholder="הוסף הערות או פרטים נוספים על ההוצאה (אופציונלי)"
                            rows={2}
                            value={expense.notes || ''}
                            onChange={(e) => updateExpense(expense.id, 'notes', e.target.value)}
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
                  {Object.entries(categoryTotals).map(([category, total]) => {
                    const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons];
                    const categoryColor = categoryColors[category as keyof typeof categoryColors];
                    return (
                      <div key={category} className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${categoryColor}`}>
                            <CategoryIcon className="w-3.5 h-3.5" />
                          </div>
                          {categoryLabels[category as keyof typeof categoryLabels]}
                        </span>
                        <span className="font-semibold">
                          {total.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                        </span>
                      </div>
                    );
                  })}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הדוח וכל ההוצאות והקבלות הקשורות אליו.
              לא ניתן לשחזר את המידע לאחר המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק דוח
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
