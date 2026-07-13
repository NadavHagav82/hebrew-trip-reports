import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowRight, ArrowLeft, Upload, X, CheckCircle2, AlertCircle,
  Plane, Hotel, Sun, FileText, Loader2, Receipt, Camera, Plus, Check,
  UtensilsCrossed, Car, ShoppingBag, ChevronDown, Globe, Calendar, Target, Wallet, Building2, Send, User
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { blobToOrientedImageDataUrl } from '@/utils/imageDataUrl';
import { convertPdfToImages } from '@/utils/pdfToImage';

// ──────────────── Types ────────────────
type PaymentMethod = 'out_of_pocket' | 'company_card';

interface UploadedDoc {
  id: string;
  file: File;
  preview: string | null;
  paymentMethod: PaymentMethod | null;
  analyzed: boolean;
  analyzing: boolean;
  amount: number | null;
  amountIls: number | null;
  currency: string;
  description: string;
  category: string;
  expenseDate: string;
  error: string | null;
  /** If set, this doc already exists in DB and should not be re-created */
  existingExpenseId?: string;
}

type DocBucketKey = 'docs' | 'flightDocs' | 'accommodationDocs';

interface WizardData {
  tripStartDate: string;
  tripEndDate: string;
  tripDestination: string;
  tripPurpose: string;
  docs: UploadedDoc[];
  addAllowance: boolean | null;
  allowanceDays: number;
  dailyAllowance: number;
  addFlights: boolean | null;
  flightDocs: UploadedDoc[];
  flightTotal: number;
  addAccommodation: boolean | null;
  accommodationDocs: UploadedDoc[];
  accommodationTotal: number;
}

const DRAFT_KEY = 'independent_draft_wizard';

const STEP_ICONS = [FileText, Upload, Sun, Plane, Hotel, CheckCircle2];
const STEP_LABELS = [
  'פרטי הנסיעה',
  'חשבוניות',
  'ימי שהייה',
  'טיסות',
  'לינה',
  'סיכום',
];

const DEFAULT_DAILY_ALLOWANCE = 77; // USD per day

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Plane; emoji: string }> = {
  flights: { label: 'טיסות', icon: Plane, emoji: '✈️' },
  accommodation: { label: 'לינה', icon: Hotel, emoji: '🏨' },
  food: { label: 'אוכל', icon: UtensilsCrossed, emoji: '🍽️' },
  transportation: { label: 'תחבורה', icon: Car, emoji: '🚗' },
  miscellaneous: { label: 'שונות', icon: ShoppingBag, emoji: '📦' },
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_CONFIG);

