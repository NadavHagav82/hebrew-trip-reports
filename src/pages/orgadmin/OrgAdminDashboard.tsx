import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Building2, 
  Users, 
  FileText, 
  DollarSign, 
  Settings,
  BarChart3,
  Edit,
  Ticket,
  UserCog,
  Calculator,
  ExternalLink,
  Home,
  Shield,
  UserPlus,
  Building
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  accounting_type?: string;
  external_accounting_email?: string;
  external_accounting_name?: string;
}

interface OrgStats {
  totalUsers: number;
  totalManagers: number;
  totalReports: number;
  openReports: number;
  closedReports: number;
  pendingReports: number;
  totalAmount: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  employee_id: string | null;
  is_manager: boolean;
  manager_id: string | null;
}

export default function OrgAdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountingDialogOpen, setAccountingDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [accountingFormData, setAccountingFormData] = useState({
    accounting_type: 'internal',
    external_accounting_email: '',
    external_accounting_name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkOrgAdminStatus();
  }, [user]);

  const checkOrgAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'org_admin' as any
      });

      if (!data) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהלי ארגון יכולים לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsOrgAdmin(true);
      await loadOrgData();
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadOrgData = async () => {
    try {
      // Get user's profile to find organization
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;

      if (!profileData?.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון עבור המשתמש',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Get organization details
      const { data: orgData, error: orgError }: any = await (supabase as any)
        .from('organizations')
        .select('*')
        .eq('id', profileData.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData);
      setFormData({
        name: orgData.name,
        description: orgData.description || '',
      });
      setAccountingFormData({
        accounting_type: orgData.accounting_type || 'internal',
        external_accounting_email: orgData.external_accounting_email || '',
        external_accounting_name: orgData.external_accounting_name || '',
      });

      // Get users in organization
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, employee_id, is_manager, manager_id')
        .eq('organization_id', profileData.organization_id)
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Get user IDs for reports query
      const userIds = usersData?.map(u => u.id) || [];
      const managersCount = usersData?.filter(u => u.is_manager).length || 0;

      if (userIds.length > 0) {
        // Get reports statistics
        const { data: reportsData, error: reportsError } = await supabase
          .from('reports')
          .select('*')
          .in('user_id', userIds);

        if (reportsError) throw reportsError;

        const totalReports = reportsData?.length || 0;
        const openReports = reportsData?.filter(r => r.status === 'open').length || 0;
        const pendingReports = reportsData?.filter(r => r.status === 'pending_approval').length || 0;
        const closedReports = reportsData?.filter(r => r.status === 'closed').length || 0;
        const totalAmount = reportsData?.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0) || 0;

        setStats({
          totalUsers: usersData?.length || 0,
          totalManagers: managersCount,
          totalReports,
          openReports,
          pendingReports,
          closedReports,
          totalAmount,
        });
      } else {
        setStats({
          totalUsers: 0,
          totalManagers: 0,
          totalReports: 0,
          openReports: 0,
          pendingReports: 0,
          closedReports: 0,
          totalAmount: 0,
        });
      }
    } catch (error: any) {
      console.error('Error loading org data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני הארגון',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!organization) return;

    setSubmitting(true);
    try {
      const { error }: any = await (supabase as any)
        .from('organizations')
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: 'הארגון עודכן בהצלחה',
        description: `פרטי ארגון "${formData.name}" עודכנו`,
      });

      setOrganization({
        ...organization,
        name: formData.name,
        description: formData.description,
      });
      setEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון הארגון',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAccounting = async () => {
    if (!organization) return;

    setSubmitting(true);
    try {
      const { error }: any = await (supabase as any)
        .from('organizations')
        .update({
          accounting_type: accountingFormData.accounting_type,
          external_accounting_email: accountingFormData.accounting_type === 'external' 
            ? accountingFormData.external_accounting_email 
            : null,
          external_accounting_name: accountingFormData.accounting_type === 'external' 
            ? accountingFormData.external_accounting_name 
            : null,
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: 'הגדרות הנהלת חשבונות עודכנו',
        description: accountingFormData.accounting_type === 'internal' 
          ? 'הארגון מוגדר להנהלת חשבונות פנימית'
          : 'הארגון מוגדר להנהלת חשבונות חיצונית',
      });

      setOrganization({
        ...organization,
        accounting_type: accountingFormData.accounting_type,
        external_accounting_email: accountingFormData.external_accounting_email,
        external_accounting_name: accountingFormData.external_accounting_name,
      });
      setAccountingDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating accounting settings:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון הגדרות הנהלת החשבונות',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (userProfile: UserProfile) => {
    if (userProfile.id === user?.id) {
      return <Badge variant="default">מנהל ארגון</Badge>;
    }
    if (userProfile.is_manager) {
      return <Badge variant="secondary">מנהל</Badge>;
    }
    return <Badge variant="outline">עובד</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgAdmin || !organization) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            ניהול ארגון - {organization.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {organization.description || 'ניהול ומעקב אחר הארגון שלך'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={organization.accounting_type === 'external' ? 'secondary' : 'default'}>
              {organization.accounting_type === 'external' ? 'הנהלת חשבונות חיצונית' : 'הנהלת חשבונות פנימית'}
            </Badge>
            {organization.accounting_type === 'external' && organization.external_accounting_name && (
              <span className="text-sm text-muted-foreground">
                ({organization.external_accounting_name})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="w-4 h-4 ml-2" />
            ערוך ארגון
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="w-4 h-4 ml-2" />
            דף הבית
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              סה"כ משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              מנהלים: {stats?.totalManagers || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              ממתינים לאישור
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats?.pendingReports || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              דוחות סגורים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.closedReports || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              סכום כולל
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              ₪{(stats?.totalAmount || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              סה"כ דוחות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {stats?.totalReports || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            פעולות ניהול
          </CardTitle>
          <CardDescription>
            כל הפעולות הזמינות לניהול הארגון
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/orgadmin/users')}
            >
              <Users className="h-6 w-6 text-blue-600" />
              <span className="font-medium">ניהול משתמשים</span>
              <span className="text-xs text-muted-foreground">עריכה, הגדרת מנהלים</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/orgadmin/invitation-codes')}
            >
              <Ticket className="h-6 w-6 text-green-600" />
              <span className="font-medium">קודי הזמנה</span>
              <span className="text-xs text-muted-foreground">יצירה וניהול קודים</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
              onClick={() => setAccountingDialogOpen(true)}
            >
              <Calculator className="h-6 w-6 text-purple-600" />
              <span className="font-medium">הנהלת חשבונות</span>
              <span className="text-xs text-muted-foreground">פנימית / חיצונית</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/orgadmin/analytics')}
            >
              <BarChart3 className="h-6 w-6 text-amber-600" />
              <span className="font-medium">דוחות וסטטיסטיקות</span>
              <span className="text-xs text-muted-foreground">ניתוח הוצאות</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounting Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            הגדרות הנהלת חשבונות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={organization.accounting_type === 'external' ? 'secondary' : 'default'}
                  className="text-sm"
                >
                  {organization.accounting_type === 'external' ? (
                    <>
                      <ExternalLink className="w-3 h-3 ml-1" />
                      הנהלת חשבונות חיצונית
                    </>
                  ) : (
                    <>
                      <Building className="w-3 h-3 ml-1" />
                      הנהלת חשבונות פנימית
                    </>
                  )}
                </Badge>
              </div>
              {organization.accounting_type === 'external' && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p><strong>שם:</strong> {organization.external_accounting_name || '-'}</p>
                  <p><strong>אימייל:</strong> {organization.external_accounting_email || '-'}</p>
                </div>
              )}
              {organization.accounting_type === 'internal' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  דוחות יטופלו על ידי הנהלת חשבונות פנימית של הארגון
                </p>
              )}
            </div>
            <Button variant="outline" onClick={() => setAccountingDialogOpen(true)}>
              <Edit className="w-4 h-4 ml-2" />
              שנה הגדרות
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                משתמשים בארגון
              </CardTitle>
              <CardDescription>
                {users.length} משתמשים רשומים בארגון
              </CardDescription>
            </div>
            <Button onClick={() => navigate('/orgadmin/users')}>
              <UserCog className="w-4 h-4 ml-2" />
              ניהול מלא
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>אין משתמשים בארגון</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/orgadmin/invitation-codes')}
              >
                <UserPlus className="w-4 h-4 ml-2" />
                צור קוד הזמנה
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם מלא</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>מס' עובד</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.slice(0, 10).map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                    <TableCell>{userProfile.email}</TableCell>
                    <TableCell>{userProfile.department}</TableCell>
                    <TableCell>{getRoleBadge(userProfile)}</TableCell>
                    <TableCell>{userProfile.employee_id || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {users.length > 10 && (
            <div className="text-center mt-4">
              <Button variant="link" onClick={() => navigate('/orgadmin/users')}>
                הצג את כל {users.length} המשתמשים
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Organization Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>ערוך פרטי ארגון</DialogTitle>
            <DialogDescription>
              עדכן את פרטי הארגון שלך
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
              <Label htmlFor="description">תיאור</Label>
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button onClick={handleUpdateOrg} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                'שמור שינויים'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accounting Settings Dialog */}
      <Dialog open={accountingDialogOpen} onOpenChange={setAccountingDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              הגדרות הנהלת חשבונות
            </DialogTitle>
            <DialogDescription>
              הגדר את סוג הנהלת החשבונות של הארגון
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <RadioGroup
              value={accountingFormData.accounting_type}
              onValueChange={(value) =>
                setAccountingFormData({ ...accountingFormData, accounting_type: value })
              }
              className="grid gap-4"
            >
              <div className="flex items-start space-x-3 space-x-reverse">
                <RadioGroupItem value="internal" id="internal" className="mt-1" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="internal" className="flex items-center gap-2 font-medium cursor-pointer">
                    <Building className="w-4 h-4 text-primary" />
                    הנהלת חשבונות פנימית
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    הדוחות יטופלו על ידי הנהלת חשבונות פנימית של הארגון
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-3 space-x-reverse">
                <RadioGroupItem value="external" id="external" className="mt-1" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="external" className="flex items-center gap-2 font-medium cursor-pointer">
                    <ExternalLink className="w-4 h-4 text-secondary-foreground" />
                    הנהלת חשבונות חיצונית
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    הדוחות יישלחו להנהלת חשבונות חיצונית לטיפול
                  </p>
                </div>
              </div>
            </RadioGroup>

            {accountingFormData.accounting_type === 'external' && (
              <div className="grid gap-4 pt-2 border-t">
                <div className="grid gap-2">
                  <Label htmlFor="external_name">שם הנהלת החשבונות</Label>
                  <Input
                    id="external_name"
                    value={accountingFormData.external_accounting_name}
                    onChange={(e) =>
                      setAccountingFormData({
                        ...accountingFormData,
                        external_accounting_name: e.target.value,
                      })
                    }
                    placeholder="לדוגמה: משרד רו״ח כהן"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="external_email">אימייל לשליחת דוחות *</Label>
                  <Input
                    id="external_email"
                    type="email"
                    value={accountingFormData.external_accounting_email}
                    onChange={(e) =>
                      setAccountingFormData({
                        ...accountingFormData,
                        external_accounting_email: e.target.value,
                      })
                    }
                    placeholder="accounting@example.com"
                    required={accountingFormData.accounting_type === 'external'}
                  />
                  <p className="text-xs text-muted-foreground">
                    דוחות מאושרים יישלחו לכתובת זו לטיפול
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountingDialogOpen(false)}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleUpdateAccounting} 
              disabled={submitting || (accountingFormData.accounting_type === 'external' && !accountingFormData.external_accounting_email)}
            >
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                'שמור הגדרות'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
