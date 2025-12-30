import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  File,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRule {
  category?: string;
  grade?: string;
  max_amount?: number;
  currency?: string;
  destination_type?: string;
  per_type?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

interface PolicyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rules: ParsedRule[]) => Promise<void>;
  type: 'category_rules' | 'restrictions' | 'custom_rules';
}

const CATEGORY_MAP: Record<string, string> = {
  'טיסות': 'flights',
  'flights': 'flights',
  'לינה': 'accommodation',
  'accommodation': 'accommodation',
  'מלון': 'accommodation',
  'hotel': 'accommodation',
  'אוכל': 'food',
  'food': 'food',
  'תחבורה': 'transportation',
  'transportation': 'transportation',
  'אחר': 'miscellaneous',
  'miscellaneous': 'miscellaneous',
  'שונות': 'miscellaneous',
};

const DESTINATION_MAP: Record<string, string> = {
  'כל היעדים': 'all',
  'all': 'all',
  'הכל': 'all',
  'מקומי': 'domestic',
  'domestic': 'domestic',
  'ארץ': 'domestic',
  'בינלאומי': 'international',
  'international': 'international',
  'חול': 'international',
};

const PER_TYPE_MAP: Record<string, string> = {
  'לנסיעה': 'per_trip',
  'per_trip': 'per_trip',
  'נסיעה': 'per_trip',
  'ליום': 'per_day',
  'per_day': 'per_day',
  'יום': 'per_day',
  'לפריט': 'per_item',
  'per_item': 'per_item',
  'פריט': 'per_item',
};

const CURRENCY_MAP: Record<string, string> = {
  'שקל': 'ILS',
  'ils': 'ILS',
  'ש"ח': 'ILS',
  '₪': 'ILS',
  'דולר': 'USD',
  'usd': 'USD',
  '$': 'USD',
  'אירו': 'EUR',
  'eur': 'EUR',
  '€': 'EUR',
};

