import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowRight, ArrowLeft, Upload, X, CheckCircle2, AlertCircle,
  Plane, Hotel, Sun, FileText, Loader2, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

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
  // Step 2 – docs
  docs: UploadedDoc[];
  // Step 3 – daily allowance
  addAllowance: boolean | null;
  allowanceDays: number;
  dailyAllowance: number;
  // Step 4 – flights
  addFlights: boolean | null;
  flightDocs: UploadedDoc[];
  flightTotal: number;
  // Step 5 – accommodation
  addAccommodation: boolean | null;
  accommodationDocs: UploadedDoc[];
  accommodationTotal: number;
}

const STEP_LABELS = [
  'פרטי הנסיעה',
  'העלאת חשבוניות',
  'ימי שהייה',
  'כרטיסי טיסה',
  'לינה',
  'סיכום וסגירה',
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
  const flightInputRef = useRef<HTMLInputElement>(null);
  const accommodationInputRef = useRef<HTMLInputElement>(null);

  // Compute trip days from dates
  const tripDays = data.tripStartDate && data.tripEndDate
    ? Math.max(1, Math.ceil((new Date(data.tripEndDate).getTime() - new Date(data.tripStartDate).getTime()) / 86400000) + 1)
    : 0;

  // ──── File helpers ────
  const fileToPreview = async (file: File): Promise<string | null> => {
    if (file.type.startsWith('image/')) {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    return null;
  };

  const analyzeFile = async (doc: UploadedDoc): Promise<Partial<UploadedDoc>> => {
    // Only analyze image files - skip PDFs and other non-image types
    const isImage = doc.file.type.startsWith('image/');
    if (!isImage) {
      return {
        analyzed: true,
        analyzing: false,
        description: doc.file.name,
      };
    }

    try {
      // Send full data URI (with prefix) so edge function can validate the mime type
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(doc.file);
      });

      const { data: fnData, error } = await supabase.functions.invoke('analyze-receipt', {
        body: {
          imageBase64: dataUri,
          mimeType: doc.file.type,
          fileName: doc.file.name,
          tripDestination: data.tripDestination,
        },
      });

      if (error) throw error;

      // Edge function returns { data: { date, amount, currency, category, description } }
      const result = fnData?.data || fnData?.result || {};
      return {
        analyzed: true,
        analyzing: false,
        amount: result.amount || null,
        amountIls: result.amount_in_ils || null,
        currency: result.currency || 'ILS',
        description: result.description || doc.file.name,
        category: result.category || 'other',
        expenseDate: result.date || data.tripStartDate,
      };
    } catch {
      return {
        analyzed: true,
        analyzing: false,
        error: 'לא ניתן לנתח את המסמך',
      };
    }
  };

  const handleFilesAdded = useCallback(async (files: FileList, target: 'docs' | 'flightDocs' | 'accommodationDocs') => {
    const maxFiles = 20;
    const currentCount = data[target].length;
    const allowedCount = Math.min(files.length, maxFiles - currentCount);
    if (allowedCount <= 0) {
      toast({ title: 'מגבלה', description: `ניתן להעלות עד ${maxFiles} קבצים`, variant: 'destructive' });
      return;
    }

    const newDocs: UploadedDoc[] = [];
    for (let i = 0; i < allowedCount; i++) {
      const file = files[i];
      const preview = await fileToPreview(file);
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
        category: 'other',
        expenseDate: data.tripStartDate,
        error: null,
      });
    }

    setData(prev => ({ ...prev, [target]: [...prev[target], ...newDocs] }));

    // Analyze each doc
    newDocs.forEach(async (doc) => {
      const result = await analyzeFile(doc);
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
      // Calculate allowance
      const allowanceTotal = data.addAllowance
        ? data.allowanceDays * data.dailyAllowance
        : 0;

      // Calculate totals
      const docsTotal = data.docs.reduce((s, d) => s + (d.amountIls || 0), 0);
      const totalIls = docsTotal + allowanceTotal + data.flightTotal + data.accommodationTotal;

      // Create report
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

      // Upload docs to storage + create expense records
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

        // Upload file to storage
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

      // Add daily allowance as an expense row if applicable
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

  // ──── Render helpers ────
  const DocCard = ({ doc, target }: { doc: UploadedDoc; target: 'docs' | 'flightDocs' | 'accommodationDocs' }) => (
    <div className="border rounded-xl p-3 bg-white dark:bg-slate-900 relative group">
      <button
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5"
        onClick={() => removeDoc(doc.id, target)}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Preview */}
      {doc.preview ? (
        <img src={doc.preview} alt="preview" className="w-full h-24 object-cover rounded-lg mb-2" />
      ) : (
        <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Analysis status */}
      {doc.analyzing ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          מנתח...
        </div>
      ) : doc.error ? (
        <div className="flex items-center gap-1 text-xs text-destructive mb-2">
          <AlertCircle className="w-3 h-3" />
          {doc.error}
        </div>
      ) : doc.amount ? (
        <div className="text-xs font-medium text-emerald-600 mb-2">
          {doc.currency} {doc.amount?.toFixed(2)} {doc.currency !== 'ILS' && doc.amountIls ? `(₪${doc.amountIls?.toFixed(2)})` : ''}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground truncate mb-2">{doc.file.name}</p>

      {/* Payment method question */}
      {!doc.analyzing && !doc.paymentMethod && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-center">מי שילם?</p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-7 border-emerald-300 hover:bg-emerald-50"
              onClick={() => setPaymentMethod(doc.id, 'out_of_pocket', target)}
            >
              מכיסי
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-7 border-blue-300 hover:bg-blue-50"
              onClick={() => setPaymentMethod(doc.id, 'company_card', target)}
            >
              חברה
            </Button>
          </div>
        </div>
      )}

      {doc.paymentMethod && (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span className="text-xs text-emerald-600">
            {doc.paymentMethod === 'out_of_pocket' ? 'מכיסי' : 'חברה'}
          </span>
          <button className="text-xs text-muted-foreground underline mr-auto" onClick={() => setPaymentMethod(doc.id, null as any, target)}>
            שנה
          </button>
        </div>
      )}
    </div>
  );

  // ──── Steps ────
  const steps = [
    // Step 0: Trip details
    <div className="space-y-4" key="step0">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">תאריך יציאה *</Label>
          <Input
            id="startDate"
            type="date"
            value={data.tripStartDate}
            onChange={e => setData(p => ({ ...p, tripStartDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">תאריך חזרה *</Label>
          <Input
            id="endDate"
            type="date"
            min={data.tripStartDate}
            value={data.tripEndDate}
            onChange={e => setData(p => ({ ...p, tripEndDate: e.target.value }))}
          />
        </div>
      </div>
      {tripDays > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          משך הנסיעה: <strong>{tripDays} ימים</strong>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="dest">יעד הנסיעה *</Label>
        <Input
          id="dest"
          placeholder="לדוגמה: ניו יורק, ארהב"
          value={data.tripDestination}
          onChange={e => setData(p => ({ ...p, tripDestination: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="purpose">מטרת הנסיעה *</Label>
        <Input
          id="purpose"
          placeholder="לדוגמה: כנס מקצועי, פגישות עם לקוחות"
          value={data.tripPurpose}
          onChange={e => setData(p => ({ ...p, tripPurpose: e.target.value }))}
        />
      </div>
    </div>,

    // Step 1: Upload docs
    <div className="space-y-4" key="step1">
      <p className="text-sm text-muted-foreground">
        העלה חשבוניות והוצאות שונות (עד 20 קבצים). לאחר ההעלאה, ציין עבור כל הוצאה אם שולמה מכיסך האישי או מחשבון החברה.
      </p>

      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-6 text-center cursor-pointer hover:bg-emerald-50/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files, 'docs');
        }}
      >
        <Upload className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">גרור קבצים לכאן או לחץ להעלאה</p>
        <p className="text-xs text-muted-foreground mt-1">תמונות, PDF – עד 20 קבצים</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => e.target.files && handleFilesAdded(e.target.files, 'docs')}
        />
      </div>

      {data.docs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.docs.map(doc => <DocCard key={doc.id} doc={doc} target="docs" />)}
        </div>
      )}

      {data.docs.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">קבצים:</span>
            <span className="font-medium">{data.docs.length} / 20</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">סה"כ מנותח:</span>
            <span className="font-medium text-emerald-600">
              ₪{data.docs.reduce((s, d) => s + (d.amountIls || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>,

    // Step 2: Daily allowance
    <div className="space-y-4" key="step2">
      <div className="flex justify-center">
        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
          <Sun className="w-7 h-7 text-amber-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold">האם להוסיף ימי שהייה לדוח?</h3>
      <p className="text-center text-sm text-muted-foreground">
        ימי שהייה הם סכום יומי קבוע שמגיע לך עבור כל יום בנסיעה
      </p>
      <div className="flex gap-3 justify-center">
        <Button
          variant={data.addAllowance === true ? 'default' : 'outline'}
          className={data.addAllowance === true ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          onClick={() => setData(p => ({ ...p, addAllowance: true, allowanceDays: tripDays }))}
        >
          <CheckCircle2 className="w-4 h-4 ml-1" />
          כן, הוסף
        </Button>
        <Button
          variant={data.addAllowance === false ? 'default' : 'outline'}
          onClick={() => setData(p => ({ ...p, addAllowance: false }))}
        >
          לא
        </Button>
      </div>

      {data.addAllowance && (
        <div className="space-y-3 border rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="allowDays">מספר ימים</Label>
              <Input
                id="allowDays"
                type="number"
                min={1}
                value={data.allowanceDays}
                onChange={e => setData(p => ({ ...p, allowanceDays: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">ברירת מחדל: {tripDays} ימים</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="daily">תשלום יומי (₪)</Label>
              <Input
                id="daily"
                type="number"
                min={0}
                value={data.dailyAllowance}
                onChange={e => setData(p => ({ ...p, dailyAllowance: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">סה"כ ימי שהייה:</p>
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
        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
          <Plane className="w-7 h-7 text-blue-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold">האם היו הוצאות כרטיסי טיסה?</h3>
      <div className="flex gap-3 justify-center">
        <Button
          variant={data.addFlights === true ? 'default' : 'outline'}
          className={data.addFlights === true ? 'bg-blue-600 hover:bg-blue-700' : ''}
          onClick={() => setData(p => ({ ...p, addFlights: true }))}
        >
          <CheckCircle2 className="w-4 h-4 ml-1" />
          כן
        </Button>
        <Button
          variant={data.addFlights === false ? 'default' : 'outline'}
          onClick={() => setData(p => ({ ...p, addFlights: false }))}
        >
          לא
        </Button>
      </div>

      {data.addFlights && (
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-5 text-center cursor-pointer hover:bg-blue-50/50 transition-colors"
            onClick={() => flightInputRef.current?.click()}
          >
            <Upload className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-blue-700">העלה קבוצת כרטיסי טיסה</p>
            <p className="text-xs text-muted-foreground">ניתן להעלות מספר קבצים</p>
            <input
              ref={flightInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => e.target.files && handleFilesAdded(e.target.files, 'flightDocs')}
            />
          </div>

          {data.flightDocs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.flightDocs.map(doc => <DocCard key={doc.id} doc={doc} target="flightDocs" />)}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="flightTotal">סה"כ עלות טיסות (₪)</Label>
            <Input
              id="flightTotal"
              type="number"
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
        <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
          <Hotel className="w-7 h-7 text-purple-600" />
        </div>
      </div>
      <h3 className="text-center font-semibold">האם היו הוצאות לינה שלא הוספת עדיין?</h3>
      <div className="flex gap-3 justify-center">
        <Button
          variant={data.addAccommodation === true ? 'default' : 'outline'}
          className={data.addAccommodation === true ? 'bg-purple-600 hover:bg-purple-700' : ''}
          onClick={() => setData(p => ({ ...p, addAccommodation: true }))}
        >
          <CheckCircle2 className="w-4 h-4 ml-1" />
          כן
        </Button>
        <Button
          variant={data.addAccommodation === false ? 'default' : 'outline'}
          onClick={() => setData(p => ({ ...p, addAccommodation: false }))}
        >
          לא
        </Button>
      </div>

      {data.addAccommodation && (
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl p-5 text-center cursor-pointer hover:bg-purple-50/50 transition-colors"
            onClick={() => accommodationInputRef.current?.click()}
          >
            <Upload className="w-6 h-6 text-purple-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-purple-700">העלה קבלות לינה</p>
            <input
              ref={accommodationInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => e.target.files && handleFilesAdded(e.target.files, 'accommodationDocs')}
            />
          </div>

          {data.accommodationDocs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.accommodationDocs.map(doc => <DocCard key={doc.id} doc={doc} target="accommodationDocs" />)}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="accTotal">סה"כ עלות לינה (₪)</Label>
            <Input
              id="accTotal"
              type="number"
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
      <h3 className="font-semibold text-center text-lg">סיכום הדוח</h3>

      {/* Trip info */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">יעד</span>
          <span className="font-medium">{data.tripDestination}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">תאריכים</span>
          <span className="font-medium">
            {data.tripStartDate && format(new Date(data.tripStartDate), 'dd/MM/yyyy', { locale: he })} –{' '}
            {data.tripEndDate && format(new Date(data.tripEndDate), 'dd/MM/yyyy', { locale: he })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">מטרה</span>
          <span className="font-medium">{data.tripPurpose}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        {data.docs.length > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              <Receipt className="w-3.5 h-3.5 inline ml-1" />
              חשבוניות ({data.docs.length})
            </span>
            <span className="font-medium">₪{data.docs.reduce((s, d) => s + (d.amountIls || 0), 0).toFixed(2)}</span>
          </div>
        )}
        {data.addAllowance && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              <Sun className="w-3.5 h-3.5 inline ml-1" />
              ימי שהייה ({data.allowanceDays} × ₪{data.dailyAllowance})
            </span>
            <span className="font-medium">₪{(data.allowanceDays * data.dailyAllowance).toLocaleString()}</span>
          </div>
        )}
        {data.addFlights && data.flightTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              <Plane className="w-3.5 h-3.5 inline ml-1" />
              טיסות
            </span>
            <span className="font-medium">₪{data.flightTotal.toLocaleString()}</span>
          </div>
        )}
        {data.addAccommodation && data.accommodationTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              <Hotel className="w-3.5 h-3.5 inline ml-1" />
              לינה
            </span>
            <span className="font-medium">₪{data.accommodationTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-bold">
          <span>סה"כ לתשלום</span>
          <span className="text-emerald-600 text-lg">
            ₪{(
              data.docs.reduce((s, d) => s + (d.amountIls || 0), 0) +
              (data.addAllowance ? data.allowanceDays * data.dailyAllowance : 0) +
              (data.addFlights ? data.flightTotal : 0) +
              (data.addAccommodation ? data.accommodationTotal : 0)
            ).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Payment split */}
      {(() => {
        const allDocs = [...data.docs, ...data.flightDocs, ...data.accommodationDocs];
        const pocket = allDocs.filter(d => d.paymentMethod === 'out_of_pocket').reduce((s, d) => s + (d.amountIls || 0), 0);
        const company = allDocs.filter(d => d.paymentMethod === 'company_card').reduce((s, d) => s + (d.amountIls || 0), 0);
        if (pocket === 0 && company === 0) return null;
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">מכיסי (להחזר)</p>
              <p className="font-bold text-emerald-700">₪{pocket.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">חברה</p>
              <p className="font-bold text-blue-700">₪{company.toFixed(2)}</p>
            </div>
          </div>
        );
      })()}
    </div>,
  ];

  // ──── Render ────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
      {/* Header */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 fixed top-0 left-0 right-0 z-50" />

      <div className="container mx-auto px-4 pt-6 pb-24 max-w-2xl">
        {/* Back */}
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 mt-2"
          onClick={() => step === 0 ? navigate('/independent') : setStep(s => s - 1)}
        >
          <ArrowRight className="w-4 h-4" />
          {step === 0 ? 'חזרה לדשבורד' : 'חזרה'}
        </button>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">דוח הוצאות חדש</h1>
            <span className="text-sm text-muted-foreground">{step + 1} / {STEP_LABELS.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {STEP_LABELS.map((label, i) => (
              <span key={i} className={`text-xs ${i === step ? 'text-emerald-600 font-medium' : i < step ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {i < 3 ? label.slice(0, 5) : label.slice(0, 4)}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">{STEP_LABELS[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            {steps[step]}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
          <div className="container mx-auto max-w-2xl flex gap-3">
            {step < STEP_LABELS.length - 1 ? (
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                disabled={!canProceed()}
                onClick={() => setStep(s => s + 1)}
              >
                המשך
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            ) : (
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                disabled={saving}
                onClick={handleFinish}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    יוצר דוח...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 ml-2" />
                    סגור והפק PDF
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
