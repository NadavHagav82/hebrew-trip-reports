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
  ArrowRight,
  Settings,
  UserPlus,
  BarChart3,
  Edit,
  Ticket
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
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="w-4 h-4 ml-2" />
            ערוך ארגון
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            חזרה לדף הבית
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              סה"כ משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              דוחות פתוחים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.openReports || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              סגורים: {stats?.closedReports || 0}
            </p>
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
            פעולות מהירות
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={() => navigate('/orgadmin/invitation-codes')}
          >
            <Ticket className="h-6 w-6" />
            <span>ניהול קודי הזמנה</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={() => toast({ title: 'בקרוב', description: 'תכונה זו תהיה זמינה בקרוב' })}
          >
            <BarChart3 className="h-6 w-6" />
            <span>דוחות וסטטיסטיקות</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={() => toast({ title: 'בקרוב', description: 'תכונה זו תהיה זמינה בקרוב' })}
          >
            <FileText className="h-6 w-6" />
            <span>דוחות הארגון</span>
          </Button>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            משתמשים בארגון
          </CardTitle>
          <CardDescription>
            {users.length} משתמשים רשומים בארגון
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>אין משתמשים בארגון</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם מלא</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>מס' עובד</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>{user.employee_id || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  );
}
