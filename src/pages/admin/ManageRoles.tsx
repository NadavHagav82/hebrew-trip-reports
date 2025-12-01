import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, User, Loader2, Search, Filter, ArrowLeft, Briefcase } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'manager' | 'user' | 'accounting_manager';
}

export default function ManageRoles() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
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
  };

  const loadUsers = async () => {
    try {
      // Load all users from profiles with username as email fallback
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, employee_id, department')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Use username as email (it's usually the email)
      const usersWithEmails = (profilesData || []).map(profile => ({
        ...profile,
        email: profile.username
      }));

      setUsers(usersWithEmails);

      // Load all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Build a map of user_id -> Set of roles
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

  const toggleRole = async (userId: string, role: 'admin' | 'manager' | 'accounting_manager') => {
    try {
      const currentRoles = userRoles.get(userId) || new Set();
      const hasRole = currentRoles.has(role);

      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;

        toast({
          title: "תפקיד הוסר",
          description: `תפקיד ${role === 'admin' ? 'אדמין' : role === 'manager' ? 'מנהל' : 'מנהל חשבונות'} הוסר בהצלחה`,
        });
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;

        toast({
          title: "תפקיד הוקצה",
          description: `תפקיד ${role === 'admin' ? 'אדמין' : role === 'manager' ? 'מנהל' : 'מנהל חשבונות'} הוקצה בהצלחה`,
        });
      }

      // Reload users to refresh the UI
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

  // Filter and search logic
  const filteredUsers = users.filter((userProfile) => {
    const roles = userRoles.get(userProfile.id) || new Set();
    
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      userProfile.full_name.toLowerCase().includes(searchLower) ||
      userProfile.email.toLowerCase().includes(searchLower) ||
      userProfile.department.toLowerCase().includes(searchLower) ||
      (userProfile.employee_id && userProfile.employee_id.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // Role filter
    if (roleFilter === "all") return true;
    if (roleFilter === "admin" && roles.has("admin")) return true;
    if (roleFilter === "manager" && roles.has("manager")) return true;
    if (roleFilter === "accounting_manager" && roles.has("accounting_manager")) return true;
    if (roleFilter === "user" && !roles.has("admin") && !roles.has("manager") && !roles.has("accounting_manager")) return true;
    
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
                  <TableHead>תפקידים</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      לא נמצאו משתמשים תואמים
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userProfile) => {
                    const roles = userRoles.get(userProfile.id) || new Set();
                    const isManager = roles.has('manager');
                    const isAdminUser = roles.has('admin');
                    const isAccountingManager = roles.has('accounting_manager');

                    return (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>{userProfile.employee_id || '-'}</TableCell>
                        <TableCell>{userProfile.department}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {isAdminUser && (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                אדמין
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
                            {!isAdminUser && !isManager && !isAccountingManager && (
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
                              onClick={() => toggleRole(userProfile.id, 'admin')}
                              disabled={userProfile.id === user?.id}
                            >
                              {isAdminUser ? "הסר אדמין" : "הפוך לאדמין"}
                            </Button>
                            <Button
                              size="sm"
                              variant={isManager ? "secondary" : "outline"}
                              onClick={() => toggleRole(userProfile.id, 'manager')}
                            >
                              {isManager ? "הסר מנהל" : "הפוך למנהל"}
                            </Button>
                            <Button
                              size="sm"
                              variant={isAccountingManager ? "default" : "outline"}
                              onClick={() => toggleRole(userProfile.id, 'accounting_manager')}
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
    </div>
  );
}
