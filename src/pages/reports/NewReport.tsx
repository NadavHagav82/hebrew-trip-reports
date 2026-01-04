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
import { ArrowRight, Calendar, Camera, FileOutput, Globe, Image as ImageIcon, Plus, Save, Trash2, Upload, X, Plane, Hotel, Utensils, Car, Package, Receipt, Check, DollarSign } from 'lucide-react';
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
  payment_method: 'company_card' | 'out_of_pocket' | '';
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
  const [includeDailyAllowance, setIncludeDailyAllowance] = useState<boolean | null>(null);
  const [allowanceType, setAllowanceType] = useState<'full' | 'custom' | 'none' | null>(null); // full = all days, custom = manual days, none = no allowance
  const [customAllowanceDays, setCustomAllowanceDays] = useState<number>(1);
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
  const [shakingFields, setShakingFields] = useState<{[expenseId: string]: string[]}>({});
  const [savedExpenses, setSavedExpenses] = useState<Set<string>>(new Set());
  const [duplicateWarning, setDuplicateWarning] = useState<{ expenseId: string; duplicates: Expense[]; reason: string } | null>(null);

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
      // Set daily allowance decision based on existing data
      if (report.daily_allowance !== null && report.daily_allowance !== undefined) {
        if (report.daily_allowance > 0) {
          setIncludeDailyAllowance(true);
          setDailyAllowance(report.daily_allowance);
          
          // Determine if it was full days or custom days using allowance_days
          const tripDays = (() => {
            const start = new Date(report.trip_start_date);
            const end = new Date(report.trip_end_date);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          })();
          
          // Check if allowance_days exists and differs from trip days
          const savedAllowanceDays = (report as any).allowance_days;
          if (savedAllowanceDays && savedAllowanceDays < tripDays) {
            setAllowanceType('custom');
            setCustomAllowanceDays(savedAllowanceDays);
          } else {
            setAllowanceType('full');
            setCustomAllowanceDays(tripDays);
          }
        } else {
          setIncludeDailyAllowance(false);
          setAllowanceType('none');
        }
      } else {
        setDailyAllowance(100);
      }

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
        payment_method: (exp as any).payment_method || '',
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
      payment_method: '',
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
    setSavedExpenses(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Check for duplicate expenses
  const findDuplicates = (expense: Expense): { duplicates: Expense[]; reason: string } | null => {
    const otherExpenses = expenses.filter(exp => exp.id !== expense.id && savedExpenses.has(exp.id));
    const duplicates: Expense[] = [];
    const reasons: string[] = [];

    for (const other of otherExpenses) {
      let isDuplicate = false;
      const matchReasons: string[] = [];

      // Check exact match: same date, amount, and currency
      if (
        expense.expense_date === other.expense_date &&
        expense.amount === other.amount &&
        expense.currency === other.currency
      ) {
        isDuplicate = true;
        matchReasons.push('תאריך, סכום ומטבע זהים');
      }

      // Check same date and category with similar amount (within 5%)
      if (
        !isDuplicate &&
        expense.expense_date === other.expense_date &&
        expense.category === other.category &&
        expense.amount > 0 &&
        other.amount > 0 &&
        Math.abs(expense.amount - other.amount) / Math.max(expense.amount, other.amount) < 0.05
      ) {
        isDuplicate = true;
        matchReasons.push('תאריך וקטגוריה זהים עם סכום דומה');
      }

      // Check similar description (exact match) with same amount
      if (
        !isDuplicate &&
        expense.description &&
        other.description &&
        expense.description.toLowerCase().trim() === other.description.toLowerCase().trim() &&
        expense.amount === other.amount
      ) {
        isDuplicate = true;
        matchReasons.push('תיאור וסכום זהים');
      }

      // Check same ILS amount on same date (different currencies)
      if (
        !isDuplicate &&
        expense.expense_date === other.expense_date &&
        expense.amount_in_ils > 0 &&
        other.amount_in_ils > 0 &&
        Math.abs(expense.amount_in_ils - other.amount_in_ils) < 1 &&
        expense.currency !== other.currency
      ) {
        isDuplicate = true;
        matchReasons.push('סכום בש"ח זהה באותו תאריך (מטבעות שונים)');
      }

      if (isDuplicate) {
        duplicates.push(other);
        reasons.push(...matchReasons);
      }
    }

    if (duplicates.length > 0) {
      return { duplicates, reason: [...new Set(reasons)].join(', ') };
    }
    return null;
  };

  const saveExpense = (expenseId: string, skipDuplicateCheck: boolean = false) => {
    const expense = expenses.find(exp => exp.id === expenseId);
    if (!expense) return;

    // Validate expense
    const missingFields: string[] = [];
    if (!expense.expense_date) missingFields.push('date');
    if (!expense.description || expense.description.trim() === '') missingFields.push('description');
    if (!expense.amount || expense.amount <= 0) missingFields.push('amount');
    if (!expense.payment_method) missingFields.push('payment_method');

    if (missingFields.length > 0) {
      // Trigger shake animation
      setShakingFields(prev => ({ ...prev, [expenseId]: missingFields }));
      setTimeout(() => {
        setShakingFields(prev => {
          const newState = { ...prev };
          delete newState[expenseId];
          return newState;
        });
      }, 500);

      const fieldNames: Record<string, string> = {
        date: 'תאריך',
        description: 'תיאור',
        amount: 'סכום',
        payment_method: 'אמצעי תשלום'
      };
      
      const missingFieldNames = missingFields.map(f => fieldNames[f]).join(', ');
      toast({
        title: '⚠️ שדות חובה חסרים',
        description: missingFieldNames,
        variant: 'destructive',
      });

      // Scroll to first missing field
      setTimeout(() => {
        const firstMissingField = missingFields[0];
        const fieldElement = document.querySelector(`[data-field="${expenseId}-${firstMissingField}"]`);
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return;
    }

    // Check for duplicates (unless skipped)
    if (!skipDuplicateCheck) {
      const duplicateResult = findDuplicates(expense);
      if (duplicateResult) {
        setDuplicateWarning({ expenseId, ...duplicateResult });
        return;
      }
    }

    // Mark as saved
    setSavedExpenses(prev => new Set(prev).add(expenseId));
    setExpandedExpense(null);
    setDuplicateWarning(null);
    
    toast({
      title: '✓ ההוצאה נשמרה',
      description: `${expense.description} - ${expense.amount.toFixed(2)} ${currencyLabels[expense.currency]}`,
    });
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

    // Validate daily allowance decision
    if (closeReport && allowanceType === null) {
      toast({
        title: '⚠️ נדרשת החלטה לגבי אש״ל',
        description: 'יש לבחור האם להוסיף את האש״ל לדוח או לא',
        variant: 'destructive',
      });
      // Scroll to daily allowance section
      const dailyAllowanceSection = document.getElementById('daily-allowance-section');
      if (dailyAllowanceSection) {
        dailyAllowanceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Validate expenses have all required fields
    // Helper function to trigger shake animation
    const triggerShake = (expenseId: string, fields: string[]) => {
      setShakingFields(prev => ({ ...prev, [expenseId]: fields }));
      setTimeout(() => {
        setShakingFields(prev => {
          const newState = { ...prev };
          delete newState[expenseId];
          return newState;
        });
      }, 500);
    };

    if (expenses.length > 0) {
      console.log('Validating expenses', expenses);
      for (let i = 0; i < expenses.length; i++) {
        const expense = expenses[i];
        const expenseNum = expenses.length - i;
        
        // Collect all missing fields for this expense
        const missingFields: string[] = [];
        if (!expense.expense_date) missingFields.push('date');
        if (!expense.description || expense.description.trim() === '') missingFields.push('description');
        if (!expense.amount || expense.amount <= 0) missingFields.push('amount');
        if (!expense.payment_method) missingFields.push('payment_method');
        
        if (missingFields.length > 0) {
          console.log('Missing fields', missingFields, expense);
          setExpandedExpense(expense.id);
          triggerShake(expense.id, missingFields);
          
          const fieldNames: Record<string, string> = {
            date: 'תאריך',
            description: 'תיאור',
            amount: 'סכום',
            payment_method: 'אמצעי תשלום'
          };
          
          const missingFieldNames = missingFields.map(f => fieldNames[f]).join(', ');
          toast({
            title: '⚠️ שדות חובה חסרים',
            description: `הוצאה #${expenseNum}: ${missingFieldNames}`,
            variant: 'destructive',
          });
          
          // Scroll to the first missing field after a short delay to allow expansion
          setTimeout(() => {
            const firstMissingField = missingFields[0];
            const fieldElement = document.querySelector(`[data-field="${expense.id}-${firstMissingField}"]`);
            if (fieldElement) {
              fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          
          return;
        }
      }
    }

    setLoading(true);
    try {
      const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
        ]);
      };

      const invokeWithTimeout = async (fnName: string, body: any, ms = 10000) => {
        try {
          await withTimeout(supabase.functions.invoke(fnName, { body }), ms);
        } catch (e) {
          console.error(`Function invoke timeout/error (${fnName}):`, e);
        }
      };

      let report;

      // Load current user profile when closing report to determine manager / accounting behavior
      let profileData: {
        is_manager?: boolean;
        manager_id?: string | null;
        full_name?: string;
        email?: string;
        accounting_manager_email?: string | null;
        username?: string | null;
      } | null = null;

      if (closeReport) {
        const { data } = await supabase
          .from('profiles')
          .select('is_manager, manager_id, full_name, email, accounting_manager_email, username')
          .eq('id', user.id)
          .single();

        profileData = data;
      }

      const hasManager = !!profileData?.manager_id;
      const isManagerUser = !!profileData?.is_manager;

      // Determine status based on action
      let newStatus: 'draft' | 'open' | 'closed' | 'pending_approval';
      if (closeReport) {
        // Employee with manager → send to manager for approval
        // Manager or employee without manager → close directly
        newStatus = !isManagerUser && hasManager ? 'pending_approval' : 'closed';
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
            daily_allowance: allowanceType === 'none' || !allowanceType ? null : dailyAllowance,
            allowance_days: allowanceType === 'custom' ? customAllowanceDays : (allowanceType === 'full' ? calculateTripDuration() : null),
            status: newStatus,
            submitted_at: (newStatus === 'open' || newStatus === 'closed' || newStatus === 'pending_approval') ? new Date().toISOString() : null,
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
            daily_allowance: allowanceType === 'none' || !allowanceType ? null : dailyAllowance,
            allowance_days: allowanceType === 'custom' ? customAllowanceDays : (allowanceType === 'full' ? calculateTripDuration() : null),
            status: newStatus,
            submitted_at: (newStatus === 'open' || newStatus === 'closed' || newStatus === 'pending_approval') ? new Date().toISOString() : null,
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
              payment_method: exp.payment_method as any,
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
      const isPendingForManager = closeReport && newStatus === 'pending_approval';
      const historyAction = isEditMode ? 'edited' : (saveAsDraft ? 'created' : 'submitted');
      
      await supabase.from('report_history').insert({
        report_id: report.id,
        action: historyAction,
        performed_by: user.id,
        notes: closeReport 
          ? (isPendingForManager ? 'הדוח נשלח לאישור מנהל' : 'הדוח סגור והופק')
          : (saveAsDraft ? 'הדוח נוצר כטיוטה' : (isEditMode ? 'הדוח עודכן' : 'הדוח הוגש לאישור')),
      });

      const toastTitle = closeReport 
        ? (isPendingForManager ? 'הדוח נשלח לאישור מנהל' : 'הדוח הופק בהצלחה')
        : (saveAsDraft ? 'הדוח נשמר כטיוטה' : (isEditMode ? 'הדוח עודכן בהצלחה' : 'הדוח נוצר בהצלחה'));
      
      const toastDescription = closeReport
        ? (isPendingForManager ? 'הדוח נשלח למנהל האחראי לאישור' : 'הדוח נסגר והופק בהצלחה')
        : (saveAsDraft ? 'ניתן להמשיך לערוך מאוחר יותר' : 'הדוח פתוח ופעיל');

      toast({
        title: toastTitle,
        description: toastDescription,
      });

      // If the report is being sent to manager approval, trigger approval email
      if (isPendingForManager && profileData && profileData.manager_id && profileData.full_name) {
        try {
          const { data: managerProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', profileData.manager_id)
            .single();

          if (managerProfile?.email && managerProfile?.full_name) {
            // Fire-and-forget (do not block UI if email service is slow)
            void invokeWithTimeout(
              'request-report-approval',
              {
                reportId: report.id,
                managerEmail: managerProfile.email,
                managerName: managerProfile.full_name,
                employeeName: profileData.full_name,
                reportDetails: {
                  destination: tripDestination,
                  startDate: format(new Date(tripStartDate), 'dd/MM/yyyy'),
                  endDate: format(new Date(tripEndDate), 'dd/MM/yyyy'),
                  purpose: tripPurpose,
                  totalAmount: calculateGrandTotal(),
                },
              },
              10000
            );
          }
        } catch (approvalError) {
          console.error('Error sending manager approval request:', approvalError);
          // Don't block the flow if email fails – the report is already marked as pending_approval
        }
      }

      // Send email to accounting manager if report is closed and user has accounting email
      if (closeReport && !isPendingForManager) {
        try {
          let accountingProfile = profileData;

          if (!accountingProfile) {
            const { data } = await supabase
              .from('profiles')
              .select('accounting_manager_email, username')
              .eq('id', user.id)
              .single();

            accountingProfile = data;
          }

          // Send to accounting manager
          if (accountingProfile?.accounting_manager_email) {
            void invokeWithTimeout(
              'send-accounting-report',
              {
                reportId: report.id,
                accountingEmail: accountingProfile.accounting_manager_email,
              },
              10000
            );
          }

          // Send to user's registration email (stored in username)
          if (accountingProfile?.username) {
            void invokeWithTimeout(
              'send-accounting-report',
              {
                reportId: report.id,
                accountingEmail: accountingProfile.username,
              },
              10000
            );
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-blue-50/30 dark:from-slate-950 dark:via-background dark:to-blue-950/20">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')} 
                className="h-9 hover:bg-primary/10 rounded-xl"
              >
                <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
                <span className="text-sm">חזרה</span>
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25">
                  <FileOutput className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                  {isEditMode ? 'עריכת דוח' : 'דוח נסיעה חדש'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:mr-auto">
              {isEditMode && (
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)} 
                  disabled={loading} 
                  className="h-10 w-10 sm:h-9 sm:w-9 rounded-xl shadow-md"
                  title="מחק דוח"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => handleSave(false, false)} 
                disabled={loading} 
                className="flex-1 sm:flex-none h-10 sm:h-9 text-sm rounded-xl border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Save className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                <span className="hidden sm:inline">שמור</span>
                <span className="sm:hidden">שמור</span>
              </Button>
              <Button 
                onClick={() => handleSave(false, true)} 
                disabled={loading} 
                className="flex-1 sm:flex-none h-10 sm:h-9 text-sm rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-md hover:shadow-lg transition-all"
              >
                <FileOutput className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                <span className="hidden sm:inline">הפק דוח</span>
                <span className="sm:hidden">הפק</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl relative z-10">
        {/* Trip Details */}
        <Card className="mb-6 shadow-xl border-t-4 border-t-blue-500 overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              פרטי הנסיעה
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Destination */}
            <div className="space-y-2">
              <Label htmlFor="destination" className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                מדינת היעד *
              </Label>
              <Input
                id="destination"
                placeholder="לדוגמה: ארה״ב, בולגריה, יפן"
                value={tripDestination}
                onChange={(e) => setTripDestination(e.target.value)}
                className="h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">הזן את שם המדינה בלבד</p>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  תאריך התחלה *
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  תאריך סיום *
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  min={tripStartDate}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">משך הנסיעה</Label>
                <div className="h-12 px-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {calculateTripDuration()} ימים
                  </span>
                </div>
              </div>
            </div>

            {/* Daily Allowance Section - Moved here after trip duration */}
            <div id="daily-allowance-section" className={`rounded-xl border-2 overflow-hidden transition-all ${
              includeDailyAllowance === null 
                ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' 
                : 'border-primary/20 bg-card'
            }`}>
              <div className="h-1 bg-gradient-to-r from-blue-500 via-primary to-indigo-600" />
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-base font-bold">אש״ל יומי</span>
                  </div>
                  {includeDailyAllowance === null && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium animate-pulse">
                      נדרשת החלטה
                    </span>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {/* Option 1: Full days */}
                  <div
                    onClick={() => {
                      setAllowanceType('full');
                      setIncludeDailyAllowance(true);
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      allowanceType === 'full'
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                        allowanceType === 'full'
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/50'
                      }`}>
                        {allowanceType === 'full' && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-semibold text-sm">הוסף אש״ל לכל ימי הנסיעה ({calculateTripDuration()} ימים)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border mr-8">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={dailyAllowance}
                        onChange={(e) => {
                          e.stopPropagation();
                          setDailyAllowance(Number(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 h-8 text-center border-0 bg-transparent p-0 font-bold text-lg"
                      />
                      <span className="text-sm text-muted-foreground">ליום</span>
                    </div>
                  </div>

                  {/* Option 2: Custom days */}
                  <div
                    onClick={() => {
                      setAllowanceType('custom');
                      setIncludeDailyAllowance(true);
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      allowanceType === 'custom'
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                        allowanceType === 'custom'
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/50'
                      }`}>
                        {allowanceType === 'custom' && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-semibold text-sm">הוסף אש״ל למספר ימים ספציפי</span>
                    </div>
                    {allowanceType === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2 mr-8">
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={dailyAllowance}
                            onChange={(e) => {
                              e.stopPropagation();
                              setDailyAllowance(Number(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20 h-8 text-center border-0 bg-transparent p-0 font-bold text-lg"
                          />
                          <span className="text-sm text-muted-foreground">ליום</span>
                        </div>
                        <span className="text-sm text-muted-foreground">×</span>
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                          <Input
                            type="number"
                            min="1"
                            max={calculateTripDuration()}
                            value={customAllowanceDays}
                            onChange={(e) => {
                              e.stopPropagation();
                              const val = Number(e.target.value);
                              setCustomAllowanceDays(Math.min(Math.max(1, val), calculateTripDuration()));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 h-8 text-center border-0 bg-transparent p-0 font-bold text-lg"
                          />
                          <span className="text-sm text-muted-foreground">ימים</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 3: No allowance */}
                  <div
                    onClick={() => {
                      setAllowanceType('none');
                      setIncludeDailyAllowance(false);
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center ${
                      allowanceType === 'none'
                        ? 'border-muted-foreground bg-muted/50'
                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                        allowanceType === 'none'
                          ? 'border-muted-foreground bg-muted-foreground'
                          : 'border-muted-foreground/50'
                      }`}>
                        {allowanceType === 'none' && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-sm text-muted-foreground">לא נדרש אש״ל יומי לדוח זה</span>
                    </div>
                  </div>
                </div>

                {/* Total calculation */}
                {(allowanceType === 'full' || allowanceType === 'custom') && calculateTripDuration() > 0 && (
                  <div className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        סה״כ אש״ל לתקופה ({allowanceType === 'full' ? calculateTripDuration() : customAllowanceDays} ימים)
                      </span>
                      <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                        ${(dailyAllowance * (allowanceType === 'full' ? calculateTripDuration() : customAllowanceDays)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trip Purpose */}
            <div className="space-y-2">
              <Label htmlFor="purpose" className="text-sm font-semibold">מטרת הנסיעה *</Label>
              <Textarea
                id="purpose"
                placeholder="תאר את מטרת הנסיעה העסקית"
                rows={3}
                value={tripPurpose}
                onChange={(e) => setTripPurpose(e.target.value)}
                className="resize-none"
              />
            </div>

            {/* Report Notes */}
            <div className="space-y-2">
              <Label htmlFor="reportNotes" className="text-sm font-semibold">הערות כלליות על הדוח</Label>
              <Textarea
                id="reportNotes"
                placeholder="הוסף הערות, הסברים או פרטים נוספים על הדוח (אופציונלי)"
                rows={3}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="mb-6 shadow-xl border-t-4 border-t-green-500 overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-br from-green-600 to-emerald-700 text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                הוצאות
              </CardTitle>
              <Button 
                onClick={addExpense} 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 border rounded-xl shadow-md"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף הוצאה
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {expenses.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border-2 border-dashed border-green-200 dark:border-green-800">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-muted-foreground mb-2 font-medium">עדיין לא הוספת הוצאות</p>
                <p className="text-sm text-muted-foreground">לחץ על "הוסף הוצאה" כדי להתחיל</p>
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.slice().reverse().map((expense, index) => {
                  const CategoryIcon = expense.category ? categoryIcons[expense.category] : Package;
                  const categoryColor = expense.category ? categoryColors[expense.category] : 'bg-muted text-muted-foreground';
                  
                  return (
                  <Card 
                    key={expense.id} 
                    className={`relative transition-all duration-300 overflow-hidden hover:shadow-lg ${
                      savedExpenses.has(expense.id) 
                        ? 'border-2 border-green-500 shadow-green-100 dark:shadow-green-900/20' 
                        : 'border border-border hover:border-primary/30'
                    }`}
                  >
                    {/* Category color indicator */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${categoryColor.split(' ')[0]}`} />
                    
                    {/* Saved indicator - top left corner */}
                    {savedExpenses.has(expense.id) && (
                      <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full p-1.5 shadow-md" title="נשמר">
                        <Save className="w-3.5 h-3.5" />
                      </div>
                    )}
                    
                    <div
                      className="p-4 pt-5 cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${categoryColor} flex items-center justify-center shadow-sm`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">הוצאה #{expenses.length - index}</span>
                          {expense.description && (
                            <span className="text-sm text-muted-foreground">{expense.description}</span>
                          )}
                        </div>
                        {expense.amount > 0 && (
                          <div className="mr-4 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold">
                            {expense.amount.toFixed(2)} {currencyLabels[expense.currency]?.split(' ')[0]}
                          </div>
                        )}
                        {expense.approval_status && expense.approval_status !== 'pending' && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shadow-sm ${
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
                          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 rounded-lg"
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
                            <div className="flex gap-6 justify-center">
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-16 w-16 border-primary/30 hover:border-primary hover:bg-primary/10"
                                  onClick={() => openCameraDialog(expense.id)}
                                  title="צלם קבלה"
                                >
                                  <Camera className="w-7 h-7 text-primary" />
                                </Button>
                                <span className="text-xs text-muted-foreground">צלם קבלה</span>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-16 w-16 border-primary/30 hover:border-primary hover:bg-primary/10"
                                  onClick={() => openFileDialog(expense.id)}
                                  title="העלה קובץ"
                                >
                                  <Upload className="w-7 h-7 text-primary" />
                                </Button>
                                <span className="text-xs text-muted-foreground">העלה קובץ</span>
                              </div>
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
                                    <div className="flex flex-col gap-2 mt-2">
                                      {!receipt.analyzed && !receipt.analyzing && (
                                        <Button
                                          type="button"
                                          size="default"
                                          onClick={() => analyzeReceipt(expense.id, idx)}
                                        >
                                          ✨ אישור וניתוח
                                        </Button>
                                      )}
                                      {!savedExpenses.has(expense.id) && (
                                        <Button
                                          type="button"
                                          size="default"
                                          className="bg-green-600 hover:bg-green-700"
                                          onClick={() => saveExpense(expense.id)}
                                        >
                                          <Save className="w-4 h-4 ml-1" />
                                          שמור הוצאה
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Payment Method - Prominent buttons - FIRST */}
                        <div 
                          data-field={`${expense.id}-payment_method`}
                          className={`p-4 rounded-lg border-2 transition-all ${
                          !expense.payment_method 
                            ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' 
                            : 'border-muted bg-muted/30'
                        } ${shakingFields[expense.id]?.includes('payment_method') ? 'animate-shake' : ''}`}>
                          <Label className="text-base font-semibold mb-3 block">
                            אמצעי תשלום * <span className="text-sm font-normal text-muted-foreground">(חובה לבחור)</span>
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => updateExpense(expense.id, 'payment_method', 'out_of_pocket')}
                              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                                expense.payment_method === 'out_of_pocket'
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <span className="text-3xl">💵</span>
                              <span className="font-medium text-sm text-center">מכיס העובד</span>
                              <span className="text-xs text-muted-foreground">(נדרש החזר)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateExpense(expense.id, 'payment_method', 'company_card')}
                              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                                expense.payment_method === 'company_card'
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <span className="text-3xl">💳</span>
                              <span className="font-medium text-sm text-center">כרטיס חברה</span>
                              <span className="text-xs text-muted-foreground">(אשראי)</span>
                            </button>
                          </div>
                        </div>

                        {/* Expense Details - Date */}
                        <div data-field={`${expense.id}-date`} className={shakingFields[expense.id]?.includes('date') ? 'animate-shake' : ''}>
                          <Label className={!expense.expense_date ? 'text-orange-600 dark:text-orange-400' : ''}>
                            תאריך * {!expense.expense_date && <span className="text-xs font-normal">(חובה)</span>}
                          </Label>
                          <Input
                            type="date"
                            value={expense.expense_date}
                            onChange={(e) => updateExpense(expense.id, 'expense_date', e.target.value)}
                            min={tripStartDate}
                            max={tripEndDate}
                            className={!expense.expense_date ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-400/20' : ''}
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

                        <div data-field={`${expense.id}-description`} className={shakingFields[expense.id]?.includes('description') ? 'animate-shake' : ''}>
                          <Label className={!expense.description.trim() ? 'text-orange-600 dark:text-orange-400' : ''}>
                            תיאור * {!expense.description.trim() && <span className="text-xs font-normal">(חובה)</span>}
                          </Label>
                          <Input
                            placeholder="תאר את ההוצאה"
                            value={expense.description}
                            onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                            className={!expense.description.trim() ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-400/20' : ''}
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
                          <div data-field={`${expense.id}-amount`} className={shakingFields[expense.id]?.includes('amount') ? 'animate-shake' : ''}>
                            <Label className={!expense.amount ? 'text-orange-600 dark:text-orange-400' : ''}>
                              סכום * {!expense.amount && <span className="text-xs font-normal">(חובה)</span>}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={expense.amount || ''}
                              onChange={(e) => updateExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                              className={!expense.amount ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-400/20' : ''}
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

                        {/* Save button at bottom */}
                        {!savedExpenses.has(expense.id) && (
                          <Button
                            onClick={() => saveExpense(expense.id)}
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="lg"
                          >
                            <Save className="w-5 h-5 ml-2" />
                            שמור הוצאה
                          </Button>
                        )}
                        {savedExpenses.has(expense.id) && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 text-center">
                            <span className="text-green-700 dark:text-green-400 font-semibold">✓ ההוצאה נשמרה בהצלחה</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {expenses.length > 0 && (
          <Card className="shadow-xl border-t-4 border-t-purple-500 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-br from-purple-600 to-violet-700 text-white">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                סיכום הוצאות
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
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

              {/* Payment Method Summary */}
              <div>
                <p className="font-semibold mb-3">סיכום לפי אמצעי תשלום:</p>
                <div className="space-y-2">
                  {(() => {
                    const companyCardTotal = expenses
                      .filter(e => e.payment_method === 'company_card')
                      .reduce((sum, e) => sum + e.amount_in_ils, 0);
                    const outOfPocketTotal = expenses
                      .filter(e => e.payment_method === 'out_of_pocket')
                      .reduce((sum, e) => sum + e.amount_in_ils, 0);
                    
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <span>💳</span>
                            כרטיס חברה
                          </span>
                          <span className="font-semibold">
                            {companyCardTotal.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <span>💵</span>
                            מכיס העובד (נדרש החזר)
                          </span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {outOfPocketTotal.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                          </span>
                        </div>
                      </>
                    );
                  })()}
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

              {/* Reimbursement highlight */}
              {expenses.some(e => e.payment_method === 'out_of_pocket') && (
                <div className="bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-orange-800 dark:text-orange-300">💰 סה"כ להחזר לעובד:</span>
                    <span className="text-xl font-bold text-orange-800 dark:text-orange-300">
                      {expenses
                        .filter(e => e.payment_method === 'out_of_pocket')
                        .reduce((sum, e) => sum + e.amount_in_ils, 0)
                        .toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                    </span>
                  </div>
                </div>
              )}
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

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={duplicateWarning !== null} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <span className="text-2xl">⚠️</span>
              זוהתה הוצאה כפולה אפשרית
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              <div className="space-y-3 mt-2">
                <p className="font-medium text-foreground">
                  {duplicateWarning?.reason}
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">הוצאות דומות קיימות:</p>
                  {duplicateWarning?.duplicates.map((dup) => (
                    <div key={dup.id} className="text-sm text-amber-700 dark:text-amber-300 flex flex-wrap items-center gap-2">
                      <span className="bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                        {dup.expense_date ? format(new Date(dup.expense_date), 'dd/MM/yyyy') : 'ללא תאריך'}
                      </span>
                      <span className="font-medium">{dup.amount} {dup.currency}</span>
                      <span className="truncate max-w-[150px]">{dup.description}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  האם בכל זאת לשמור את ההוצאה?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <AlertDialogCancel onClick={() => setDuplicateWarning(null)}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (duplicateWarning) {
                  saveExpense(duplicateWarning.expenseId, true);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              שמור בכל זאת
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
