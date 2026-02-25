import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, User, Loader2, Search, Filter, ArrowLeft, Briefcase, Building2 } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
  organization_id: string | null;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'manager' | 'user' | 'accounting_manager' | 'org_admin';
}

interface Organization {
  id: string;
  name: string;
}

export default function ManageRoles() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, Set<string>>>(new Map());
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Org admin dialog state
  const [orgAdminDialogOpen, setOrgAdminDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    role: 'admin' | 'manager' | 'accounting_manager' | 'org_admin';
    action: 'add' | 'remove';
    userName: string;
  }>({ open: false, userId: '', role: 'admin', action: 'add', userName: '' });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const { data, error } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
      return;
    }

    if (!data) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadUsers();
    loadOrganizations();
  };

  const loadUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, employee_id, department, organization_id')
        .order('full_name');

      if (profilesError) throw profilesError;

      const usersWithEmails = (profilesData || []).map(profile => ({
        ...profile,
        email: profile.username
      }));

      setUsers(usersWithEmails);

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = new Map<string, Set<string>>();
      (rolesData || []).forEach((roleEntry: UserRole) => {
        if (!rolesMap.has(roleEntry.user_id)) {
          rolesMap.set(roleEntry.user_id, new Set());
        }
        rolesMap.get(roleEntry.user_id)!.add(roleEntry.role);
      });

      setUserRoles(rolesMap);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const openOrgAdminDialog = (userId: string) => {
    const userProfile = users.find(u => u.id === userId);
    setSelectedUserId(userId);
    setSelectedOrgId(userProfile?.organization_id || "");
    setOrgAdminDialogOpen(true);
  };

  const handleAssignOrgAdmin = async () => {
    if (!selectedUserId || !selectedOrgId) {
      toast({
        title: "שגיאה",
        description: "יש לבחור ארגון",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Add org_admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUserId, role: 'org_admin' });

      if (roleError) throw roleError;

      // Update user's organization_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: selectedOrgId })
        .eq('id', selectedUserId);

      if (profileError) throw profileError;

      toast({
        title: "תפקיד הוקצה",
        description: "המשתמש הוגדר כאדמין ארגון ושויך לארגון בהצלחה",
      });

      setOrgAdminDialogOpen(false);
      setSelectedUserId(null);
      setSelectedOrgId("");
      await loadUsers();
    } catch (error: any) {
      console.error('Error assigning org admin:', error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בהקצאת התפקיד",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'אדמין',
    manager: 'מנהל',
    accounting_manager: 'מנהל חשבונות',
    org_admin: 'אדמין ארגון'
  };

  const requestToggleRole = (userId: string, role: 'admin' | 'manager' | 'accounting_manager' | 'org_admin') => {
    // For org_admin, open dialog if adding role
    if (role === 'org_admin') {
      const currentRoles = userRoles.get(userId) || new Set();
      if (!currentRoles.has('org_admin')) {
        openOrgAdminDialog(userId);
        return;
      }
    }

    const currentRoles = userRoles.get(userId) || new Set();
    const hasRole = currentRoles.has(role);
    const userName = users.find(u => u.id === userId)?.full_name || '';

    setConfirmDialog({
      open: true,
      userId,
      role,
      action: hasRole ? 'remove' : 'add',
      userName,
    });
  };

  const executeToggleRole = async () => {
    const { userId, role, action } = confirmDialog;
    setConfirmDialog(prev => ({ ...prev, open: false }));

    try {
      if (action === 'remove') {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;

        toast({
          title: "תפקיד הוסר",
          description: `תפקיד ${roleLabels[role]} הוסר בהצלחה`,
        });
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;

        toast({
          title: "תפקיד הוקצה",
          description: `תפקיד ${roleLabels[role]} הוקצה בהצלחה`,
        });
      }

      await loadUsers();
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון תפקיד",
        variant: "destructive",
      });
    }
  };

  const getUserOrgName = (orgId: string | null) => {
    if (!orgId) return null;
    const org = organizations.find(o => o.id === orgId);
    return org?.name || null;
  };

  const filteredUsers = users.filter((userProfile) => {
    const roles = userRoles.get(userProfile.id) || new Set();
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      userProfile.full_name.toLowerCase().includes(searchLower) ||
      userProfile.email.toLowerCase().includes(searchLower) ||
      userProfile.department.toLowerCase().includes(searchLower) ||
      (userProfile.employee_id && userProfile.employee_id.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    if (roleFilter === "all") return true;
    if (roleFilter === "admin" && roles.has("admin")) return true;
    if (roleFilter === "manager" && roles.has("manager")) return true;
    if (roleFilter === "accounting_manager" && roles.has("accounting_manager")) return true;
    if (roleFilter === "org_admin" && roles.has("org_admin")) return true;
    if (roleFilter === "user" && !roles.has("admin") && !roles.has("manager") && !roles.has("accounting_manager") && !roles.has("org_admin")) return true;
    
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            ניהול תפקידים ומשתמשים
          </h1>
          <p className="text-muted-foreground mt-2">
            הקצה או הסר תפקידי אדמין, מנהל ומנהל חשבונות
          </p>
        </div>
        <Button onClick={() => navigate('/admin')} variant="outline">
          <ArrowLeft className="h-4 w-4 ml-2" />
          חזרה לאדמין
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            חיפוש וסינון
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם, מייל, מחלקה או מספר עובד..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="סנן לפי תפקיד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התפקידים</SelectItem>
                <SelectItem value="admin">אדמינים בלבד</SelectItem>
                <SelectItem value="manager">מנהלים בלבד</SelectItem>
                <SelectItem value="accounting_manager">מנהלי חשבונות בלבד</SelectItem>
                <SelectItem value="org_admin">אדמיני ארגון בלבד</SelectItem>
                <SelectItem value="user">משתמשים רגילים בלבד</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            נמצאו {filteredUsers.length} משתמשים מתוך {users.length}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6" />
            רשימת משתמשים
          </CardTitle>
          <CardDescription>
            לחץ על הכפתורים כדי להקצות או להסיר תפקידים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם מלא</TableHead>
                  <TableHead>מייל</TableHead>
                  <TableHead>מספר עובד</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>ארגון</TableHead>
                  <TableHead>תפקידים</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      לא נמצאו משתמשים תואמים
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userProfile) => {
                    const roles = userRoles.get(userProfile.id) || new Set();
                    const isManager = roles.has('manager');
                    const isAdminUser = roles.has('admin');
                    const isAccountingManager = roles.has('accounting_manager');
                    const isOrgAdmin = roles.has('org_admin');
                    const orgName = getUserOrgName(userProfile.organization_id);

                    return (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>{userProfile.employee_id || '-'}</TableCell>
                        <TableCell>{userProfile.department}</TableCell>
                        <TableCell>
                          {orgName ? (
                            <Badge variant="outline" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {orgName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {isAdminUser && (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                אדמין
                              </Badge>
                            )}
                            {isOrgAdmin && (
                              <Badge className="gap-1 bg-purple-500 hover:bg-purple-600">
                                <Building2 className="h-3 w-3" />
                                אדמין ארגון
                              </Badge>
                            )}
                            {isManager && (
                              <Badge variant="secondary" className="gap-1">
                                <Shield className="h-3 w-3" />
                                מנהל
                              </Badge>
                            )}
                            {isAccountingManager && (
                              <Badge className="gap-1 bg-blue-500 hover:bg-blue-600">
                                <Briefcase className="h-3 w-3" />
                                מנהל חשבונות
                              </Badge>
                            )}
                            {!isAdminUser && !isManager && !isAccountingManager && !isOrgAdmin && (
                              <Badge variant="outline" className="gap-1">
                                <User className="h-3 w-3" />
                                משתמש
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant={isAdminUser ? "destructive" : "outline"}
                              onClick={() => requestToggleRole(userProfile.id, 'admin')}
                              disabled={userProfile.id === user?.id}
                            >
                              {isAdminUser ? "הסר אדמין" : "הפוך לאדמין"}
                            </Button>
                            <Button
                              size="sm"
                              variant={isOrgAdmin ? "default" : "outline"}
                              onClick={() => requestToggleRole(userProfile.id, 'org_admin')}
                              className={isOrgAdmin ? "bg-purple-500 hover:bg-purple-600" : ""}
                            >
                              {isOrgAdmin ? "הסר אדמין ארגון" : "הפוך לאדמין ארגון"}
                            </Button>
                            <Button
                              size="sm"
                              variant={isManager ? "secondary" : "outline"}
                              onClick={() => requestToggleRole(userProfile.id, 'manager')}
                            >
                              {isManager ? "הסר מנהל" : "הפוך למנהל"}
                            </Button>
                            <Button
                              size="sm"
                              variant={isAccountingManager ? "default" : "outline"}
                              onClick={() => requestToggleRole(userProfile.id, 'accounting_manager')}
                              className={isAccountingManager ? "bg-blue-500 hover:bg-blue-600" : ""}
                            >
                              {isAccountingManager ? "הסר מנהל חשבונות" : "הפוך למנהל חשבונות"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Org Admin Assignment Dialog */}
      <Dialog open={orgAdminDialogOpen} onOpenChange={setOrgAdminDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              הקצאת אדמין ארגון
            </DialogTitle>
            <DialogDescription>
              בחר את הארגון שהמשתמש ינהל
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedUserId && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm text-muted-foreground">משתמש נבחר:</p>
                <p className="font-medium">
                  {users.find(u => u.id === selectedUserId)?.full_name}
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="organization">ארגון *</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר ארגון" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organizations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  אין ארגונים פעילים. יש ליצור ארגון קודם.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOrgAdminDialogOpen(false)}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleAssignOrgAdmin} 
              disabled={submitting || !selectedOrgId}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מקצה...
                </>
              ) : (
                'הקצה אדמין ארגון'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'add' ? 'הקצאת תפקיד' : 'הסרת תפקיד'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'add' 
                ? `האם אתה בטוח שברצונך להקצות את תפקיד "${roleLabels[confirmDialog.role]}" למשתמש ${confirmDialog.userName}?`
                : `האם אתה בטוח שברצונך להסיר את תפקיד "${roleLabels[confirmDialog.role]}" מהמשתמש ${confirmDialog.userName}?`
              }
              {confirmDialog.role === 'admin' && (
                <span className="block mt-2 font-semibold text-destructive">
                  ⚠️ שים לב: תפקיד אדמין מעניק גישה מלאה למערכת
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={executeToggleRole}>
              {confirmDialog.action === 'add' ? 'הקצה תפקיד' : 'הסר תפקיד'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
