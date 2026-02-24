import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowRight, ArrowLeft, Upload, X, CheckCircle2, AlertCircle,
  Plane, Hotel, Sun, FileText, Loader2, Receipt, Camera, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { blobToOrientedImageDataUrl } from '@/utils/imageDataUrl';

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
}

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

const STEP_ICONS = [FileText, Upload, Sun, Plane, Hotel, CheckCircle2];
const STEP_LABELS = [
  'פרטי הנסיעה',
  'חשבוניות',
  'ימי שהייה',
  'טיסות',
  'לינה',
  'סיכום',
];

const DEFAULT_DAILY_ALLOWANCE = 260;

// ──────────────── Component ────────────────
export default function IndependentNewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const flightInputRef = useRef<HTMLInputElement>(null);
  const accommodationInputRef = useRef<HTMLInputElement>(null);

  const tripDays = data.tripStartDate && data.tripEndDate
    ? Math.max(1, Math.ceil((new Date(data.tripEndDate).getTime() - new Date(data.tripStartDate).getTime()) / 86400000) + 1)
    : 0;

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
    return null;
  };

  const analyzeFile = async (doc: UploadedDoc, tripDestination: string, tripStartDate: string): Promise<Partial<UploadedDoc>> => {
    const isImage = doc.file.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file.name);
    if (!isImage) {
      return { analyzed: true, analyzing: false, description: doc.file.name };
    }

    try {
      // Use oriented & compressed data URI for analysis (max 1800px)
      const dataUri = await blobToOrientedImageDataUrl(doc.file, { maxSize: 1800, quality: 0.85 });

      const { data: fnData, error } = await supabase.functions.invoke('analyze-receipt', {
        body: {
          imageBase64: dataUri,
          mimeType: doc.file.type || 'image/jpeg',
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
    const allowedCount = Math.min(files.length, maxPerBatch);
    if (allowedCount <= 0) return;

    const destination = data.tripDestination;
    const startDate = data.tripStartDate;

    const newDocs: UploadedDoc[] = [];
    for (let i = 0; i < allowedCount; i++) {
      const file = files[i];
      let preview: string | null = null;
      try {
        preview = await fileToPreview(file);
      } catch {
        // preview generation failed - still add the file
      }
      newDocs.push({
        id: `${Date.now()}-${i}`,
        file,
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

    setData(prev => ({ ...prev, [target]: [...prev[target], ...newDocs] }));

    // Show toast confirmation on mobile
    toast({ title: `${newDocs.length} קבצים נוספו`, description: 'מנתח...' });

    newDocs.forEach(async (doc) => {
      const result = await analyzeFile(doc, destination, startDate);
      setData(prev => ({
        ...prev,
        [target]: prev[target].map(d => d.id === doc.id ? { ...d, ...result } : d),
      }));
    });
  }, [data, toast]);

  const setPaymentMethod = (docId: string, method: PaymentMethod, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    setData(prev => ({
      ...prev,
      [target]: prev[target].map(d => d.id === docId ? { ...d, paymentMethod: method } : d),
    }));
  };

  const removeDoc = (docId: string, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    setData(prev => ({ ...prev, [target]: prev[target].filter(d => d.id !== docId) }));
  };

  // ──── Step validation ────
  const canProceed = (): boolean => {
    if (step === 0) return !!(data.tripStartDate && data.tripEndDate && data.tripDestination && data.tripPurpose);
    if (step === 1) {
      const allHavePayment = data.docs.every(d => d.paymentMethod !== null);
      return data.docs.length > 0 && allHavePayment;
    }
    if (step === 2) return data.addAllowance !== null;
    if (step === 3) return data.addFlights !== null;
    if (step === 4) return data.addAccommodation !== null;
    return true;
  };

  // ──── Final save ────
  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const allowanceTotal = data.addAllowance
        ? data.allowanceDays * data.dailyAllowance
        : 0;

      const docsTotal = data.docs.reduce((s, d) => s + (d.amountIls || 0), 0);
      const totalIls = docsTotal + allowanceTotal + data.flightTotal + data.accommodationTotal;

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          trip_start_date: data.tripStartDate,
          trip_end_date: data.tripEndDate,
          trip_destination: data.tripDestination,
          trip_purpose: data.tripPurpose,
          status: 'closed',
          total_amount_ils: totalIls,
          daily_allowance: data.addAllowance ? data.dailyAllowance : null,
          allowance_days: data.addAllowance ? data.allowanceDays : null,
          submitted_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const allDocs = [
        ...data.docs.map(d => ({ ...d, docType: 'expense' as const })),
        ...data.flightDocs.map(d => ({ ...d, docType: 'flight' as const })),
        ...data.accommodationDocs.map(d => ({ ...d, docType: 'accommodation' as const })),
      ];

      for (const doc of allDocs) {
        if (!doc.paymentMethod) continue;

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
            approval_status: 'approved' as any,
          } as any)
          .select()
          .single();

        if (expenseError) { console.error('Expense error:', expenseError); continue; }

        try {
          const ext = doc.file.name.split('.').pop();
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
              file_type: doc.file.type.startsWith('image/') ? 'image' as any : 'pdf' as any,
              file_url: urlData.publicUrl,
            });
          }
        } catch (e) { console.error('Storage upload error:', e); }
      }

      if (data.addAllowance && allowanceTotal > 0) {
        await supabase.from('expenses').insert({
          report_id: report.id,
          expense_date: data.tripStartDate,
          category: 'other' as any,
          amount: allowanceTotal,
          currency: 'ILS' as any,
          amount_in_ils: allowanceTotal,
          description: `ימי שהייה: ${data.allowanceDays} ימים x ${data.dailyAllowance} ש"ח`,
          payment_method: 'out_of_pocket' as any,
          approval_status: 'approved' as any,
        } as any);
      }

      toast({ title: 'הדוח נוצר בהצלחה!', description: 'הדוח הושלם וניתן לצפות בו' });
      navigate(`/reports/${report.id}`);
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
      {doc.preview ? (
        <img src={doc.preview} alt="preview" className="w-full h-20 sm:h-24 object-cover" />
      ) : (
        <div className="w-full h-20 sm:h-24 bg-muted flex items-center justify-center">
          <FileText className="w-7 h-7 text-muted-foreground" />
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
        ) : doc.amount ? (
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {doc.currency} {doc.amount?.toFixed(2)}
          </p>
        ) : null}

        <p className="text-[11px] text-muted-foreground truncate">{doc.description || doc.file.name}</p>

        {/* Payment method – large touch targets */}
        {!doc.analyzing && !doc.paymentMethod && (
          <div className="flex gap-1.5 pt-1">
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 active:bg-emerald-100"
              onClick={() => setPaymentMethod(doc.id, 'out_of_pocket', target)}
            >
              💰 מכיסי
            </button>
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 active:bg-blue-100"
              onClick={() => setPaymentMethod(doc.id, 'company_card', target)}
            >
              🏢 חברה
            </button>
          </div>
        )}

        {doc.paymentMethod && (
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {doc.paymentMethod === 'out_of_pocket' ? '💰 מכיסי' : '🏢 חברה'}
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

  // ──── Step indicators ────
  const StepIndicator = () => (
    <div className="flex items-center gap-1 sm:gap-2 px-1 overflow-x-auto scrollbar-none">
      {STEP_LABELS.map((label, i) => {
        const Icon = STEP_ICONS[i];
        const isActive = i === step;
        const isDone = i < step;
        return (
          <button
            key={i}
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              isActive
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                : isDone
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 cursor-pointer'
                : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  // ──── Upload zone component ────
  const UploadZone = ({ target, inputRef, color = 'emerald', label = 'העלה חשבוניות' }: {
    target: 'docs' | 'flightDocs' | 'accommodationDocs';
    inputRef: React.RefObject<HTMLInputElement>;
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
          accept="image/*,application/pdf"
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

      <UploadZone target="docs" inputRef={fileInputRef} label="העלה קבצים" />

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
          ✅ כן, הוסף
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
              <Label htmlFor="daily" className="text-sm">תשלום יומי (₪)</Label>
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
          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">סה"כ ימי שהייה</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              ₪{(data.allowanceDays * data.dailyAllowance).toLocaleString()}
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
          ✈️ כן
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
          <UploadZone target="flightDocs" inputRef={flightInputRef} color="blue" label="העלה כרטיסי טיסה" />

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
          🏨 כן
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
          <UploadZone target="accommodationDocs" inputRef={accommodationInputRef} color="purple" label="העלה קבלות לינה" />

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
          <span className="text-muted-foreground">🌍 יעד</span>
          <span className="font-medium">{data.tripDestination}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">📅 תאריכים</span>
          <span className="font-medium text-xs">
            {data.tripStartDate && format(new Date(data.tripStartDate), 'dd/MM/yy', { locale: he })} –{' '}
            {data.tripEndDate && format(new Date(data.tripEndDate), 'dd/MM/yy', { locale: he })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">🎯 מטרה</span>
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
              ימי שהייה ({data.allowanceDays}×₪{data.dailyAllowance})
            </span>
            <span className="font-medium">₪{(data.allowanceDays * data.dailyAllowance).toLocaleString()}</span>
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
                (data.addAllowance ? data.allowanceDays * data.dailyAllowance : 0) +
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
              <p className="text-[11px] text-muted-foreground">💰 מכיסי (להחזר)</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">₪{pocket.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground">🏢 חברה</p>
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
            onClick={() => step === 0 ? navigate('/independent') : setStep(s => s - 1)}
          >
            <ArrowRight className="w-4 h-4" />
            <span>{step === 0 ? 'חזרה' : 'חזרה'}</span>
          </button>
          <h1 className="text-sm font-bold">דוח הוצאות חדש</h1>
          <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
            {step + 1}/{STEP_LABELS.length}
          </span>
        </div>
        {/* Step chips */}
        <div className="px-3 pb-2.5">
          <StepIndicator />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 pt-4 pb-28 max-w-lg mx-auto">
        <Card className="border-0 shadow-md bg-card/95 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5">
            {steps[step]}
          </CardContent>
        </Card>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t safe-bottom z-50">
        <div className="px-3 py-3 max-w-lg mx-auto">
          {step < STEP_LABELS.length - 1 ? (
            <Button
              className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 active:scale-[0.98] transition-transform"
              disabled={!canProceed()}
              onClick={() => setStep(s => s + 1)}
            >
              המשך
              <ArrowLeft className="w-5 h-5 mr-2" />
            </Button>
          ) : (
            <Button
              className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 active:scale-[0.98] transition-transform"
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
    </div>
  );
}
