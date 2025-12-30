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
  ArrowRight, 
  Search,
  MoreHorizontal,
  UserCog,
  UserX,
  UserCheck,
  ArrowRightLeft,
  Building2,
  Filter,
  Sparkles,
  UserCircle,
  Mail,
  Briefcase,
  Calendar,
  Hash,
  Shield,
  AlertCircle,
  GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface EmployeeGrade {
  id: string;
  name: string;
  level: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  employee_id: string | null;
  is_manager: boolean;
  manager_id: string | null;
  grade_id: string | null;
  created_at: string;
  role: string | null;
  manager?: { full_name: string; email: string } | null;
  grade?: EmployeeGrade | null;
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
}

export default function OrgUsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterManager, setFilterManager] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: '',
    employee_id: '',
    grade_id: '',
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
      loadGrades(profile.organization_id);
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

      // Load grades for all users
      const { data: gradesData } = await supabase
        .from('employee_grades')
        .select('*')
        .eq('organization_id', orgId);

      const gradesMap = new Map((gradesData || []).map(g => [g.id, g]));

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
          const grade = userProfile.grade_id ? gradesMap.get(userProfile.grade_id) : null;
          return { ...userProfile, manager, grade };
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

  const loadGrades = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_grades')
        .select('id, name, level')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('level');

      if (error) throw error;
      setGrades(data || []);
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  };

  const openEditDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditForm({
      full_name: userProfile.full_name,
      department: userProfile.department,
      employee_id: userProfile.employee_id || '',
      grade_id: userProfile.grade_id || '',
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
          grade_id: editForm.grade_id || null,
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
      return <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0">מנהל ארגון</Badge>;
    }
    if (userProfile.is_manager) {
      return <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">מנהל</Badge>;
    }
    return <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">עובד</Badge>;
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

    const matchesGrade = 
      filterGrade === 'all' ||
      (filterGrade === 'none' && !u.grade_id) ||
      u.grade_id === filterGrade;

    return matchesSearch && matchesRole && matchesManager && matchesGrade;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 flex items-center justify-center shadow-lg animate-pulse">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
              <Sparkles className="w-3 h-3 text-white animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">טוען משתמשים...</p>
        </div>
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" dir="rtl">
      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/50 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950/30 p-8 shadow-lg border border-border/50">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">ניהול משתמשים</h1>
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
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <Users className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">סה"כ משתמשים</p>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">מנהלים</p>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{totalManagers}</div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">ללא מנהל משויך</p>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{usersWithoutManager}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-background border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">רשימת משתמשים</CardTitle>
                <CardDescription>ניהול כל המשתמשים בארגון</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש לפי שם, מייל או מחלקה..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[150px] h-11">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="תפקיד" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg">
                  <SelectItem value="all">כל התפקידים</SelectItem>
                  <SelectItem value="manager">מנהלים</SelectItem>
                  <SelectItem value="employee">עובדים</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterManager} onValueChange={setFilterManager}>
                <SelectTrigger className="w-[180px] h-11">
                  <SelectValue placeholder="מנהל" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg">
                  <SelectItem value="all">כל המנהלים</SelectItem>
                  <SelectItem value="none">ללא מנהל</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger className="w-[150px] h-11">
                  <GraduationCap className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="דרגה" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg">
                  <SelectItem value="all">כל הדרגות</SelectItem>
                  <SelectItem value="none">ללא דרגה</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-800/30 flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">לא נמצאו משתמשים</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  נסה לשנות את מסנני החיפוש
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y">
                  {filteredUsers.map((userProfile) => (
                    <div key={userProfile.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            userProfile.role === 'org_admin' 
                              ? 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-800/30' 
                              : userProfile.is_manager
                              ? 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-800/30'
                              : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50'
                          }`}>
                            <UserCircle className={`w-5 h-5 ${
                              userProfile.role === 'org_admin' 
                                ? 'text-purple-500' 
                                : userProfile.is_manager
                                ? 'text-blue-500'
                                : 'text-slate-500'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="font-semibold text-foreground">{userProfile.full_name}</p>
                            {getRoleBadge(userProfile)}
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="truncate">{userProfile.email || '-'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5" />
                                {userProfile.department}
                              </span>
                            </div>
                            {userProfile.manager && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Shield className="w-3.5 h-3.5" />
                                מנהל: {userProfile.manager.full_name}
                              </p>
                            )}
                            {userProfile.grade && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-800/30 text-emerald-700 dark:text-emerald-300">
                                <GraduationCap className="w-3 h-3" />
                                {userProfile.grade.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border shadow-lg">
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
                        <TableHead className="font-semibold">מייל</TableHead>
                        <TableHead className="font-semibold">מחלקה</TableHead>
                        <TableHead className="font-semibold">דרגה</TableHead>
                        <TableHead className="font-semibold">תפקיד</TableHead>
                        <TableHead className="font-semibold">מנהל ישיר</TableHead>
                        <TableHead className="font-semibold text-left">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((userProfile) => (
                        <TableRow key={userProfile.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                userProfile.role === 'org_admin' 
                                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-800/30' 
                                  : userProfile.is_manager
                                  ? 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-800/30'
                                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50'
                              }`}>
                                <UserCircle className={`w-4 h-4 ${
                                  userProfile.role === 'org_admin' 
                                    ? 'text-purple-500' 
                                    : userProfile.is_manager
                                    ? 'text-blue-500'
                                    : 'text-slate-500'
                                }`} />
                              </div>
                              <span className="font-medium">{userProfile.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell dir="ltr" className="text-right text-muted-foreground">{userProfile.email}</TableCell>
                          <TableCell>
                            <span className="text-sm px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {userProfile.department}
                            </span>
                          </TableCell>
                          <TableCell>
                            {userProfile.grade ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-800/30 text-emerald-700 dark:text-emerald-300">
                                <GraduationCap className="w-3 h-3" />
                                {userProfile.grade.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getRoleBadge(userProfile)}</TableCell>
                          <TableCell className="text-muted-foreground">{userProfile.manager?.full_name || '-'}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border shadow-lg">
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                  <UserCog className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle>עריכת פרטי משתמש</DialogTitle>
                  <DialogDescription>
                    עדכון פרטי המשתמש {selectedUser?.full_name}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">שם מלא</Label>
                <Input
                  id="full_name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">מחלקה</Label>
                <Input
                  id="department"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee_id">מספר עובד</Label>
                <Input
                  id="employee_id"
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grade_id">דרגה</Label>
                <Select 
                  value={editForm.grade_id} 
                  onValueChange={(value) => setEditForm({ ...editForm, grade_id: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="בחר דרגה" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg">
                    <SelectItem value="">ללא דרגה</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-emerald-500" />
                          {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Button 
                onClick={handleEditUser} 
                disabled={submitting}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
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

        {/* Transfer Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                  <ArrowRightLeft className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle>העברת משתמש למנהל אחר</DialogTitle>
                  <DialogDescription>
                    העברת {selectedUser?.full_name} למנהל חדש
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedUser?.manager && (
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-muted-foreground">מנהל נוכחי:</p>
                  <p className="font-medium text-foreground">{selectedUser.manager.full_name}</p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="new_manager">מנהל חדש</Label>
                <Select value={newManagerId} onValueChange={setNewManagerId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="בחר מנהל חדש" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg">
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
              <Button 
                onClick={handleTransferUser} 
                disabled={submitting}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {submitting ? (
                  <>
                    <Sparkles className="ml-2 h-4 w-4 animate-spin" />
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
    </div>
  );
}