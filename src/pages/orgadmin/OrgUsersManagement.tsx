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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Loader2, 
  ArrowRight, 
  Search,
  MoreHorizontal,
  UserCog,
  UserX,
  UserCheck,
  ArrowRightLeft,
  Building2,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  employee_id: string | null;
  is_manager: boolean;
  manager_id: string | null;
  created_at: string;
  role: string | null;
  manager?: { full_name: string; email: string } | null;
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
}

export default function OrgUsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterManager, setFilterManager] = useState<string>('all');
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: '',
    employee_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState('');

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

      loadUsers(profile.organization_id);
      loadManagers(profile.organization_id);
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadUsers = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .order('full_name');

      if (error) throw error;

      // Load manager details for each user
      const usersWithManagers = await Promise.all(
        (data || []).map(async (userProfile) => {
          let manager = null;
          if (userProfile.manager_id) {
            const { data: m } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', userProfile.manager_id)
              .single();
            manager = m;
          }
          return { ...userProfile, manager };
        })
      );

      setUsers(usersWithManagers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את רשימת המשתמשים',
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

  const openEditDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditForm({
      full_name: userProfile.full_name,
      department: userProfile.department,
      employee_id: userProfile.employee_id || '',
    });
    setEditDialogOpen(true);
  };

  const openTransferDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setNewManagerId(userProfile.manager_id || '');
    setTransferDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          department: editForm.department,
          employee_id: editForm.employee_id || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'המשתמש עודכן בהצלחה',
      });

      setEditDialogOpen(false);
      if (organizationId) loadUsers(organizationId);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'שגיאה בעדכון המשתמש',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          manager_id: newManagerId || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'המשתמש הועבר בהצלחה',
        description: newManagerId 
          ? `${selectedUser.full_name} הועבר למנהל חדש`
          : `${selectedUser.full_name} הוסר ממנהל`,
      });

      setTransferDialogOpen(false);
      if (organizationId) loadUsers(organizationId);
    } catch (error: any) {
      console.error('Error transferring user:', error);
      toast({
        title: 'שגיאה בהעברת המשתמש',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleManagerStatus = async (userProfile: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_manager: !userProfile.is_manager,
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      toast({
        title: userProfile.is_manager ? 'סטטוס מנהל הוסר' : 'המשתמש הוגדר כמנהל',
      });

      if (organizationId) {
        loadUsers(organizationId);
        loadManagers(organizationId);
      }
    } catch (error: any) {
      console.error('Error toggling manager status:', error);
      toast({
        title: 'שגיאה',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (userProfile: UserProfile) => {
    if (userProfile.role === 'org_admin') {
      return <Badge variant="default">מנהל ארגון</Badge>;
    }
    if (userProfile.is_manager) {
      return <Badge variant="secondary">מנהל</Badge>;
    }
    return <Badge variant="outline">עובד</Badge>;
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = 
      filterRole === 'all' ||
      (filterRole === 'manager' && u.is_manager) ||
      (filterRole === 'employee' && !u.is_manager);
    
    const matchesManager = 
      filterManager === 'all' ||
      (filterManager === 'none' && !u.manager_id) ||
      u.manager_id === filterManager;

    return matchesSearch && matchesRole && matchesManager;
  });

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

  const totalUsers = users.length;
  const totalManagers = users.filter(u => u.is_manager).length;
  const usersWithoutManager = users.filter(u => !u.manager_id && !u.is_manager).length;

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            ניהול משתמשים
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
            <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מנהלים</CardTitle>
            <UserCog className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalManagers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ללא מנהל משויך</CardTitle>
            <UserX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersWithoutManager}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת משתמשים</CardTitle>
          <CardDescription>ניהול כל המשתמשים בארגון</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם, מייל או מחלקה..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 ml-2" />
                <SelectValue placeholder="תפקיד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התפקידים</SelectItem>
                <SelectItem value="manager">מנהלים</SelectItem>
                <SelectItem value="employee">עובדים</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterManager} onValueChange={setFilterManager}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="מנהל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המנהלים</SelectItem>
                <SelectItem value="none">ללא מנהל</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>לא נמצאו משתמשים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם מלא</TableHead>
                  <TableHead>מייל</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>מנהל ישיר</TableHead>
                  <TableHead>תאריך הצטרפות</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{userProfile.email}</TableCell>
                    <TableCell>{userProfile.department}</TableCell>
                    <TableCell>{getRoleBadge(userProfile)}</TableCell>
                    <TableCell>{userProfile.manager?.full_name || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(userProfile.created_at), 'dd/MM/yyyy', { locale: he })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(userProfile)}>
                            <UserCog className="ml-2 h-4 w-4" />
                            עריכת פרטים
                          </DropdownMenuItem>
                          {!userProfile.is_manager && (
                            <DropdownMenuItem onClick={() => openTransferDialog(userProfile)}>
                              <ArrowRightLeft className="ml-2 h-4 w-4" />
                              העברה למנהל אחר
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => toggleManagerStatus(userProfile)}>
                            {userProfile.is_manager ? (
                              <>
                                <UserX className="ml-2 h-4 w-4" />
                                הסרת סטטוס מנהל
                              </>
                            ) : (
                              <>
                                <UserCheck className="ml-2 h-4 w-4" />
                                הגדרה כמנהל
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>עריכת פרטי משתמש</DialogTitle>
            <DialogDescription>
              עדכון פרטי המשתמש {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">שם מלא</Label>
              <Input
                id="full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department">מחלקה</Label>
              <Input
                id="department"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="employee_id">מספר עובד</Label>
              <Input
                id="employee_id"
                value={editForm.employee_id}
                onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button onClick={handleEditUser} disabled={submitting}>
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

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              העברת משתמש למנהל אחר
            </DialogTitle>
            <DialogDescription>
              העברת {selectedUser?.full_name} למנהל חדש
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedUser?.manager && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm text-muted-foreground">מנהל נוכחי:</p>
                <p className="font-medium">{selectedUser.manager.full_name}</p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="new_manager">מנהל חדש</Label>
              <Select value={newManagerId} onValueChange={setNewManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מנהל חדש" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא מנהל</SelectItem>
                  {managers
                    .filter(m => m.id !== selectedUser?.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button onClick={handleTransferUser} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מעביר...
                </>
              ) : (
                'העבר משתמש'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
