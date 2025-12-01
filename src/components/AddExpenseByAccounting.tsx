import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, X, Loader2, FileText } from "lucide-react";

interface AddExpenseByAccountingProps {
  reportId: string;
  onExpenseAdded: () => void;
}

const CATEGORIES = [
  { value: "flights", label: "טיסות" },
  { value: "accommodation", label: "לינה" },
  { value: "food", label: "אוכל" },
  { value: "transportation", label: "תחבורה" },
  { value: "miscellaneous", label: "שונות" },
];

const CURRENCIES = [
  "USD", "EUR", "ILS", "GBP", "PLN", "BGN", "CZK", "HUF", "RON",
  "SEK", "NOK", "DKK", "CHF", "JPY", "CNY", "CAD", "AUD"
];

interface ExpenseTemplate {
  id: string;
  template_name: string;
  category: string;
  description: string;
  amount: number | null;
  currency: string;
  notes: string | null;
}

export default function AddExpenseByAccounting({ reportId, onExpenseAdded }: AddExpenseByAccountingProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const [formData, setFormData] = useState({
    category: "flights",
    expense_date: new Date().toISOString().split('T')[0],
    description: "",
    amount: "",
    currency: "ILS",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        category: template.category,
        expense_date: new Date().toISOString().split('T')[0],
        description: template.description,
        amount: template.amount?.toString() || "",
        currency: template.currency,
        notes: template.notes || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "שגיאה",
        description: "יש להזין סכום תקין",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין תיאור להוצאה",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get exchange rate
      const { data: rateData, error: rateError } = await supabase.functions.invoke('get-exchange-rates', {
        body: { 
          from: formData.currency,
          to: 'ILS',
          amount: parseFloat(formData.amount)
        }
      });

      if (rateError) throw rateError;

      const amountInILS = rateData.convertedAmount || parseFloat(formData.amount);

      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert([{
          report_id: reportId,
          category: formData.category as any,
          expense_date: formData.expense_date,
          description: formData.description,
          amount: parseFloat(formData.amount),
          currency: formData.currency as any,
          amount_in_ils: amountInILS,
          notes: formData.notes || null,
        }])
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Upload receipts if any
      if (receipts.length > 0 && expense) {
        for (const file of receipts) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${expense.id}-${Date.now()}.${fileExt}`;
          const filePath = `${reportId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Error uploading receipt:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);

          await supabase.from('receipts').insert({
            expense_id: expense.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type.includes('pdf') ? 'pdf' : 'image',
            file_size: file.size,
          });
        }
      }

      // Update report total
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('amount_in_ils')
        .eq('report_id', reportId);

      const total = allExpenses?.reduce((sum, exp) => sum + (exp.amount_in_ils || 0), 0) || 0;

      await supabase
        .from('reports')
        .update({ total_amount_ils: total })
        .eq('id', reportId);

      toast({
        title: "הוצאה נוספה בהצלחה",
        description: "ההוצאה נוספה לדוח הנסיעה",
      });

      setOpen(false);
      setFormData({
        category: "flights",
        expense_date: new Date().toISOString().split('T')[0],
        description: "",
        amount: "",
        currency: "ILS",
        notes: "",
      });
      setReceipts([]);
      onExpenseAdded();
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast({
        title: "שגיאה בהוספת הוצאה",
        description: error.message || "אנא נסה שנית",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setReceipts(prev => [...prev, ...newFiles]);
    }
  };

  const removeReceipt = (index: number) => {
    setReceipts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף הוצאה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת הוצאה לדוח</DialogTitle>
          <DialogDescription>
            הוסף הוצאה חדשה לדוח הנסיעה (טיסות, לינה וכו')
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template">תבנית הוצאה</Label>
              <Select
                value={selectedTemplate}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תבנית (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא תבנית</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.template_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && selectedTemplate !== "none" && (
                <p className="text-sm text-muted-foreground">
                  {templates.find(t => t.id === selectedTemplate)?.notes}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">קטגוריה *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_date">תאריך *</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור *</Label>
            <Input
              id="description"
              placeholder="למשל: טיסה תל אביב - ניו יורק"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">סכום *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">מטבע *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              placeholder="הערות נוספות (אופציונלי)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>קבלות</Label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                id="receipt-upload"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="receipt-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm">לחץ להעלאת קבלות</p>
                  <p className="text-xs">תמונות או PDF</p>
                </div>
              </label>
            </div>

            {receipts.length > 0 && (
              <div className="mt-2 space-y-2">
                {receipts.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReceipt(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מוסיף...
                </>
              ) : (
                "הוסף הוצאה"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