// ──────────────── Component ────────────────
export default function IndependentNewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftReportId, setDraftReportId] = useState<string | null>(null);
  const draftReportIdRef = useRef<string | null>(null);
  const [isIndependent, setIsIndependent] = useState<boolean | null>(null);
  const [managerInfo, setManagerInfo] = useState<{ id: string; name: string; email: string } | null>(null);
  const [showManagerDialog, setShowManagerDialog] = useState(false);

  const [data, setData] = useState<WizardData>({
    tripStartDate: '',
    tripEndDate: '',
    tripDestination: '',
    tripPurpose: '',
    docs: [],
    addAllowance: null,
    allowanceDays: 0,
    dailyAllowance: DEFAULT_DAILY_ALLOWANCE,
    addFlights: null,
    flightDocs: [],
    flightTotal: 0,
    addAccommodation: null,
    accommodationDocs: [],
    accommodationTotal: 0,
  });
  const dataRef = useRef<WizardData>(data);
  const draftCreationRef = useRef<Promise<string | null> | null>(null);

  const [usdToIls, setUsdToIls] = useState(3.7); // fallback rate

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    draftReportIdRef.current = draftReportId;
  }, [draftReportId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const flightInputRef = useRef<HTMLInputElement>(null);
  const flightPdfInputRef = useRef<HTMLInputElement>(null);
  const accommodationInputRef = useRef<HTMLInputElement>(null);
  const accommodationPdfInputRef = useRef<HTMLInputElement>(null);

  const tripDays = data.tripStartDate && data.tripEndDate
    ? Math.max(1, Math.ceil((new Date(data.tripEndDate).getTime() - new Date(data.tripStartDate).getTime()) / 86400000) + 1)
    : 0;

  const allowanceTotalUsd = data.allowanceDays * data.dailyAllowance;
  const allowanceTotalIls = Math.round(allowanceTotalUsd * usdToIls);

  const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 25_000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
    });
    try {
      return await Promise.race([Promise.resolve(promise), timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const hasMeaningfulDraftContent = (draftData: WizardData = dataRef.current) => (
    !!draftData.tripStartDate ||
    !!draftData.tripEndDate ||
    !!draftData.tripDestination.trim() ||
    !!draftData.tripPurpose.trim() ||
    draftData.docs.length > 0 ||
    draftData.flightDocs.length > 0 ||
    draftData.accommodationDocs.length > 0 ||
    draftData.addAllowance !== null ||
    draftData.addFlights !== null ||
    draftData.addAccommodation !== null
  );

  const extractReceiptStoragePath = (source: string) => {
    const decoded = decodeURIComponent(String(source || '').trim());
    if (!decoded) return '';
    if (decoded.startsWith('http') || decoded.includes('/storage/v1/')) {
      return (
        decoded.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/([^?#]+)/i)?.[1] ||
        decoded.match(/\/receipts\/([^?#]+)/i)?.[1] ||
        ''
      );
    }
    return decoded.replace(/^\/+/, '');
  };

  const resolveReceiptPreview = async (receipt: any): Promise<string | null> => {
    const rawUrl = String(receipt?.file_url || '').trim();
    if (!rawUrl) return null;

    if (receipt?.file_type === 'pdf') return 'pdf';

    try {
      const storagePath = extractReceiptStoragePath(rawUrl);
      if (storagePath) {
        const { data: signedData } = await withTimeout(
          supabase.storage.from('receipts').createSignedUrl(storagePath, 3600),
          15_000,
        );
        const signedUrl = signedData?.signedUrl;
        return signedUrl
          ? (signedUrl.startsWith('http') ? signedUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signedUrl}`)
          : null;
      }
      return rawUrl.startsWith('http') ? rawUrl : null;
    } catch {
      return null;
    }
  };

  const mergeDocsByExpenseId = (current: UploadedDoc[], incoming: UploadedDoc[]) => {
    const seen = new Set(current.map(doc => doc.existingExpenseId || doc.id));
    return [
      ...current,
      ...incoming.filter(doc => {
        const key = doc.existingExpenseId || doc.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  };

  const loadExistingExpensesIntoWizard = async (reportId: string) => {
    const { data: expenses, error } = await withTimeout(
      supabase
        .from('expenses')
        .select('*, receipts(*)')
        .eq('report_id', reportId)
        .order('expense_date', { ascending: true }),
      25_000,
    );

    if (error) throw error;

    const existingDocs: UploadedDoc[] = [];
    let hasAllowanceExpense = false;

    for (const exp of expenses || []) {
      if (exp.description?.startsWith('ימי שהייה:')) {
        hasAllowanceExpense = true;
        continue;
      }

      const receipt = Array.isArray(exp.receipts) && exp.receipts.length > 0 ? exp.receipts[0] : null;
      const placeholderFile = new File([], receipt?.file_name || exp.description || 'existing-receipt', {
        type: receipt?.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      });

      existingDocs.push({
        id: exp.id,
        file: placeholderFile,
        preview: receipt ? await resolveReceiptPreview(receipt) : null,
        paymentMethod: (exp.payment_method as PaymentMethod) || 'out_of_pocket',
        analyzed: true,
        analyzing: false,
        amount: exp.amount,
        amountIls: exp.amount_in_ils,
        currency: exp.currency || 'ILS',
        description: exp.description || receipt?.file_name || '',
        category: exp.category || 'miscellaneous',
        expenseDate: exp.expense_date || '',
        error: null,
        existingExpenseId: exp.id,
      });
    }

    if (existingDocs.length === 0 && !hasAllowanceExpense) return;

    const flightDocs = existingDocs.filter(d => d.category === 'flights');
    const accDocs = existingDocs.filter(d => d.category === 'accommodation');
    const regularDocs = existingDocs.filter(d => d.category !== 'flights' && d.category !== 'accommodation');

    setData(prev => {
      const merged = {
        ...prev,
        docs: mergeDocsByExpenseId(prev.docs, regularDocs),
        flightDocs: mergeDocsByExpenseId(prev.flightDocs, flightDocs),
        accommodationDocs: mergeDocsByExpenseId(prev.accommodationDocs, accDocs),
        addFlights: flightDocs.length > 0 ? true : prev.addFlights,
        flightTotal: flightDocs.reduce((s, d) => s + (d.amountIls || 0), 0) || prev.flightTotal,
        addAccommodation: accDocs.length > 0 ? true : prev.addAccommodation,
        accommodationTotal: accDocs.reduce((s, d) => s + (d.amountIls || 0), 0) || prev.accommodationTotal,
        addAllowance: hasAllowanceExpense ? true : prev.addAllowance,
      };
      dataRef.current = merged;
      return merged;
    });
  };

  // Fetch USD→ILS exchange rate on mount
  useEffect(() => {
    supabase.functions.invoke('get-exchange-rates').then(({ data: rateData }) => {
      if (rateData?.rates?.USD) {
        setUsdToIls(rateData.rates.USD);
      }
    }).catch(() => {});
  }, []);

  // ──── Detect user role ────
  useEffect(() => {
    if (!user) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'independent' as any })
      .then(({ data }) => setIsIndependent(!!data));
  }, [user]);

  // ──── Support /reports/edit/:id for organizational users ────
  useEffect(() => {
    if (editId && user && !searchParams.get('draft')) {
      setDraftReportId(editId);
      draftReportIdRef.current = editId;
      supabase.from('reports').select('*').eq('id', editId).single().then(async ({ data: report }) => {
        if (report) {
          setData(prev => ({
            ...prev,
            tripStartDate: report.trip_start_date || '',
            tripEndDate: report.trip_end_date || '',
            tripDestination: report.trip_destination || '',
            tripPurpose: report.trip_purpose || '',
            dailyAllowance: report.daily_allowance || DEFAULT_DAILY_ALLOWANCE,
            allowanceDays: report.allowance_days || 0,
            addAllowance: report.allowance_days ? true : null,
          }));
          await loadExistingExpensesIntoWizard(editId);
        }
      });
    }
  }, [editId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──── Draft: Load from URL or localStorage on mount ────
  useEffect(() => {
    const draftId = searchParams.get('draft');
    if (draftId) {
      // Load draft from DB
      setDraftReportId(draftId);
      draftReportIdRef.current = draftId;
      supabase.from('reports').select('*').eq('id', draftId).single().then(async ({ data: report }) => {
        if (report) {
          setData(prev => ({
            ...prev,
            tripStartDate: report.trip_start_date || '',
            tripEndDate: report.trip_end_date || '',
            tripDestination: report.trip_destination || '',
            tripPurpose: report.trip_purpose || '',
            dailyAllowance: report.daily_allowance || DEFAULT_DAILY_ALLOWANCE,
            allowanceDays: report.allowance_days || 0,
            addAllowance: report.allowance_days ? true : null,
          }));

          await loadExistingExpensesIntoWizard(draftId);

          // Load saved step from localStorage
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.draftReportId === draftId && parsed.step) {
                setStep(parsed.step);
                // Restore non-file settings
                if (parsed.addFlights !== undefined) setData(p => ({ ...p, addFlights: parsed.addFlights, flightTotal: parsed.flightTotal || p.flightTotal }));
                if (parsed.addAccommodation !== undefined) setData(p => ({ ...p, addAccommodation: parsed.addAccommodation, accommodationTotal: parsed.accommodationTotal || p.accommodationTotal }));
              }
            } catch {}
          }
          toast({ title: 'טיוטא נטענה', description: 'ממשיך מאיפה שעצרת' });
        }
      });
    } else {
      // Check localStorage for unsaved draft
      if (editId) return; // Don't clobber DB-loaded edit data with localStorage
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.draftReportId) {
            setDraftReportId(parsed.draftReportId);
            draftReportIdRef.current = parsed.draftReportId;
            setStep(parsed.step || 0);
            setData(prev => ({
              ...prev,
              tripStartDate: parsed.tripStartDate || '',
              tripEndDate: parsed.tripEndDate || '',
              tripDestination: parsed.tripDestination || '',
              tripPurpose: parsed.tripPurpose || '',
              addAllowance: parsed.addAllowance ?? null,
              allowanceDays: parsed.allowanceDays || 0,
              dailyAllowance: parsed.dailyAllowance || DEFAULT_DAILY_ALLOWANCE,
              addFlights: parsed.addFlights ?? null,
              flightTotal: parsed.flightTotal || 0,
              addAccommodation: parsed.addAccommodation ?? null,
              accommodationTotal: parsed.accommodationTotal || 0,
            }));
            loadExistingExpensesIntoWizard(parsed.draftReportId).catch(() => {});
            toast({ title: 'טיוטא נטענה', description: 'ממשיך מאיפה שעצרת' });
          }
        } catch {}
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ──── Draft: Auto-save to localStorage on change ────
  useEffect(() => {
    const toSave = {
      tripStartDate: data.tripStartDate,
      tripEndDate: data.tripEndDate,
      tripDestination: data.tripDestination,
      tripPurpose: data.tripPurpose,
      addAllowance: data.addAllowance,
      allowanceDays: data.allowanceDays,
      dailyAllowance: data.dailyAllowance,
      addFlights: data.addFlights,
      flightTotal: data.flightTotal,
      addAccommodation: data.addAccommodation,
      accommodationTotal: data.accommodationTotal,
      step,
      draftReportId,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
  }, [data, step, draftReportId]);

  // ──── Draft: Auto-save to DB on every meaningful change ────
  useEffect(() => {
    if (!user || !hasMeaningfulDraftContent(data)) return;

    const timeoutId = window.setTimeout(() => {
      saveDraftToDb(data).catch(error => {
        console.error('Auto-save draft error:', error);
      });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [data, user, usdToIls]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──── Draft: Create/update in DB ────
  const saveDraftToDb = async (draftData: WizardData = dataRef.current) => {
    if (!user || !hasMeaningfulDraftContent(draftData)) return null;
    const draftAllowanceTotalIls = Math.round((draftData.allowanceDays || 0) * (draftData.dailyAllowance || DEFAULT_DAILY_ALLOWANCE) * usdToIls);
    const totalIls = draftData.docs.reduce((s, d) => s + (d.amountIls || 0), 0)
      + (draftData.addAllowance ? draftAllowanceTotalIls : 0)
      + (draftData.addFlights ? draftData.flightTotal : 0)
      + (draftData.addAccommodation ? draftData.accommodationTotal : 0);

    let reportId = draftReportIdRef.current;
    if (reportId) {
      await withTimeout(supabase.from('reports').update({
        trip_start_date: draftData.tripStartDate,
        trip_end_date: draftData.tripEndDate,
        trip_destination: draftData.tripDestination,
        trip_purpose: draftData.tripPurpose,
        total_amount_ils: totalIls,
        daily_allowance: draftData.addAllowance ? draftData.dailyAllowance : null,
        allowance_days: draftData.addAllowance ? draftData.allowanceDays : null,
      }).eq('id', reportId), 20_000);
    } else {
      if (!draftCreationRef.current) {
        draftCreationRef.current = (async () => {
          const { data: report, error } = await withTimeout(supabase.from('reports').insert({
            user_id: user.id,
            trip_start_date: draftData.tripStartDate || new Date().toISOString().split('T')[0],
            trip_end_date: draftData.tripEndDate || new Date().toISOString().split('T')[0],
            trip_destination: draftData.tripDestination || 'טיוטא',
            trip_purpose: draftData.tripPurpose || 'טיוטא',
            status: 'draft',
            total_amount_ils: totalIls,
            daily_allowance: draftData.addAllowance ? draftData.dailyAllowance : null,
            allowance_days: draftData.addAllowance ? draftData.allowanceDays : null,
          }).select().single(), 20_000);

          if (error || !report) throw error || new Error('Draft report was not created');

          draftReportIdRef.current = report.id;
          setDraftReportId(report.id);
          return report.id;
        })().finally(() => {
          draftCreationRef.current = null;
        });
      }

      reportId = await draftCreationRef.current;
    }

    if (reportId) {
      await persistDocsAsDraft(reportId, draftData);
    }

    return reportId;
  };

  // Persist docs (from all 3 buckets) to DB as draft expenses+receipts.
  // It saves immediately, even before analysis finishes, then updates the same expense when analysis returns.
  const persistDocsAsDraft = async (reportId: string, draftData: WizardData = dataRef.current) => {
    if (!user) return;
    const buckets: Array<{ key: DocBucketKey; forceCategory?: string }> = [
      { key: 'docs' },
      { key: 'flightDocs', forceCategory: 'flights' },
      { key: 'accommodationDocs', forceCategory: 'accommodation' },
    ];

    for (const { key, forceCategory } of buckets) {
      const list = draftData[key];
      for (const doc of list) {
        const category = forceCategory || doc.category || 'miscellaneous';
        const expensePayload = {
          expense_date: doc.expenseDate || draftData.tripStartDate || new Date().toISOString().split('T')[0],
          category: category as any,
          amount: doc.amount || 0,
          currency: (doc.currency || 'ILS') as any,
          amount_in_ils: doc.amountIls || doc.amount || 0,
          description: doc.description || doc.file?.name || 'חשבונית',
          payment_method: (doc.paymentMethod || 'out_of_pocket') as any,
          approval_status: 'pending' as any,
        };

        try {
          if (doc.existingExpenseId) {
            await withTimeout(
              supabase
                .from('expenses')
                .update(expensePayload as any)
                .eq('id', doc.existingExpenseId),
              20_000,
            );
            continue;
          }

          // Only brand-new docs with a real file need a new expense + receipt upload.
          if (!doc.file || doc.file.size === 0) continue;

          const { data: expense, error: expenseError } = await withTimeout(
            supabase
              .from('expenses')
              .insert({ report_id: reportId, ...expensePayload } as any)
              .select()
              .single(),
            20_000,
          );

          if (expenseError || !expense) throw expenseError || new Error('Expense was not created');

          const isImageFile =
            doc.file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file.name);
          const ext = isImageFile ? (doc.file.name.split('.').pop() || 'jpg') : 'jpg';
          const filePath = `${user.id}/${reportId}/${expense.id}.${ext}`;

          const { error: storageError } = await withTimeout(
            supabase.storage
              .from('receipts')
              .upload(filePath, doc.file, { upsert: true }),
            30_000,
          );

          if (storageError) {
            await supabase.from('expenses').delete().eq('id', expense.id);
            throw storageError;
          }

          await withTimeout(
            supabase.from('receipts').insert({
              expense_id: expense.id,
              file_name: doc.file.name,
              file_size: doc.file.size,
              file_type: 'image' as any,
              file_url: filePath,
            }),
            20_000,
          );

          // Mark this doc as persisted so we don't insert it again
          const markedData = {
            ...dataRef.current,
            [key]: dataRef.current[key].map(d => (d.id === doc.id ? { ...d, existingExpenseId: expense.id } : d)),
          } as WizardData;
          dataRef.current = markedData;
          setData(prev => ({
            ...prev,
            [key]: prev[key].map(d => (d.id === doc.id ? { ...d, existingExpenseId: expense.id } : d)),
          }));
        } catch (e) {
          console.error('Draft persist error:', e);
        }
      }
    }
  };

  // ──── File helpers ────
  const fileToPreview = async (file: File): Promise<string | null> => {
    // Handle images (including HEIC from iOS)
    const isImage = file.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name);
    if (isImage) {
      try {
        return await blobToOrientedImageDataUrl(file, { maxSize: 600, quality: 0.7 });
      } catch {
        // Fallback to basic reader
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }
    }
    // For PDFs return a marker so we can show an icon
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) return 'pdf';
    return null;
  };

  const analyzeFile = async (doc: UploadedDoc, tripDestination: string, tripStartDate: string): Promise<Partial<UploadedDoc>> => {
    const isImage = doc.file.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file.name);
    const isPdf = doc.file.type === 'application/pdf' || /\.pdf$/i.test(doc.file.name);

    if (!isImage && !isPdf) {
      return { analyzed: true, analyzing: false, description: doc.file.name };
    }

    try {
      let dataUri: string;

      if (isPdf) {
        // Convert first page of PDF to image, then analyze
        const images = await convertPdfToImages(doc.file);
        if (images.length === 0) {
          return { analyzed: true, analyzing: false, description: doc.file.name, error: 'לא ניתן להמיר PDF לתמונה' };
        }
        dataUri = await blobToOrientedImageDataUrl(images[0], { maxSize: 1800, quality: 0.85 });
      } else {
        // Use oriented & compressed data URI for analysis (max 1800px)
        dataUri = await blobToOrientedImageDataUrl(doc.file, { maxSize: 1800, quality: 0.85 });
      }

      const { data: fnData, error } = await supabase.functions.invoke('analyze-receipt', {
        body: {
          imageBase64: dataUri,
          mimeType: 'image/jpeg',
          fileName: doc.file.name,
          tripDestination,
        },
      });

      if (error) throw error;

      const result = fnData?.data || fnData?.result || {};
      return {
        analyzed: true,
        analyzing: false,
        amount: result.amount ?? null,
        amountIls: result.amount_in_ils ?? result.amount ?? null,
        currency: result.currency || 'ILS',
        description: result.description || doc.file.name,
        category: result.category || 'miscellaneous',
        expenseDate: result.date || tripStartDate,
      };
    } catch (err) {
      console.error('Analyze error:', err);
      return { analyzed: true, analyzing: false, error: 'לא ניתן לנתח את המסמך' };
    }
  };

  const handleFilesAdded = useCallback(async (files: FileList, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    const maxPerBatch = 10;
    // FileList is live: resetting the input on mobile can clear it while previews are still processing.
    // Copy it synchronously before the first await so camera captures never disappear mid-upload.
    const selectedFiles = Array.from(files).slice(0, maxPerBatch);
    if (selectedFiles.length === 0) return;

    const destination = dataRef.current.tripDestination;
    const startDate = dataRef.current.tripStartDate;

    const newDocs: UploadedDoc[] = [];
    let skippedUnsupported = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const rawFile = selectedFiles[i];
      const isPdf = rawFile.type === 'application/pdf' || /\.pdf$/i.test(rawFile.name);
      const hasKnownType = !!rawFile.type && rawFile.type !== 'application/octet-stream';
      const isImage = rawFile.type.startsWith('image/')
        || /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp)$/i.test(rawFile.name)
        || (!hasKnownType && !isPdf);

      if (!isImage && !isPdf) {
        skippedUnsupported += 1;
        continue;
      }

      // On mobile, file.type may be empty or generic for PDFs — detect by extension
      let file = rawFile;
      if ((!rawFile.type || rawFile.type === 'application/octet-stream') && isPdf) {
        // Re-wrap with correct MIME so storage upload works
        file = new File([rawFile], rawFile.name, { type: 'application/pdf' });
      } else if ((!rawFile.type || rawFile.type === 'application/octet-stream') && isImage) {
        const lowerName = rawFile.name.toLowerCase();
        const imageType = lowerName.endsWith('.heic') ? 'image/heic'
          : lowerName.endsWith('.heif') ? 'image/heif'
          : lowerName.endsWith('.png') ? 'image/png'
          : lowerName.endsWith('.webp') ? 'image/webp'
          : 'image/jpeg';
        file = new File([rawFile], rawFile.name || `receipt-${Date.now()}-${i}.jpg`, { type: imageType });
      }

      let preview: string | null = null;
      let finalFile = file;
      try {
        if (isPdf) {
          // Convert PDF to image so it can be displayed in the report PDF
          const pdfImages = await convertPdfToImages(file);
          if (pdfImages.length > 0) {
            finalFile = pdfImages[0]; // Use the image version for storage
            preview = await blobToOrientedImageDataUrl(pdfImages[0], { maxSize: 600, quality: 0.7 });
          } else {
            preview = 'pdf';
          }
        } else {
          preview = await fileToPreview(file);
        }
      } catch {
        // preview generation failed - still add the file
        if (isPdf) preview = 'pdf';
      }

      newDocs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
        file: finalFile,
        preview,
        paymentMethod: null,
        analyzed: false,
        analyzing: true,
        amount: null,
        amountIls: null,
        currency: 'ILS',
        description: file.name,
        category: 'miscellaneous',
        expenseDate: startDate,
        error: null,
      });
    }

    if (newDocs.length === 0) {
      toast({
        title: 'סוג קובץ לא נתמך',
        description: 'אפשר להעלות רק תמונות או PDF',
        variant: 'destructive',
      });
      return;
    }

    const optimisticData = {
      ...dataRef.current,
      [target]: [...dataRef.current[target], ...newDocs],
    } as WizardData;
    dataRef.current = optimisticData;
    setData(optimisticData);

    // Show toast confirmation on mobile
    toast({ title: `${newDocs.length} קבצים נוספו`, description: 'מנתח...' });

    if (skippedUnsupported > 0) {
      toast({
        title: `${skippedUnsupported} קבצים נדחו`,
        description: 'נתמכים רק תמונות או PDF',
      });
    }

    // Auto-save draft immediately so files are persisted even if user leaves.
    // Await the first save to avoid concurrent draft creation on fast mobile captures.
    try {
      await saveDraftToDb(optimisticData);
    } catch {}

    newDocs.forEach(async (doc) => {
      const result = await analyzeFile(doc, destination, startDate);
      const analyzedData = {
        ...dataRef.current,
        [target]: dataRef.current[target].map(d => d.id === doc.id ? { ...d, ...result } : d),
      } as WizardData;
      dataRef.current = analyzedData;
      setData(analyzedData);
      // Persist analyzed result to DB draft
      saveDraftToDb(analyzedData).catch(() => {});
    });
  }, [toast, user, draftReportId, usdToIls]);

  const setPaymentMethod = (docId: string, method: PaymentMethod, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    setData(prev => ({
      ...prev,
      [target]: prev[target].map(d => d.id === docId ? { ...d, paymentMethod: method } : d),
    }));
  };

  const removeDoc = async (docId: string, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    const doc = data[target].find(d => d.id === docId);
    // If this is an existing expense from DB, delete it
    if (doc?.existingExpenseId) {
      await supabase.from('receipts').delete().eq('expense_id', doc.existingExpenseId);
      await supabase.from('expenses').delete().eq('id', doc.existingExpenseId);
    }
    setData(prev => ({ ...prev, [target]: prev[target].filter(d => d.id !== docId) }));
  };

  const setDocCategory = (docId: string, category: string, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    setData(prev => ({
      ...prev,
      [target]: prev[target].map(d => d.id === docId ? { ...d, category } : d),
    }));
  };

  // ──── Step validation ────
  const isStepComplete = (s: number): boolean => {
    if (s === 0) return !!(data.tripStartDate && data.tripEndDate && data.tripDestination && data.tripPurpose);
    if (s === 1) {
      // Step 1 is optional – user may have no receipts (e.g. allowance-only report)
      if (data.docs.length === 0) return true;
      const allHavePayment = data.docs.every(d => d.paymentMethod !== null);
      return allHavePayment;
    }
    if (s === 2) return data.addAllowance !== null;
    if (s === 3) return data.addFlights !== null;
    if (s === 4) return data.addAccommodation !== null;
    return true;
  };
  const canProceed = () => isStepComplete(step);

  // ──── Navigate to step (with auto-save draft) ────
  const goToStep = async (targetStep: number) => {
    // Save draft to DB on first forward navigation from step 0
    if (step === 0 && targetStep > 0 && !draftReportId && isStepComplete(0)) {
      await saveDraftToDb();
    }
    // Save draft on any forward step
    if (targetStep > step && draftReportId) {
      saveDraftToDb();
    }
    setStep(targetStep);
  };

  // ──── Check manager for organizational users ────
  const checkManagerBeforeFinish = async () => {
    if (isIndependent) {
      await performFinish('closed');
      return;
    }
    // Organizational user: check if has manager
    if (!user) return;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_manager, manager_id')
      .eq('id', user.id)
      .single();

    const hasManager = !!profileData?.manager_id;
    const isManagerUser = !!profileData?.is_manager;

    if (!isManagerUser && hasManager) {
      // Load manager info and show dialog
      const { data: mgr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', profileData.manager_id)
        .single();
      if (mgr) {
        setManagerInfo({ id: mgr.id, name: mgr.full_name || 'מנהל', email: mgr.email || '' });
        setShowManagerDialog(true);
        return;
      }
    }
    // Manager or no manager → close directly
    await performFinish('closed');
  };

  // ──── Final save ────
  const handleFinish = async () => {
    await checkManagerBeforeFinish();
  };

  const handleManagerApprovalConfirm = async () => {
    setShowManagerDialog(false);
    await performFinish('pending_approval');
  };

  const performFinish = async (finalStatus: 'closed' | 'pending_approval') => {
    if (!user) return;
    setSaving(true);

    try {
      const allowanceIls = data.addAllowance ? allowanceTotalIls : 0;
      const docsTotal = data.docs.reduce((s, d) => s + (d.amountIls || 0), 0);
      const totalIls = docsTotal + allowanceIls + data.flightTotal + data.accommodationTotal;
      const isPending = finalStatus === 'pending_approval';

      let reportId = draftReportId;

      const reportPayload = {
        trip_start_date: data.tripStartDate,
        trip_end_date: data.tripEndDate,
        trip_destination: data.tripDestination,
        trip_purpose: data.tripPurpose,
        status: finalStatus,
        total_amount_ils: totalIls,
        daily_allowance: data.addAllowance ? data.dailyAllowance : null,
        allowance_days: data.addAllowance ? data.allowanceDays : null,
        submitted_at: new Date().toISOString(),
        ...(finalStatus === 'closed' ? { approved_at: new Date().toISOString(), approved_by: user.id } : {}),
      };

      if (draftReportId) {
        const { error: updateError } = await supabase
          .from('reports')
          .update(reportPayload)
          .eq('id', draftReportId);
        if (updateError) throw updateError;
      } else {
        const { data: report, error: reportError } = await supabase
          .from('reports')
          .insert({ user_id: user.id, ...reportPayload })
          .select()
          .single();
        if (reportError) throw reportError;
        reportId = report.id;
      }

      if (!reportId) throw new Error('No report ID');
      const report = { id: reportId };

      const allDocs = [
        ...data.docs.map(d => ({ ...d, docType: 'expense' as const })),
        ...data.flightDocs.map(d => ({ ...d, docType: 'flight' as const })),
        ...data.accommodationDocs.map(d => ({ ...d, docType: 'accommodation' as const })),
      ];

      for (const doc of allDocs) {
        if (!doc.paymentMethod) continue;
        if (doc.existingExpenseId) continue;

        const category = doc.docType === 'flight' ? 'flights'
          : doc.docType === 'accommodation' ? 'accommodation'
          : doc.category || 'other';

        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            report_id: report.id,
            expense_date: doc.expenseDate || data.tripStartDate,
            category: category as any,
            amount: doc.amount || 0,
            currency: (doc.currency || 'ILS') as any,
            amount_in_ils: doc.amountIls || doc.amount || 0,
            description: doc.description || doc.file.name,
            payment_method: doc.paymentMethod as any,
            approval_status: isPending ? 'pending' : 'approved' as any,
          } as any)
          .select()
          .single();

        if (expenseError) { console.error('Expense error:', expenseError); continue; }

        try {
          const isImageFile = doc.file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file.name);
          const ext = isImageFile ? doc.file.name.split('.').pop() : 'jpg';
          const filePath = `${user.id}/${report.id}/${expense.id}.${ext}`;
          const { error: storageError } = await supabase.storage
            .from('receipts')
            .upload(filePath, doc.file, { upsert: true });

          if (!storageError) {
            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
            await supabase.from('receipts').insert({
              expense_id: expense.id,
              file_name: doc.file.name,
              file_size: doc.file.size,
              file_type: 'image' as any,
              file_url: urlData.publicUrl,
            });
          }
        } catch (e) { console.error('Storage upload error:', e); }
      }

      if (data.addAllowance && allowanceIls > 0) {
        await supabase.from('expenses')
          .delete()
          .eq('report_id', report.id)
          .like('description', 'ימי שהייה:%');

        await supabase.from('expenses').insert({
          report_id: report.id,
          expense_date: data.tripStartDate,
          category: 'other' as any,
          amount: allowanceTotalUsd,
          currency: 'USD' as any,
          amount_in_ils: allowanceIls,
          description: `ימי שהייה: ${data.allowanceDays} ימים x $${data.dailyAllowance} (שער ${usdToIls.toFixed(2)})`,
          payment_method: 'out_of_pocket' as any,
          approval_status: isPending ? 'pending' : 'approved' as any,
        } as any);
      }

      // Create history record
      await supabase.from('report_history').insert({
        report_id: report.id,
        action: isPending ? 'submitted' : 'approved',
        performed_by: user.id,
        notes: isPending ? 'הדוח נשלח לאישור מנהל' : 'הדוח סגור והופק',
      });

      // If pending, send manager approval request
      if (isPending && managerInfo) {
        try {
          const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
          await supabase.functions.invoke('request-report-approval', {
            body: {
              reportId: report.id,
              managerEmail: managerInfo.email,
              managerName: managerInfo.name,
              employeeName: profileData?.full_name || '',
              reportDetails: {
                destination: data.tripDestination,
                startDate: data.tripStartDate,
                endDate: data.tripEndDate,
                purpose: data.tripPurpose,
                totalAmount: totalIls,
              },
            },
          });
        } catch (e) { console.error('Manager notification error:', e); }
      }

      // Send to accounting if closed (non-independent)
      if (finalStatus === 'closed' && !isIndependent) {
        try {
          const { data: profileData } = await supabase.from('profiles')
            .select('accounting_manager_email, username')
            .eq('id', user.id)
            .single();
          if (profileData?.accounting_manager_email) {
            supabase.functions.invoke('send-accounting-report', {
              body: { reportId: report.id, accountingEmail: profileData.accounting_manager_email },
            }).catch(() => {});
          }
        } catch (e) { console.error('Accounting email error:', e); }
      }

      localStorage.removeItem(DRAFT_KEY);
      toast({
        title: isPending ? 'הדוח נשלח לאישור מנהל' : 'הדוח נוצר בהצלחה!',
        description: isPending ? 'הדוח נשלח למנהל האחראי לאישור' : 'הדוח הושלם וניתן לצפות בו',
      });
      navigate(`/reports/${reportId}`);
    } catch (error) {
      console.error('Error creating report:', error);
      toast({ title: 'שגיאה', description: 'לא ניתן ליצור את הדוח', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ──── DocCard – mobile-optimized ────
  const DocCard = ({ doc, target }: { doc: UploadedDoc; target: 'docs' | 'flightDocs' | 'accommodationDocs' }) => (
    <div className="relative rounded-xl border bg-card overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
      {/* Delete button – always visible on mobile */}
      <button
        className="absolute top-1.5 left-1.5 z-10 bg-destructive/90 text-destructive-foreground rounded-full p-1 shadow-md"
        onClick={() => removeDoc(doc.id, target)}
        aria-label="הסר"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Preview – compact */}
      {doc.preview && doc.preview !== 'pdf' ? (
        <img src={doc.preview} alt="preview" className="w-full h-20 sm:h-24 object-cover" />
      ) : (
        <div className="w-full h-20 sm:h-24 bg-muted flex items-center justify-center">
          <FileText className="w-7 h-7 text-muted-foreground" />
          {doc.preview === 'pdf' && <span className="text-xs text-muted-foreground mt-1">PDF</span>}
        </div>
      )}

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        {/* Analysis status */}
        {doc.analyzing ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>מנתח...</span>
          </div>
        ) : doc.error ? (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{doc.error}</span>
          </div>
        ) : doc.analyzed ? (
          <>
            {doc.amount ? (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {doc.currency} {doc.amount?.toFixed(2)}
              </p>
            ) : null}

            {/* Category badge with dropdown */}
            <div className="relative">
              <select
                value={doc.category}
                onChange={(e) => setDocCategory(doc.id, e.target.value, target)}
                className="w-full appearance-none text-[11px] font-medium py-1.5 px-2.5 pr-6 rounded-lg border cursor-pointer transition-colors bg-accent/50 border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat].emoji} {CATEGORY_CONFIG[cat].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          </>
        ) : null}

        <p className="text-[11px] text-muted-foreground truncate">{doc.description || doc.file.name}</p>

        {/* Payment method – large touch targets */}
        {!doc.analyzing && !doc.paymentMethod && (
          <div className="flex gap-1.5 pt-1">
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 active:bg-emerald-100"
              onClick={() => setPaymentMethod(doc.id, 'out_of_pocket', target)}
            >
              <Wallet className="w-3.5 h-3.5 inline-block ml-0.5" /> מכיסי
            </button>
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 active:bg-blue-100"
              onClick={() => setPaymentMethod(doc.id, 'company_card', target)}
            >
              <Building2 className="w-3.5 h-3.5 inline-block ml-0.5" /> חברה
            </button>
          </div>
        )}

        {doc.paymentMethod && (
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {doc.paymentMethod === 'out_of_pocket' ? <><Wallet className="w-3 h-3 inline-block ml-0.5" /> מכיסי</> : <><Building2 className="w-3 h-3 inline-block ml-0.5" /> חברה</>}
              </span>
            </div>
            <button
              className="text-[11px] text-muted-foreground underline py-1 px-1"
              onClick={() => setPaymentMethod(doc.id, null as any, target)}
            >
              שנה
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ──── Step indicators – free navigation with progress line ────
  const StepIndicator = () => (
    <div className="flex items-center justify-between px-1">
      {STEP_LABELS.map((label, i) => {
        const Icon = STEP_ICONS[i];
        const isActive = i === step;
        const isDone = i < step;
        const isComplete = isStepComplete(i);
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => goToStep(i)}
              className={`relative flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                isActive ? 'scale-105' : ''
              }`}
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                isActive
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200/60 dark:shadow-emerald-900/40'
                  : isDone
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : isComplete
                  ? 'bg-muted border-emerald-300 dark:border-emerald-700 text-emerald-500'
                  : 'bg-muted border-muted-foreground/20 text-muted-foreground'
              }`}>
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-medium max-w-[52px] text-center leading-tight ${
                isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </button>
            {/* Connector line */}
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                i < step
                  ? 'bg-emerald-400 dark:bg-emerald-600'
                  : 'bg-muted-foreground/15'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ──── Upload zone component ────
  const UploadZone = ({ target, inputRef, pdfInputRef, color = 'emerald', label = 'העלה תמונות' }: {
    target: 'docs' | 'flightDocs' | 'accommodationDocs';
    inputRef: React.RefObject<HTMLInputElement>;
    pdfInputRef: React.RefObject<HTMLInputElement>;
    color?: string;
    label?: string;
  }) => (
    <div className="flex gap-2">
      <button
        className={`flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 px-3 transition-colors active:scale-[0.98] border-${color}-300 dark:border-${color}-700 hover:bg-${color}-50/50`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className={`w-5 h-5 text-${color}-500`} />
        <span className={`text-sm font-medium text-${color}-700 dark:text-${color}-300`}>{label}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => { e.target.files && handleFilesAdded(e.target.files, target); e.target.value = ''; }}
        />
      </button>

      <button
        className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 px-3 transition-colors active:scale-[0.98] border-${color}-300 dark:border-${color}-700 hover:bg-${color}-50/50`}
        onClick={() => pdfInputRef.current?.click()}
      >
        <FileText className={`w-5 h-5 text-${color}-500`} />
        <span className={`text-sm font-medium text-${color}-700 dark:text-${color}-300`}>PDF</span>
        <input
          ref={pdfInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => { e.target.files && handleFilesAdded(e.target.files, target); e.target.value = ''; }}
        />
      </button>

      {target === 'docs' && (
        <button
          className="flex items-center justify-center gap-1 border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl px-4 py-4 hover:bg-emerald-50/50 active:scale-[0.98] transition-colors"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="w-5 h-5 text-emerald-500" />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { e.target.files && handleFilesAdded(e.target.files, 'docs'); e.target.value = ''; }}
          />
        </button>
      )}
    </div>
  );

  // ──── Steps ────
  const steps = [
    // Step 0: Trip details
    <div className="space-y-4" key="step0">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate" className="text-sm">תאריך יציאה *</Label>
          <Input
            id="startDate"
            type="date"
            className="h-12 text-base"
            value={data.tripStartDate}
            onChange={e => setData(p => ({ ...p, tripStartDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate" className="text-sm">תאריך חזרה *</Label>
          <Input
            id="endDate"
            type="date"
            className="h-12 text-base"
            min={data.tripStartDate}
            value={data.tripEndDate}
            onChange={e => setData(p => ({ ...p, tripEndDate: e.target.value }))}
          />
        </div>
      </div>
      {tripDays > 0 && (
        <div className="text-sm text-center bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-3 py-2.5 rounded-xl font-medium">
          🗓️ משך הנסיעה: {tripDays} ימים
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="dest" className="text-sm">יעד הנסיעה *</Label>
        <Input
          id="dest"
          className="h-12 text-base"
          placeholder="לדוגמה: ניו יורק, ארה״ב"
          value={data.tripDestination}
          onChange={e => setData(p => ({ ...p, tripDestination: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="purpose" className="text-sm">מטרת הנסיעה *</Label>
        <Input
          id="purpose"
          className="h-12 text-base"
          placeholder="לדוגמה: כנס מקצועי"
          value={data.tripPurpose}
          onChange={e => setData(p => ({ ...p, tripPurpose: e.target.value }))}
        />
      </div>
    </div>,

    // Step 1: Upload docs
    <div className="space-y-3" key="step1">
      <p className="text-xs text-muted-foreground text-center">
        עד 10 קבצים בכל העלאה · ללא הגבלה על סה״כ
      </p>

      {UploadZone({ target: 'docs', inputRef: fileInputRef, pdfInputRef: pdfInputRef, label: 'העלה תמונות' })}

      {data.docs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {data.docs.map(doc => <DocCard key={doc.id} doc={doc} target="docs" />)}
          </div>

          {/* Add more button */}
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-sm hover:border-emerald-300 hover:text-emerald-600 transition-colors active:scale-[0.98]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-4 h-4" />
            הוסף עוד חשבוניות
          </button>

          {/* Summary bar */}
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-4 py-3">
            <span className="text-sm text-muted-foreground">{data.docs.length} קבצים</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              ₪{data.docs.reduce((s, d) => s + (d.amountIls || 0), 0).toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>,

    // Step 2: Daily allowance
    <div className="space-y-4" key="step2">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
          <Sun className="w-8 h-8 text-amber-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold text-lg">ימי שהייה</h3>
      <p className="text-center text-sm text-muted-foreground px-2">
        סכום יומי קבוע שמגיע לך עבור כל יום בנסיעה
      </p>
      <div className="flex gap-3 justify-center">
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addAllowance === true
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addAllowance: true, allowanceDays: tripDays }))}
        >
          <CheckCircle2 className="w-4 h-4 inline-block ml-1" /> כן, הוסף
        </button>
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addAllowance === false
              ? 'bg-muted-foreground text-background shadow-lg'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addAllowance: false }))}
        >
          לא
        </button>
      </div>

      {data.addAllowance && (
        <div className="space-y-3 border rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="allowDays" className="text-sm">מספר ימים</Label>
              <Input
                id="allowDays"
                type="number"
                className="h-12 text-base text-center"
                min={1}
                value={data.allowanceDays}
                onChange={e => setData(p => ({ ...p, allowanceDays: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily" className="text-sm">תשלום יומי ($)</Label>
              <Input
                id="daily"
                type="number"
                className="h-12 text-base text-center"
                min={0}
                value={data.dailyAllowance}
                onChange={e => setData(p => ({ ...p, dailyAllowance: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">סה"כ ימי שהייה</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              ${allowanceTotalUsd.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ ₪{allowanceTotalIls.toLocaleString()} (שער {usdToIls.toFixed(2)})
            </p>
          </div>
        </div>
      )}
    </div>,

    // Step 3: Flights
    <div className="space-y-4" key="step3">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
          <Plane className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold text-lg">כרטיסי טיסה</h3>
      <div className="flex gap-3 justify-center">
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addFlights === true
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/50'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addFlights: true }))}
        >
          <Plane className="w-4 h-4 inline-block ml-1" /> כן
        </button>
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addFlights === false
              ? 'bg-muted-foreground text-background shadow-lg'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addFlights: false }))}
        >
          לא
        </button>
      </div>

      {data.addFlights && (
        <div className="space-y-3">
          {UploadZone({ target: 'flightDocs', inputRef: flightInputRef, pdfInputRef: flightPdfInputRef, color: 'blue', label: 'העלה תמונות טיסה' })}

          {data.flightDocs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {data.flightDocs.map(doc => <DocCard key={doc.id} doc={doc} target="flightDocs" />)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="flightTotal" className="text-sm">סה"כ עלות טיסות (₪)</Label>
            <Input
              id="flightTotal"
              type="number"
              className="h-12 text-base"
              min={0}
              placeholder="0"
              value={data.flightTotal || ''}
              onChange={e => setData(p => ({ ...p, flightTotal: Number(e.target.value) }))}
            />
            {data.flightDocs.some(d => d.amountIls) && (
              <p className="text-xs text-muted-foreground">
                סכום מנותח: ₪{data.flightDocs.reduce((s, d) => s + (d.amountIls || 0), 0).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>,

    // Step 4: Accommodation
    <div className="space-y-4" key="step4">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
          <Hotel className="w-8 h-8 text-purple-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold text-lg">לינה</h3>
      <p className="text-center text-sm text-muted-foreground">הוצאות לינה שלא הוספת עדיין</p>
      <div className="flex gap-3 justify-center">
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addAccommodation === true
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-purple-900/50'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addAccommodation: true }))}
        >
          <Hotel className="w-4 h-4 inline-block ml-1" /> כן
        </button>
        <button
          className={`flex-1 max-w-[140px] py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            data.addAccommodation === false
              ? 'bg-muted-foreground text-background shadow-lg'
              : 'bg-muted text-foreground'
          }`}
          onClick={() => setData(p => ({ ...p, addAccommodation: false }))}
        >
          לא
        </button>
      </div>

      {data.addAccommodation && (
        <div className="space-y-3">
          {UploadZone({ target: 'accommodationDocs', inputRef: accommodationInputRef, pdfInputRef: accommodationPdfInputRef, color: 'purple', label: 'העלה תמונות לינה' })}

          {data.accommodationDocs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {data.accommodationDocs.map(doc => <DocCard key={doc.id} doc={doc} target="accommodationDocs" />)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="accTotal" className="text-sm">סה"כ עלות לינה (₪)</Label>
            <Input
              id="accTotal"
              type="number"
              className="h-12 text-base"
              min={0}
              placeholder="0"
              value={data.accommodationTotal || ''}
              onChange={e => setData(p => ({ ...p, accommodationTotal: Number(e.target.value) }))}
            />
          </div>
        </div>
      )}
    </div>,

    // Step 5: Summary
    <div className="space-y-4" key="step5">
      <div className="text-center mb-2">
        <div className="inline-flex w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl items-center justify-center mb-2">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="font-bold text-lg">סיכום הדוח</h3>
      </div>

      {/* Trip info */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><Globe className="w-4 h-4" /> יעד</span>
          <span className="font-medium">{data.tripDestination}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4" /> תאריכים</span>
          <span className="font-medium text-xs">
            {data.tripStartDate && format(new Date(data.tripStartDate), 'dd/MM/yy', { locale: he })} –{' '}
            {data.tripEndDate && format(new Date(data.tripEndDate), 'dd/MM/yy', { locale: he })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><Target className="w-4 h-4" /> מטרה</span>
          <span className="font-medium text-xs">{data.tripPurpose}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        {data.docs.length > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">
              <Receipt className="w-3.5 h-3.5 inline ml-1" />
              חשבוניות ({data.docs.length})
            </span>
            <span className="font-medium">₪{data.docs.reduce((s, d) => s + (d.amountIls || 0), 0).toFixed(2)}</span>
          </div>
        )}
        {data.addAllowance && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">
              <Sun className="w-3.5 h-3.5 inline ml-1" />
              ימי שהייה ({data.allowanceDays}×${data.dailyAllowance})
            </span>
            <span className="font-medium">₪{allowanceTotalIls.toLocaleString()}</span>
          </div>
        )}
        {data.addFlights && data.flightTotal > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">
              <Plane className="w-3.5 h-3.5 inline ml-1" />
              טיסות
            </span>
            <span className="font-medium">₪{data.flightTotal.toLocaleString()}</span>
          </div>
        )}
        {data.addAccommodation && data.accommodationTotal > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">
              <Hotel className="w-3.5 h-3.5 inline ml-1" />
              לינה
            </span>
            <span className="font-medium">₪{data.accommodationTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t pt-3 mt-2">
          <div className="flex justify-between items-center">
            <span className="font-bold">סה"כ לתשלום</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ₪{(
                data.docs.reduce((s, d) => s + (d.amountIls || 0), 0) +
                (data.addAllowance ? allowanceTotalIls : 0) +
                (data.addFlights ? data.flightTotal : 0) +
                (data.addAccommodation ? data.accommodationTotal : 0)
              ).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment split */}
      {(() => {
        const allDocs = [...data.docs, ...data.flightDocs, ...data.accommodationDocs];
        const pocket = allDocs.filter(d => d.paymentMethod === 'out_of_pocket').reduce((s, d) => s + (d.amountIls || 0), 0);
        const company = allDocs.filter(d => d.paymentMethod === 'company_card').reduce((s, d) => s + (d.amountIls || 0), 0);
        if (pocket === 0 && company === 0) return null;
        return (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Wallet className="w-3 h-3" /> מכיסי (להחזר)</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">₪{pocket.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Building2 className="w-3 h-3" /> חברה</p>
              <p className="font-bold text-blue-700 dark:text-blue-400">₪{company.toFixed(2)}</p>
            </div>
          </div>
        );
      })()}
    </div>,
  ];

  // ──── Render ────
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b safe-top">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="px-3 py-2.5 flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground py-1 px-1"
            onClick={() => {
              if (step === 0) {
                navigate(isIndependent ? '/independent' : '/dashboard');
              } else {
                goToStep(step - 1);
              }
            }}
          >
            <ArrowRight className="w-4 h-4" />
            <span>חזרה</span>
          </button>
          <h1 className="text-sm font-bold">
            {draftReportId ? '✏️ טיוטא' : 'דוח הוצאות חדש'}
          </h1>
          <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
            {step + 1}/{STEP_LABELS.length}
          </span>
        </div>
        {/* Step navigation */}
        <div className="px-3 pb-2.5">
          <StepIndicator />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 pt-4 pb-32 max-w-lg mx-auto">
        <Card className="border-0 shadow-md bg-card/95 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5">
            {steps[step]}
          </CardContent>
        </Card>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t safe-bottom z-50">
        <div className="px-3 py-3 max-w-lg mx-auto flex gap-2">
          {/* Back button */}
          {step > 0 && (
            <Button
              variant="outline"
              className="h-13 px-4 rounded-xl text-sm font-medium"
              onClick={() => goToStep(step - 1)}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {step < STEP_LABELS.length - 1 ? (
            <Button
              className="flex-1 h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 active:scale-[0.98] transition-transform"
              disabled={!canProceed()}
              onClick={() => goToStep(step + 1)}
            >
              המשך
              <ArrowLeft className="w-5 h-5 mr-2" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 active:scale-[0.98] transition-transform"
              disabled={saving}
              onClick={handleFinish}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  יוצר דוח...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 ml-2" />
                  סגור והפק דוח
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Manager Approval Dialog */}
      <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Send className="w-5 h-5 text-primary" />
              שליחת דוח לאישור מנהל
            </DialogTitle>
            <DialogDescription>
              הדוח יישלח לאישור המנהל שלך לפני הגשה סופית
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {managerInfo && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{managerInfo.name}</p>
                    <p className="text-sm text-muted-foreground">{managerInfo.email}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground">סיכום הדוח</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">יעד:</span>
                  <span className="font-medium">{data.tripDestination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סה״כ:</span>
                  <span className="font-bold text-primary">
                    ₪{(
                      data.docs.reduce((s, d) => s + (d.amountIls || 0), 0) +
                      (data.addAllowance ? allowanceTotalIls : 0) +
                      (data.addFlights ? data.flightTotal : 0) +
                      (data.addAccommodation ? data.accommodationTotal : 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowManagerDialog(false)} className="gap-2">
              חזור לעריכה
            </Button>
            <Button
              onClick={handleManagerApprovalConfirm}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
              ) : (
                <><Send className="w-4 h-4" /> שלח לאישור</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
