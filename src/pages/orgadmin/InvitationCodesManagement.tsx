import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Ticket, 
  Plus, 
  ArrowRight, 
  Copy, 
  Check,
  Clock,
  UserCheck,
  Building2,
  Users,
  Mail,
  Send,
  Sparkles,
  KeyRound,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Hash,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface InvitationCode {
  id: string;
  code: string;
  organization_id: string;
  role: string;
  manager_id: string | null;
  created_at: string;
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
  used_by: string | null;
  notes: string | null;
  max_uses: number;
  use_count: number;
  manager?: { full_name: string; email: string };
  used_by_profile?: { full_name: string; email: string };
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
}

export default function InvitationCodesManagement() {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    role: 'user' as 'user' | 'manager',
    manager_id: '',
    expires_days: '7',
    notes: '',
    max_uses: '1',
  });
  
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<InvitationCode | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkOrgAdminStatus();
  }, [user]);

  const checkOrgAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data: roleData } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'org_admin' as any,
      });

      if (!roleData) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהל ארגון יכול לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון משויך',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setOrganizationId(profile.organization_id);

      const { data: orgData } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single();

      setOrganizationName(orgData?.name || '');
      setIsOrgAdmin(true);

      loadCodes(profile.organization_id);
      loadManagers(profile.organization_id);
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadCodes = async (orgId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('invitation_codes')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const codesWithDetails = await Promise.all(
        (data || []).map(async (code: InvitationCode) => {
          let manager = null;
          let usedByProfile = null;

          if (code.manager_id) {
            const { data: m } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', code.manager_id)
              .single();
            manager = m;
          }

          if (code.used_by) {
            const { data: u } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', code.used_by)
              .single();
            usedByProfile = u;
          }

          return { ...code, manager, used_by_profile: usedByProfile };
        })
      );

      setCodes(codesWithDetails);
    } catch (error) {
      console.error('Error loading codes:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את קודי ההזמנה',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', orgId)
        .eq('is_manager', true)
        .order('full_name');

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !user) return;

    setSubmitting(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expires_days));

      const newCode = generateCode();

      const { error } = await (supabase as any)
        .from('invitation_codes')
        .insert({
          code: newCode,
          organization_id: organizationId,
          role: formData.role,
          manager_id: formData.manager_id || null,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          notes: formData.notes || null,
          max_uses: parseInt(formData.max_uses),
        });

      if (error) throw error;

      toast({
        title: 'קוד נוצר בהצלחה',
        description: `קוד ההזמנה: ${newCode}`,
      });

      setDialogOpen(false);
      resetForm();
      loadCodes(organizationId);
    } catch (error: any) {
      console.error('Error creating code:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה ביצירת הקוד',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role: 'user',
      manager_id: '',
      expires_days: '7',
      notes: '',
      max_uses: '1',
    });
  };

  const copyToClipboard = async (code: string) => {
    try {
      const registrationUrl = `${window.location.origin}/auth/register/code?code=${code}`;
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedCode(code);
      toast({
        title: 'הועתק',
        description: 'קישור ההרשמה הועתק ללוח',
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const openEmailDialog = (code: InvitationCode) => {
    setSelectedCode(code);
    setRecipientEmail('');
    setEmailDialogOpen(true);
  };

  const sendInvitationEmail = async () => {
    if (!selectedCode || !recipientEmail) return;

    setSendingEmail(true);
    try {
      const registrationUrl = `${window.location.origin}/auth/register/code?code=${selectedCode.code}`;
      
      const response = await supabase.functions.invoke('send-invitation-email', {
        body: {
          recipientEmail,
          invitationCode: selectedCode.code,
          organizationName,
          role: selectedCode.role,
          expiresAt: selectedCode.expires_at,
          registrationUrl,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'המייל נשלח בהצלחה',
        description: `קוד ההזמנה נשלח ל-${recipientEmail}`,
      });
      
      setEmailDialogOpen(false);
      setSelectedCode(null);
      setRecipientEmail('');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'שגיאה בשליחת המייל',
        description: error.message || 'אנא נסה שוב מאוחר יותר',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getCodeStatus = (code: InvitationCode) => {
    if (code.is_used || code.use_count >= code.max_uses) {
      return { label: 'נוצל', variant: 'secondary' as const, color: 'text-slate-600' };
    }
    if (new Date(code.expires_at) < new Date()) {
      return { label: 'פג תוקף', variant: 'destructive' as const, color: 'text-red-600' };
    }
    return { label: 'פעיל', variant: 'default' as const, color: 'text-green-600' };
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'org_admin': return 'מנהל ארגון';
      case 'manager': return 'מנהל';
      case 'user': return 'עובד';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg animate-pulse">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
              <Sparkles className="w-3 h-3 text-white animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">טוען קודי הזמנה...</p>
        </div>
      </div>
    );
  }

  if (!isOrgAdmin) {
    return null;
  }

  const activeCodes = codes.filter(c => !c.is_used && c.use_count < c.max_uses && new Date(c.expires_at) > new Date());
  const usedCodes = codes.filter(c => c.is_used || c.use_count >= c.max_uses);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" dir="rtl">
      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/50 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/30 p-8 shadow-lg border border-border/50">
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                <Ticket className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">ניהול קודי הזמנה</h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {organizationName}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-border hover:bg-muted"
              onClick={() => navigate('/orgadmin')}
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לדשבורד
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">קודים פעילים</p>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{activeCodes.length}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">קודים שנוצלו</p>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{usedCodes.length}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                <Users className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">סה"כ קודים</p>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{codes.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Codes Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-background border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                  <KeyRound className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">קודי הזמנה</CardTitle>
                  <CardDescription>צור קודים להזמנת עובדים חדשים לארגון</CardDescription>
                </div>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-md">
                    <Plus className="ml-2 h-4 w-4" />
                    קוד חדש
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleCreateCode}>
                    <DialogHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                          <Ticket className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <DialogTitle>יצירת קוד הזמנה</DialogTitle>
                          <DialogDescription>
                            צור קוד הזמנה חדש לעובד
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="role">תפקיד *</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(value: 'user' | 'manager') => setFormData({ ...formData, role: value })}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="בחר תפקיד" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">עובד</SelectItem>
                            <SelectItem value="manager">מנהל</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.role === 'user' && managers.length > 0 && (
                        <div className="grid gap-2">
                          <Label htmlFor="manager_id">מנהל ישיר</Label>
                          <Select
                            value={formData.manager_id}
                            onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="בחר מנהל (אופציונלי)" />
                            </SelectTrigger>
                            <SelectContent>
                              {managers.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name} ({m.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label htmlFor="expires_days">תוקף (ימים)</Label>
                        <Select
                          value={formData.expires_days}
                          onValueChange={(value) => setFormData({ ...formData, expires_days: value })}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">יום אחד</SelectItem>
                            <SelectItem value="3">3 ימים</SelectItem>
                            <SelectItem value="7">שבוע</SelectItem>
                            <SelectItem value="14">שבועיים</SelectItem>
                            <SelectItem value="30">חודש</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="max_uses">מספר שימושים מקסימלי</Label>
                        <Select
                          value={formData.max_uses}
                          onValueChange={(value) => setFormData({ ...formData, max_uses: value })}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">שימוש יחיד</SelectItem>
                            <SelectItem value="5">5 שימושים</SelectItem>
                            <SelectItem value="10">10 שימושים</SelectItem>
                            <SelectItem value="50">50 שימושים</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="notes">הערות (אופציונלי)</Label>
                        <Input
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="הערות לקוד זה"
                          className="h-11"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        disabled={submitting}
                      >
                        ביטול
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={submitting}
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                      >
                        {submitting ? (
                          <>
                            <Sparkles className="ml-2 h-4 w-4 animate-spin" />
                            יוצר...
                          </>
                        ) : (
                          'צור קוד'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {codes.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-800/30 flex items-center justify-center mb-4">
                  <Ticket className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">אין קודי הזמנה</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  צור קוד הזמנה חדש להוספת עובדים לארגון
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y">
                  {codes.map((code) => {
                    const status = getCodeStatus(code);
                    return (
                      <div key={code.id} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              status.label === 'פעיל' 
                                ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30' 
                                : status.label === 'פג תוקף'
                                ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30'
                                : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50'
                            }`}>
                              {status.label === 'פעיל' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : status.label === 'פג תוקף' ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : (
                                <UserCheck className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <p className="font-mono font-bold text-foreground">{code.code}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={status.variant}>{status.label}</Badge>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {getRoleLabel(code.role)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  {format(new Date(code.expires_at), 'dd/MM/yyyy', { locale: he })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Hash className="w-3.5 h-3.5" />
                                  {code.use_count}/{code.max_uses}
                                </span>
                              </div>
                              {code.manager?.full_name && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  מנהל: {code.manager.full_name}
                                </p>
                              )}
                            </div>
                          </div>
                          {status.label === 'פעיל' && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(code.code)}
                                className="h-9 w-9 p-0"
                              >
                                {copiedCode === code.code ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEmailDialog(code)}
                                className="h-9 w-9 p-0"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">קוד</TableHead>
                        <TableHead className="font-semibold">תפקיד</TableHead>
                        <TableHead className="font-semibold">מנהל משויך</TableHead>
                        <TableHead className="font-semibold">סטטוס</TableHead>
                        <TableHead className="font-semibold">תוקף</TableHead>
                        <TableHead className="font-semibold">שימושים</TableHead>
                        <TableHead className="font-semibold">נוצל ע"י</TableHead>
                        <TableHead className="font-semibold text-left">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.map((code) => {
                        const status = getCodeStatus(code);
                        return (
                          <TableRow key={code.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <span className="font-mono font-bold text-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {code.code}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {getRoleLabel(code.role)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {code.manager?.full_name || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {format(new Date(code.expires_at), 'dd/MM/yyyy', { locale: he })}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{code.use_count}/{code.max_uses}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {code.used_by_profile?.full_name || '-'}
                            </TableCell>
                            <TableCell>
                              {status.label === 'פעיל' && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(code.code)}
                                    title="העתק קישור"
                                    className="h-8 w-8 p-0"
                                  >
                                    {copiedCode === code.code ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEmailDialog(code)}
                                    title="שלח במייל"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle>שליחת קוד הזמנה במייל</DialogTitle>
                  <DialogDescription>
                    שלח את קוד ההזמנה ישירות למייל של המוזמן
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedCode && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <p className="text-sm text-muted-foreground">קוד הזמנה:</p>
                  <p className="font-mono font-bold text-xl text-foreground">{selectedCode.code}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    תפקיד: {getRoleLabel(selectedCode.role)}
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="recipient-email">כתובת מייל *</Label>
                <Input
                  id="recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="example@company.com"
                  dir="ltr"
                  className="h-11"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailDialogOpen(false)}
                disabled={sendingEmail}
              >
                ביטול
              </Button>
              <Button 
                onClick={sendInvitationEmail} 
                disabled={sendingEmail || !recipientEmail}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                {sendingEmail ? (
                  <>
                    <Sparkles className="ml-2 h-4 w-4 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send className="ml-2 h-4 w-4" />
                    שלח מייל
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}