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
  Building2, 
  Users, 
  FileText, 
  DollarSign, 
  Settings,
  BarChart3,
  Edit,
  Ticket,
  Home,
  Sparkles,
  TrendingUp,
  ClipboardList,
  UserCircle,
  Mail,
  Briefcase,
  Hash
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrgStats {
  totalUsers: number;
  totalReports: number;
  openReports: number;
  closedReports: number;
  totalAmount: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  employee_id: string | null;
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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

      // Get users in organization
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, employee_id')
        .eq('organization_id', profileData.organization_id)
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Get user IDs for reports query
      const userIds = usersData?.map(u => u.id) || [];

      if (userIds.length > 0) {
        // Get reports statistics
        const { data: reportsData, error: reportsError } = await supabase
          .from('reports')
          .select('*')
          .in('user_id', userIds);

        if (reportsError) throw reportsError;

        const totalReports = reportsData?.length || 0;
        const openReports = reportsData?.filter(r => r.status === 'open' || r.status === 'pending_approval').length || 0;
        const closedReports = reportsData?.filter(r => r.status === 'closed').length || 0;
        const totalAmount = reportsData?.reduce((sum, r) => sum + (r.total_amount_ils || 0), 0) || 0;

        setStats({
          totalUsers: usersData?.length || 0,
          totalReports,
          openReports,
          closedReports,
          totalAmount,
        });
      } else {
        setStats({
          totalUsers: 0,
          totalReports: 0,
          openReports: 0,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg animate-pulse">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
              <Sparkles className="w-3 h-3 text-white animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">טוען נתוני ארגון...</p>
        </div>
      </div>
    );
  }

  if (!isOrgAdmin || !organization) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" dir="rtl">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  ניהול ארגון - {organization.name}
                </h1>
                <p className="text-white/80 mt-1">
                  {organization.description || 'ניהול ומעקב אחר הארגון שלך'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="w-4 h-4 ml-2" />
                ערוך ארגון
              </Button>
              <Button 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                onClick={() => navigate('/')}
              >
                <Home className="w-4 h-4 ml-2" />
                חזרה לדף הבית
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">סה"כ משתמשים</p>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">דוחות פתוחים</p>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats?.openReports || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                סגורים: {stats?.closedReports || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">סכום כולל</p>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                ₪{(stats?.totalAmount || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">סה"כ דוחות</p>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {stats?.totalReports || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-background border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-sm">
                <Settings className="h-4 w-4 text-white" />
              </div>
              פעולות מהירות
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-3 border-2 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all duration-300 group"
              onClick={() => navigate('/orgadmin/invitation-codes')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Ticket className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-medium">ניהול קודי הזמנה</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-3 border-2 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-300 group"
              onClick={() => navigate('/orgadmin/users')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-medium">ניהול משתמשים</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-3 border-2 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-300 group"
              onClick={() => navigate('/orgadmin/analytics')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-medium">דוחות וסטטיסטיקות</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-3 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary hover:from-primary/10 hover:to-primary/20 transition-all duration-300 group"
              onClick={() => navigate('/orgadmin/travel-policy')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium text-primary">מדיניות נסיעות</span>
            </Button>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/30 dark:to-background border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">משתמשים בארגון</CardTitle>
                  <CardDescription>
                    {users.length} משתמשים רשומים בארגון
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">אין משתמשים בארגון</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  צור קודי הזמנה כדי להוסיף משתמשים חדשים לארגון
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y">
                  {users.map((user) => (
                    <div key={user.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center flex-shrink-0">
                          <UserCircle className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-foreground truncate">{user.full_name}</p>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate">{user.email || '-'}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5" />
                              {user.department}
                            </span>
                            {user.employee_id && (
                              <span className="flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" />
                                {user.employee_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">שם מלא</TableHead>
                        <TableHead className="font-semibold">אימייל</TableHead>
                        <TableHead className="font-semibold">מחלקה</TableHead>
                        <TableHead className="font-semibold">מס' עובד</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center">
                                <UserCircle className="w-4 h-4 text-blue-500" />
                              </div>
                              <span className="font-medium">{user.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {user.department}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.employee_id || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Organization Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle>ערוך פרטי ארגון</DialogTitle>
                  <DialogDescription>
                    עדכן את פרטי הארגון שלך
                  </DialogDescription>
                </div>
              </div>
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
                  className="h-11"
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
              <Button 
                onClick={handleUpdateOrg} 
                disabled={submitting}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {submitting ? (
                  <>
                    <Sparkles className="ml-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  'שמור שינויים'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