export function PolicyImportDialog({ open, onOpenChange, onImport, type }: PolicyImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRules, setParsedRules] = useState<ParsedRule[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const resetDialog = () => {
    setFileName('');
    setParsedRules([]);
    setStep('upload');
    setLoading(false);
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await parseExcelFile(file);
      } else if (fileExtension === 'csv') {
        await parseCSVFile(file);
      } else {
        toast({
          title: 'סוג קובץ לא נתמך',
          description: 'אנא העלה קובץ Excel (.xlsx, .xls) או CSV',
          variant: 'destructive',
        });
        resetDialog();
        return;
      }

      setStep('preview');
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast({
        title: 'שגיאה בקריאת הקובץ',
        description: error.message || 'לא ניתן לקרוא את הקובץ',
        variant: 'destructive',
      });
      resetDialog();
    } finally {
      setLoading(false);
    }
  };

  const parseExcelFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length < 2) {
      throw new Error('הקובץ ריק או חסרות שורות נתונים');
    }

    const headers = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim());
    const rules: ParsedRule[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue;
      }

      const rule = parseRow(row, headers);
      rules.push(rule);
    }

    if (rules.length === 0) {
      throw new Error('לא נמצאו נתונים תקינים בקובץ');
    }

    setParsedRules(rules);
  };

  const parseCSVFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('הקובץ ריק או חסרות שורות נתונים');
    }

    const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
    const rules: ParsedRule[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      if (row.every(cell => !cell)) continue;

      const rule = parseRow(row, headers);
      rules.push(rule);
    }

    if (rules.length === 0) {
      throw new Error('לא נמצאו נתונים תקינים בקובץ');
    }

    setParsedRules(rules);
  };

  const parseRow = (row: any[], headers: string[]): ParsedRule => {
    const errors: string[] = [];
    
    const getValue = (possibleNames: string[]): string => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.includes(name));
        if (index !== -1 && row[index] !== undefined && row[index] !== null) {
          return String(row[index]).trim();
        }
      }
      return '';
    };

    const categoryRaw = getValue(['קטגוריה', 'category', 'סוג']);
    const category = CATEGORY_MAP[categoryRaw.toLowerCase()] || categoryRaw;
    
    const gradeRaw = getValue(['דרגה', 'grade', 'רמה']);
    
    const amountRaw = getValue(['תקרה', 'סכום', 'amount', 'max', 'מקסימום']);
    const max_amount = parseFloat(amountRaw.replace(/[^\d.-]/g, '')) || undefined;
    
    const currencyRaw = getValue(['מטבע', 'currency']);
    const currency = CURRENCY_MAP[currencyRaw.toLowerCase()] || currencyRaw.toUpperCase() || 'ILS';
    
    const destRaw = getValue(['יעד', 'destination', 'סוג יעד']);
    const destination_type = DESTINATION_MAP[destRaw.toLowerCase()] || destRaw || 'all';
    
    const perRaw = getValue(['לכל', 'per', 'תדירות']);
    const per_type = PER_TYPE_MAP[perRaw.toLowerCase()] || perRaw || 'per_trip';
    
    const notes = getValue(['הערות', 'notes', 'תיאור']);

    // Validation
    if (!category || !['flights', 'accommodation', 'food', 'transportation', 'miscellaneous'].includes(category)) {
      errors.push('קטגוריה לא תקינה');
    }

    if (!['all', 'domestic', 'international'].includes(destination_type)) {
      errors.push('סוג יעד לא תקין');
    }

    if (!['per_trip', 'per_day', 'per_item'].includes(per_type)) {
      errors.push('סוג תקרה לא תקין');
    }

    return {
      category,
      grade: gradeRaw || undefined,
      max_amount,
      currency,
      destination_type,
      per_type,
      notes: notes || undefined,
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleImport = async () => {
    const validRules = parsedRules.filter(r => r.isValid);
    if (validRules.length === 0) {
      toast({
        title: 'אין חוקים תקינים לייבוא',
        description: 'אנא תקן את השגיאות או העלה קובץ אחר',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      await onImport(validRules);
      toast({
        title: 'הייבוא הושלם',
        description: `יובאו ${validRules.length} חוקים בהצלחה`,
      });
      onOpenChange(false);
      resetDialog();
    } catch (error: any) {
      toast({
        title: 'שגיאה בייבוא',
        description: error.message || 'אירעה שגיאה בייבוא החוקים',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['קטגוריה', 'דרגה', 'תקרה', 'מטבע', 'יעד', 'לכל', 'הערות'];
    const exampleData = [
      ['טיסות', 'עובד', '5000', 'ILS', 'כל היעדים', 'לנסיעה', 'הערה לדוגמה'],
      ['לינה', 'מנהל', '800', 'USD', 'בינלאומי', 'ליום', ''],
      ['אוכל', '', '150', 'ILS', 'מקומי', 'ליום', 'כולל משקאות'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'חוקי מדיניות');
    XLSX.writeFile(workbook, 'תבנית_חוקי_מדיניות.xlsx');
  };

  const validCount = parsedRules.filter(r => r.isValid).length;
  const invalidCount = parsedRules.filter(r => !r.isValid).length;

  const getCategoryLabel = (cat?: string) => {
    const labels: Record<string, string> = {
      flights: 'טיסות',
      accommodation: 'לינה',
      food: 'אוכל',
      transportation: 'תחבורה',
      miscellaneous: 'אחר',
    };
    return labels[cat || ''] || cat || '-';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            ייבוא חוקי מדיניות
          </DialogTitle>
          <DialogDescription>
            העלה קובץ Excel או CSV עם חוקי המדיניות שברצונך לייבא
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            {/* File Upload Area */}
            <div 
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">קורא את הקובץ...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-4 mb-4">
                    <FileSpreadsheet className="w-10 h-10 text-green-600" />
                    <FileText className="w-10 h-10 text-blue-600" />
                    <File className="w-10 h-10 text-orange-600" />
                  </div>
                  <p className="font-medium mb-1">לחץ להעלאת קובץ</p>
                  <p className="text-sm text-muted-foreground">
                    Excel (.xlsx, .xls) או CSV
                  </p>
                </>
              )}
            </div>

            {/* Template Download */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-sm">
                  לא בטוח לגבי הפורמט? הורד את התבנית לדוגמה
                </span>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 ml-2" />
                  הורד תבנית
                </Button>
              </AlertDescription>
            </Alert>

            {/* Expected Columns */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">עמודות נדרשות:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">קטגוריה</Badge>
                <Badge variant="outline">דרגה (אופציונלי)</Badge>
                <Badge variant="outline">תקרה</Badge>
                <Badge variant="outline">מטבע</Badge>
                <Badge variant="outline">יעד</Badge>
                <Badge variant="outline">לכל (יום/נסיעה/פריט)</Badge>
                <Badge variant="outline">הערות (אופציונלי)</Badge>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="text-sm">
                <FileSpreadsheet className="w-3 h-3 ml-1" />
                {fileName}
              </Badge>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="w-3 h-3 ml-1" />
                {validCount} תקינים
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 ml-1" />
                  {invalidCount} שגיאות
                </Badge>
              )}
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">סטטוס</TableHead>
                    <TableHead>קטגוריה</TableHead>
                    <TableHead>דרגה</TableHead>
                    <TableHead>תקרה</TableHead>
                    <TableHead>מטבע</TableHead>
                    <TableHead>יעד</TableHead>
                    <TableHead>לכל</TableHead>
                    <TableHead>שגיאות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRules.map((rule, index) => (
                    <TableRow key={index} className={rule.isValid ? '' : 'bg-destructive/10'}>
                      <TableCell>
                        {rule.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>{getCategoryLabel(rule.category)}</TableCell>
                      <TableCell>{rule.grade || '-'}</TableCell>
                      <TableCell>{rule.max_amount?.toLocaleString() || '-'}</TableCell>
                      <TableCell>{rule.currency}</TableCell>
                      <TableCell>{rule.destination_type}</TableCell>
                      <TableCell>{rule.per_type}</TableCell>
                      <TableCell className="text-destructive text-xs">
                        {rule.errors.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {invalidCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {invalidCount} שורות עם שגיאות לא ייובאו. רק שורות תקינות ייובאו.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'preview' && (
            <Button variant="outline" onClick={() => setStep('upload')} disabled={importing}>
              חזור
            </Button>
          )}
          <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }} disabled={importing}>
            ביטול
          </Button>
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מייבא...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" />
                  ייבא {validCount} חוקים
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
