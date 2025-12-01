import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Plus, Pencil, Trash2, Building2, Mail, UserCheck, Shield, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  department: string;
  employee_id: string | null;
  is_manager: boolean;
  manager_id: string | null;
  created_at: string;
}

interface UserRole {
  role: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function OrgAdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map());
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    department: '',
    employee_id: '',
    is_manager: false,
    manager_id: '',
  });

  useEffect(() => {
    checkOrgAdminStatus();
  }, [user]);

  const checkOrgAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      // Check if user has org_admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'org_admin')
        .maybeSingle();

      if (!roleData) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהלי ארגון יכולים לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Get user's organization
      const { data: profileData }: any = await (supabase as any)
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profileData || !profileData.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון עבור המשתמש',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Get organization details
      const { data: orgData }: any = await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('id', profileData.organization_id)
        .single();

      if (!orgData) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setOrgId(orgData.id);
      setOrgName(orgData.name);
      setIsOrgAdmin(true);
      await loadUsers(orgData.id);
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadUsers = async (organizationId: string) => {
    setLoading(true);
    try {
      // Load users in the organization
      const { data: usersData, error: usersError }: any = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      setUsers(usersData || []);
      setManagers(usersData?.filter((u: UserProfile) => u.is_manager) || []);

      // Load roles for each user
      if (usersData && usersData.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', usersData.map((u: UserProfile) => u.id));

        const rolesMap = new Map<string, string[]>();
        rolesData?.forEach((r: any) => {
          const existing = rolesMap.get(r.user_id) || [];
          rolesMap.set(r.user_id, [...existing, r.role]);
        });
        setUserRoles(rolesMap);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את המשתמשים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setFormData({
      full_name: userProfile.full_name,
      email: userProfile.email || '',
      username: userProfile.username,
      department: userProfile.department,
      employee_id: userProfile.employee_id || '',
      is_manager: userProfile.is_manager,
      manager_id: userProfile.manager_id || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) {
      toast({
        title: 'שגיאה',
        description: 'לא נבחר משתמש לעריכה',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          department: formData.department,
          employee_id: formData.employee_id || null,
          is_manager: formData.is_manager,
          manager_id: formData.manager_id || null,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'פרטי המשתמש עודכנו בהצלחה',
      });

      setDialogOpen(false);
      resetForm();
      if (orgId) {
        await loadUsers(orgId);
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון המשתמש',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${userName}"?`)) {
      return;
    }

    try {
      // Check if user has reports
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (count && count > 0) {
        toast({
          title: 'לא ניתן למחוק',
          description: `למשתמש "${userName}" יש ${count} דוחות. יש למחוק אותם תחילה.`,
          variant: 'destructive',
        });
        return;
      }

      // Delete user roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Delete profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      // Delete auth user
      await supabase.auth.admin.deleteUser(userId);

      toast({
        title: 'הצלחה',
        description: `המשתמש "${userName}" נמחק בהצלחה`,
      });

      if (orgId) {
        await loadUsers(orgId);
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת המשתמש',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      username: '',
      department: '',
      employee_id: '',
      is_manager: false,
      manager_id: '',
    });
    setEditingUser(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
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

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            ניהול משתמשים - {orgName}
          </h1>
          <p className="text-muted-foreground mt-2">
            נהל משתמשים בארגון שלך
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          חזרה לדף הבית
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          כמנהל ארגון, ניתן לנהל רק משתמשים השייכים לארגון <strong>{orgName}</strong>.
          יצירת משתמשים חדשים מתבצעת דרך תהליך ההרשמה הרגיל.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סך המשתמשים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מנהלים</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">עובדים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length - managers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת משתמשים</CardTitle>
          <CardDescription>כל המשתמשים בארגון</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>אין משתמשים בארגון</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם מלא</TableHead>
                    <TableHead>שם משתמש</TableHead>
                    <TableHead>מחלקה</TableHead>
                    <TableHead>מס׳ עובד</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                    <TableHead className="text-left">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userProfile) => {
                    const roles = userRoles.get(userProfile.id) || [];
                    return (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                        <TableCell>{userProfile.username}</TableCell>
                        <TableCell>{userProfile.department}</TableCell>
                        <TableCell>{userProfile.employee_id || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userProfile.is_manager && (
                              <Badge variant="secondary">
                                <UserCheck className="h-3 w-3 ml-1" />
                                מנהל
                              </Badge>
                            )}
                            {roles.map((role) => (
                              <Badge key={role} variant="outline">
                                <Shield className="h-3 w-3 ml-1" />
                                {role}
                              </Badge>
                            ))}
                            {!userProfile.is_manager && roles.length === 0 && (
                              <Badge variant="outline">עובד</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(userProfile.created_at).toLocaleDateString('he-IL')}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(userProfile)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(userProfile.id, userProfile.full_name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[525px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>עריכת פרטי משתמש</DialogTitle>
              <DialogDescription>
                ערוך את פרטי המשתמש בארגון
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">שם מלא *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">שם משתמש *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">מחלקה *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee_id">מספר עובד</Label>
                <Input
                  id="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_manager"
                  checked={formData.is_manager}
                  onChange={(e) => setFormData({ ...formData, is_manager: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_manager" className="font-normal cursor-pointer">
                  המשתמש הוא מנהל
                </Label>
              </div>
              {!formData.is_manager && (
                <div className="grid gap-2">
                  <Label htmlFor="manager_id">מנהל מאשר</Label>
                  <Select
                    value={formData.manager_id}
                    onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מנהל" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא מנהל</SelectItem>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                ) : (
                  'שמור שינויים'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
