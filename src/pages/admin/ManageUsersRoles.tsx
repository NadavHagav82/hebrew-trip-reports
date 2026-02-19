import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  UserCog, 
  ArrowRight, 
  Loader2,
  Search,
  ShieldCheck,
  Users,
  Calculator
} from "lucide-react";
import { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  department: string;
  created_at: string;
}

interface UserWithRoles extends UserProfile {
  roles: AppRole[];
}

export default function ManageUsersRoles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());

  const availableRoles: AppRole[] = ["admin", "manager", "user", "accounting_manager"];

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (u) =>
          u.full_name.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.department.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const { data, error } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (error || !data) {
      toast({
        title: "גישה נדחתה",
        description: "אין לך הרשאה לגשת לדף זה - רק אדמינים",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadUsers();
  };

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Load all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, department, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Load all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine users with their roles
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const roles = userRoles
          ?.filter((ur) => ur.user_id === profile.id)
          .map((ur) => ur.role as AppRole) || [];
        
        return {
          ...profile,
          roles,
        };
      });

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את המשתמשים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, role: AppRole, currentlyHas: boolean) => {
    // Prevent toggling for the current user if removing admin role
    if (userId === user?.id && role === 'admin' && currentlyHas) {
      toast({
        title: "לא ניתן",
        description: "לא ניתן להסיר את התפקיד admin מעצמך",
        variant: "destructive",
      });
      return;
    }

    setUpdatingRoles(prev => new Set(prev).add(`${userId}-${role}`));

    try {
      if (currentlyHas) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;

        toast({
          title: "תפקיד הוסר",
          description: `התפקיד ${getRoleLabel(role)} הוסר בהצלחה`,
        });
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;

        toast({
          title: "תפקיד נוסף",
          description: `התפקיד ${getRoleLabel(role)} נוסף בהצלחה`,
        });
      }

      // Reload users to refresh the roles
      loadUsers();
    } catch (error: any) {
      console.error('Error toggling role:', error);
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן לעדכן את התפקיד",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${userId}-${role}`);
        return newSet;
      });
    }
  };

  const getRoleLabel = (role: AppRole): string => {
    const labels: Partial<Record<AppRole, string>> = {
      admin: "אדמין",
      manager: "מנהל",
      user: "משתמש",
      accounting_manager: "מנהל הנה\"ח",
      org_admin: "מנהל ארגון",
      independent: "עצמאי",
    };
    return labels[role] ?? role;
  };

  const getRoleBadgeColor = (role: AppRole): string => {
    const colors: Partial<Record<AppRole, string>> = {
      admin: "bg-red-500/10 text-red-700 border-red-200",
      manager: "bg-blue-500/10 text-blue-700 border-blue-200",
      user: "bg-gray-500/10 text-gray-700 border-gray-200",
      accounting_manager: "bg-purple-500/10 text-purple-700 border-purple-200",
      org_admin: "bg-green-500/10 text-green-700 border-green-200",
      independent: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    };
    return colors[role] ?? "bg-gray-500/10 text-gray-700 border-gray-200";
  };

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b fixed top-0 inset-x-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <UserCog className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">ניהול תפקידי משתמשים</h1>
                <p className="text-sm text-muted-foreground">הוסף והסר תפקידים למשתמשים במערכת</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              חזרה לדשבורד אדמין
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-8" dir="rtl">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ משתמשים</p>
                  <p className="text-3xl font-bold text-primary">{users.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">אדמינים</p>
                  <p className="text-3xl font-bold text-red-600">
                    {users.filter(u => u.roles.includes('admin')).length}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-red-600/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">מנהלים</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {users.filter(u => u.roles.includes('manager')).length}
                  </p>
                </div>
                <ShieldCheck className="w-8 h-8 text-blue-600/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">מנהלי הנה"ח</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {users.filter(u => u.roles.includes('accounting_manager')).length}
                  </p>
                </div>
                <Calculator className="w-8 h-8 text-purple-600/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              חיפוש משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="חפש לפי שם, אימייל, מחלקה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>משתמשים ותפקידיהם</CardTitle>
            <CardDescription>
              לחץ על המתגים כדי להוסיף או להסיר תפקידים למשתמשים
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">לא נמצאו משתמשים</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "נסה לשנות את מילות החיפוש" : "אין משתמשים במערכת"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">משתמש</TableHead>
                      <TableHead>מחלקה</TableHead>
                      <TableHead className="text-center">אדמין</TableHead>
                      <TableHead className="text-center">מנהל</TableHead>
                      <TableHead className="text-center">משתמש</TableHead>
                      <TableHead className="text-center">מנהל הנה"ח</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{userProfile.full_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {userProfile.email || userProfile.username}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{userProfile.department}</Badge>
                        </TableCell>
                        {availableRoles.map((role) => {
                          const hasRole = userProfile.roles.includes(role);
                          const isUpdating = updatingRoles.has(`${userProfile.id}-${role}`);
                          const isCurrentUserRemovingAdmin = 
                            userProfile.id === user?.id && role === 'admin' && hasRole;

                          return (
                            <TableCell key={role} className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={hasRole}
                                  onCheckedChange={() => toggleRole(userProfile.id, role, hasRole)}
                                  disabled={isUpdating || isCurrentUserRemovingAdmin}
                                />
                                {isUpdating && (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>מקרא תפקידים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableRoles.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Badge className={getRoleBadgeColor(role)}>
                    {getRoleLabel(role)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {role === 'admin' && '- גישה מלאה למערכת'}
                    {role === 'manager' && '- אישור דוחות ותצוגת צוות'}
                    {role === 'user' && '- יצירת דוחות בלבד'}
                    {role === 'accounting_manager' && '- ניהול כספים וניתוחים'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
