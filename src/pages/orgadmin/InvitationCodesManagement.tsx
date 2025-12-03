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
  Loader2, 
  ArrowRight, 
  Copy, 
  Check,
  Clock,
  UserCheck,
  Building2,
  Users,
  Mail,
  Send
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
      // Check if user is org_admin
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

      // Get user's organization
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

      // Get organization name
      const { data: orgData } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single();

      setOrganizationName(orgData?.name || '');
      setIsOrgAdmin(true);

      // Load data
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

      // Load manager and used_by details
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
      return { label: 'נוצל', variant: 'secondary' as const };
    }
    if (new Date(code.expires_at) < new Date()) {
      return { label: 'פג תוקף', variant: 'destructive' as const };
    }
    return { label: 'פעיל', variant: 'default' as const };
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return null;
  }

  const activeCodes = codes.filter(c => !c.is_used && c.use_count < c.max_uses && new Date(c.expires_at) > new Date());
  const usedCodes = codes.filter(c => c.is_used || c.use_count >= c.max_uses);

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-8 w-8" />
            ניהול קודי הזמנה
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {organizationName}
          </p>
        </div>
        <Button onClick={() => navigate('/orgadmin')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          חזרה לדשבורד
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">קודים פעילים</CardTitle>
            <Ticket className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCodes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">קודים שנוצלו</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usedCodes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ קודים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{codes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>קודי הזמנה</CardTitle>
              <CardDescription>צור קודים להזמנת עובדים חדשים לארגון</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  קוד חדש
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateCode}>
                  <DialogHeader>
                    <DialogTitle>יצירת קוד הזמנה</DialogTitle>
                    <DialogDescription>
                      צור קוד הזמנה חדש לעובד
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="role">תפקיד *</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: 'user' | 'manager') => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
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
                          <SelectTrigger>
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
                        <SelectTrigger>
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
                        <SelectTrigger>
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
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
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
        <CardContent>
          {codes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>אין קודי הזמנה</p>
              <p className="text-sm mt-1">צור קוד הזמנה חדש להוספת עובדים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>קוד</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>מנהל משויך</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>תוקף</TableHead>
                  <TableHead>שימושים</TableHead>
                  <TableHead>נוצל ע"י</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => {
                  const status = getCodeStatus(code);
                  return (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>{getRoleLabel(code.role)}</TableCell>
                      <TableCell>
                        {code.manager?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(code.expires_at), 'dd/MM/yyyy', { locale: he })}
                        </div>
                      </TableCell>
                      <TableCell>{code.use_count}/{code.max_uses}</TableCell>
                      <TableCell>
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
          )}
        </CardContent>
      </Card>
      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              שליחת קוד הזמנה במייל
            </DialogTitle>
            <DialogDescription>
              שלח את קוד ההזמנה ישירות למייל של המוזמן
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedCode && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm text-muted-foreground">קוד הזמנה:</p>
                <p className="font-mono font-bold text-lg">{selectedCode.code}</p>
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
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
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
  );
}
