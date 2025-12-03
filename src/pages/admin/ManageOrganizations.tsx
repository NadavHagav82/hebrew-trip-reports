import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Building2, Plus, Pencil, Trash2, Loader2, ArrowRight, Users, Ticket, Copy, Check } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ManageOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [selectedOrgForCode, setSelectedOrgForCode] = useState<Organization | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });
  const [codeFormData, setCodeFormData] = useState({
    expires_days: '7',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkSuperAdminStatus();
  }, [user]);

  const checkSuperAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' as any
      });

      if (!data) {
        toast({
          title: 'אין הרשאה',
          description: 'רק Super Admin יכול לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsSuperAdmin(true);
      loadOrganizations();
    } catch (error) {
      console.error('Error checking super admin status:', error);
      navigate('/');
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error }: any = await (supabase as any)
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הארגונים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingOrg) {
        // Update existing organization
        const { error }: any = await (supabase as any)
          .from('organizations')
          .update({
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
          })
          .eq('id', editingOrg.id);

        if (error) throw error;

        toast({
          title: 'הארגון עודכן בהצלחה',
          description: `ארגון "${formData.name}" עודכן`,
        });
      } else {
        // Create new organization
        const { error }: any = await (supabase as any)
          .from('organizations')
          .insert({
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({
          title: 'הארגון נוצר בהצלחה',
          description: `ארגון "${formData.name}" נוצר במערכת`,
        });
      }

      setDialogOpen(false);
      resetForm();
      loadOrganizations();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת הארגון',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      description: org.description || '',
      is_active: org.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (org: Organization) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את ארגון "${org.name}"?`)) {
      return;
    }

    try {
      // Check if organization has users
      const { count }: any = await (supabase as any)
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id);

      if (count && count > 0) {
        toast({
          title: 'לא ניתן למחוק',
          description: `לארגון "${org.name}" יש ${count} משתמשים. יש להעביר אותם לארגון אחר תחילה.`,
          variant: 'destructive',
        });
        return;
      }

      const { error }: any = await (supabase as any)
        .from('organizations')
        .delete()
        .eq('id', org.id);

      if (error) throw error;

      toast({
        title: 'הארגון נמחק בהצלחה',
        description: `ארגון "${org.name}" הוסר מהמערכת`,
      });

      loadOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת הארגון',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
    });
    setEditingOrg(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
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

  const handleOpenCodeDialog = (org: Organization) => {
    setSelectedOrgForCode(org);
    setGeneratedCode(null);
    setCopiedCode(false);
    setCodeFormData({ expires_days: '7', notes: '' });
    setCodeDialogOpen(true);
  };

  const handleCreateOrgAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForCode || !user) return;

    setSubmitting(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(codeFormData.expires_days));

      const newCode = generateCode();

      const { error } = await (supabase as any)
        .from('invitation_codes')
        .insert({
          code: newCode,
          organization_id: selectedOrgForCode.id,
          role: 'org_admin',
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          notes: codeFormData.notes || `קוד מנהל ארגון עבור ${selectedOrgForCode.name}`,
          max_uses: 1,
        });

      if (error) throw error;

      setGeneratedCode(newCode);
      toast({
        title: 'קוד נוצר בהצלחה',
        description: 'העתק את הקוד ושלח אותו למנהל הארגון',
      });
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

  const copyCodeToClipboard = async () => {
    if (!generatedCode) return;
    try {
      const registrationUrl = `${window.location.origin}/auth/register/code?code=${generatedCode}`;
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedCode(true);
      toast({
        title: 'הועתק',
        description: 'קישור ההרשמה הועתק ללוח',
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            ניהול ארגונים
          </h1>
          <p className="text-muted-foreground mt-2">
            יצירה וניהול של ארגונים במערכת
          </p>
        </div>
        <Button onClick={() => navigate('/admin')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          חזרה לדשבורד
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סך הארגונים</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ארגונים פעילים</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter((o) => o.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ארגונים לא פעילים</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter((o) => !o.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>רשימת ארגונים</CardTitle>
              <CardDescription>כל הארגונים במערכת</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  ארגון חדש
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingOrg ? 'עריכת ארגון' : 'ארגון חדש'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingOrg
                        ? 'ערוך את פרטי הארגון'
                        : 'הזן את פרטי הארגון החדש'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">שם הארגון *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="שם הארגון"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">תיאור (אופציונלי)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="תיאור קצר של הארגון"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.checked,
                          })
                        }
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_active" className="font-normal cursor-pointer">
                        ארגון פעיל
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                      disabled={submitting}
                    >
                      ביטול
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          שומר...
                        </>
                      ) : editingOrg ? (
                        'עדכן'
                      ) : (
                        'צור ארגון'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>אין ארגונים במערכת</p>
              <p className="text-sm mt-1">צור ארגון חדש כדי להתחיל</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם הארגון</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>תאריך יצירה</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={org.is_active ? 'default' : 'secondary'}
                      >
                        {org.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(org.created_at).toLocaleDateString('he-IL')}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenCodeDialog(org)}
                          title="צור קוד למנהל ארגון"
                        >
                          <Ticket className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(org)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(org)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Org Admin Code Dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>יצירת קוד למנהל ארגון</DialogTitle>
            <DialogDescription>
              צור קוד הזמנה עבור מנהל ארגון {selectedOrgForCode?.name}
            </DialogDescription>
          </DialogHeader>
          
          {!generatedCode ? (
            <form onSubmit={handleCreateOrgAdminCode}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="expires_days">תוקף הקוד</Label>
                  <Select
                    value={codeFormData.expires_days}
                    onValueChange={(value) => setCodeFormData({ ...codeFormData, expires_days: value })}
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
                  <Label htmlFor="notes">הערות (אופציונלי)</Label>
                  <Input
                    id="notes"
                    value={codeFormData.notes}
                    onChange={(e) => setCodeFormData({ ...codeFormData, notes: e.target.value })}
                    placeholder="הערות"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCodeDialogOpen(false)}
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
          ) : (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
                <p className="text-sm text-muted-foreground mb-2">קוד ההזמנה:</p>
                <p className="text-2xl font-mono font-bold tracking-widest">{generatedCode}</p>
              </div>
              <Button
                onClick={copyCodeToClipboard}
                className="w-full"
                variant={copiedCode ? 'secondary' : 'default'}
              >
                {copiedCode ? (
                  <>
                    <Check className="ml-2 h-4 w-4" />
                    הועתק!
                  </>
                ) : (
                  <>
                    <Copy className="ml-2 h-4 w-4" />
                    העתק קישור הרשמה
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                שלח את הקישור למנהל הארגון כדי שיוכל להירשם
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCodeDialogOpen(false)}>
                  סגור
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
