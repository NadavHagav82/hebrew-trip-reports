import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Users, Send } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "@/pdf/ReportPdf";

interface AccountingManager {
  id: string;
  full_name: string;
  email: string;
}

interface SendToAccountingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportDestination: string;
  employeeName: string;
}

export function SendToAccountingDialog({
  open,
  onOpenChange,
  reportId,
  reportDestination,
  employeeName,
}: SendToAccountingDialogProps) {
  const [sendMethod, setSendMethod] = useState<"system" | "email">("system");
  const [accountingManagers, setAccountingManagers] = useState<AccountingManager[]>([]);
  const [selectedAccountingManagerId, setSelectedAccountingManagerId] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadAccountingManagers();
    }
  }, [open]);

  const loadAccountingManagers = async () => {
    setLoadingManagers(true);
    try {
      // Get all users with accounting_manager role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'accounting_manager');

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        
        // Get profiles for these users
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profileError) throw profileError;

        const managers = (profiles || []).map(p => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email || '',
        }));

        setAccountingManagers(managers);
        
        if (managers.length > 0) {
          setSelectedAccountingManagerId(managers[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading accounting managers:', error);
    } finally {
      setLoadingManagers(false);
    }
  };

  const generatePdfBase64 = async (): Promise<string | null> => {
    try {
      // Fetch report data
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError || !report) {
        console.error('Error fetching report:', reportError);
        return null;
      }

      // Fetch expenses
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          receipts (id, file_url, file_name, file_type)
        `)
        .eq('report_id', reportId)
        .order('expense_date', { ascending: true });

      if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        return null;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, employee_id, department')
        .eq('id', report.user_id)
        .single();

      // Generate PDF
      const pdfDoc = <ReportPdf report={report} expenses={expenses || []} profile={profile} />;
      const blob = await pdf(pdfDoc).toBlob();
      
      // Convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handleSend = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      // Generate PDF
      toast({
        title: "מכין PDF...",
        description: "אנא המתן",
      });
      
      const pdfBase64 = await generatePdfBase64();

      if (sendMethod === "system") {
        if (!selectedAccountingManagerId) {
          toast({
            title: "שגיאה",
            description: "נא לבחור מנהל חשבונות",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const selectedManager = accountingManagers.find(m => m.id === selectedAccountingManagerId);

        // Create notification for the accounting manager
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedAccountingManagerId,
            type: 'new_report',
            title: 'דוח חדש לטיפול',
            message: `דוח הוצאות ל${reportDestination} של ${employeeName} אושר על ידי המנהל ומחכה לטיפולך.`,
            report_id: reportId,
          });

        if (notificationError) throw notificationError;

        // Save send history
        await supabase.from('accounting_send_history').insert({
          report_id: reportId,
          sent_by: user.id,
          sent_to_user_id: selectedAccountingManagerId,
          sent_to_email: selectedManager?.email || '',
          sent_to_name: selectedManager?.full_name || '',
          send_method: 'system',
        });

        // Also send email to accounting manager with PDF
        if (selectedManager?.email) {
          await supabase.functions.invoke('send-accounting-report', {
            body: { 
              reportId, 
              accountingEmail: selectedManager.email,
              pdfBase64,
              pdfFileName: `דוח-נסיעה-${reportDestination}.pdf`
            }
          });
        }

        toast({
          title: "נשלח בהצלחה",
          description: "הדוח נשלח למנהל החשבונות עם התראה במערכת",
        });
      } else {
        // Send via email
        const emailToSend = customEmail.trim();
        if (!emailToSend) {
          toast({
            title: "שגיאה",
            description: "נא להזין כתובת מייל",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailToSend)) {
          toast({
            title: "שגיאה",
            description: "כתובת המייל אינה תקינה",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Save send history
        await supabase.from('accounting_send_history').insert({
          report_id: reportId,
          sent_by: user.id,
          sent_to_email: emailToSend,
          send_method: 'email',
        });

        await supabase.functions.invoke('send-accounting-report', {
          body: { 
            reportId, 
            accountingEmail: emailToSend,
            pdfBase64,
            pdfFileName: `דוח-נסיעה-${reportDestination}.pdf`
          }
        });

        toast({
          title: "נשלח בהצלחה",
          description: `הדוח נשלח למייל ${emailToSend}`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error sending report:', error);
      toast({
        title: "שגיאה בשליחה",
        description: error instanceof Error ? error.message : "אירעה שגיאה בשליחת הדוח",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    toast({
      title: "הדוח אושר",
      description: "הדוח אושר בהצלחה",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            שליחת הדוח להנהלת חשבונות
          </DialogTitle>
          <DialogDescription>
            הדוח אושר בהצלחה. האם ברצונך לשלוח אותו להנהלת חשבונות?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={sendMethod} onValueChange={(v) => setSendMethod(v as "system" | "email")}>
            <div className="flex items-center space-x-reverse space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer flex-1">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="font-medium">מנהל חשבונות במערכת</p>
                  <p className="text-xs text-muted-foreground">שלח התראה למנהל חשבונות הקיים במערכת</p>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-reverse space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="email" id="email" />
              <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer flex-1">
                <Mail className="w-4 h-4 text-green-600" />
                <div>
                  <p className="font-medium">שליחה למייל</p>
                  <p className="text-xs text-muted-foreground">הזן כתובת מייל לשליחת הדוח עם קובץ PDF</p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {sendMethod === "system" && (
            <div className="space-y-2">
              <Label>בחר מנהל חשבונות</Label>
              {loadingManagers ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : accountingManagers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  לא נמצאו מנהלי חשבונות במערכת. ניתן לשלוח למייל במקום.
                </p>
              ) : (
                <RadioGroup value={selectedAccountingManagerId} onValueChange={setSelectedAccountingManagerId}>
                  {accountingManagers.map((manager) => (
                    <div 
                      key={manager.id} 
                      className="flex items-center space-x-reverse space-x-2 p-2 rounded-lg border hover:bg-muted/50"
                    >
                      <RadioGroupItem value={manager.id} id={manager.id} />
                      <Label htmlFor={manager.id} className="cursor-pointer flex-1">
                        <span className="font-medium">{manager.full_name}</span>
                        {manager.email && (
                          <span className="text-xs text-muted-foreground mr-2">({manager.email})</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {sendMethod === "email" && (
            <div className="space-y-2">
              <Label htmlFor="customEmail">כתובת מייל</Label>
              <Input
                id="customEmail"
                type="email"
                placeholder="accounting@company.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip}>
            דלג
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={loading || (sendMethod === "system" && accountingManagers.length === 0)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מייצר PDF ושולח...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 ml-2" />
                שלח עם PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
