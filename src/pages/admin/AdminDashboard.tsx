import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  UserCheck, 
  Key, 
  Settings,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileText,
  UserCog
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalManagers: number;
  totalAdmins: number;
  totalBootstrapTokens: number;
  activeBootstrapTokens: number;
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  department: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalManagers: 0,
    totalAdmins: 0,
    totalBootstrapTokens: 0,
    activeBootstrapTokens: 0,
  });
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

    if (error || !data) {
      toast({
        title: "גישה נדחתה",
        description: "אין לך הרשאה לגשת לדף זה",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      // Load total users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Load managers and admins count
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role');

      const managersCount = rolesData?.filter(r => r.role === 'manager').length || 0;
      const adminsCount = rolesData?.filter(r => r.role === 'admin').length || 0;

      // Load bootstrap tokens stats
      const { count: totalTokens } = await supabase
        .from('bootstrap_tokens')
        .select('*', { count: 'exact', head: true });

      const { count: activeTokens } = await supabase
        .from('bootstrap_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      setStats({
        totalUsers: usersCount || 0,
        totalManagers: managersCount,
        totalAdmins: adminsCount,
        totalBootstrapTokens: totalTokens || 0,
        activeBootstrapTokens: activeTokens || 0,
      });

      // Load recent users
      const { data: recentUsersData } = await supabase
        .from('profiles')
        .select('id, username, full_name, department, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentUsersData) {
        setRecentUsers(recentUsersData.map(u => ({ ...u, email: u.username })));
      }

      // Load managers list
      const { data: managerIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      if (managerIds && managerIds.length > 0) {
        const { data: managersData } = await supabase
          .from('profiles')
          .select('id, username, full_name, department, created_at')
          .in('id', managerIds.map(m => m.user_id));

        if (managersData) {
          setManagers(managersData.map(u => ({ ...u, email: u.username })));
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בטעינת הנתונים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    <div className="container mx-auto py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            לוח בקרה מנהל מערכת
          </h1>
          <p className="text-muted-foreground mt-2">
            ניהול מלא של המערכת, משתמשים ותפקידים
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          חזרה לדף הבית
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סך המשתמשים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מנהלים</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalManagers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">אדמינים</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAdmins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">קודי הקמה פעילים</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeBootstrapTokens} / {stats.totalBootstrapTokens}
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={() => navigate('/admin/manage-users')}
          >
            <UserCog className="h-6 w-6" />
            <span>ניהול תפקידי משתמשים</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={() => navigate('/admin/roles')}
          >
            <Shield className="h-6 w-6" />
            <span>ניהול תפקידים</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={() => navigate('/accounting/bootstrap-tokens')}
          >
            <Key className="h-6 w-6" />
            <span>קודי הקמה</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={() => navigate('/accounting/users')}
          >
            <Users className="h-6 w-6" />
            <span>ניהול משתמשים</span>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Users and Managers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                משתמשים אחרונים
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/accounting/users')}
              >
                הצג הכל
                <ArrowRight className="h-4 w-4 mr-1" />
              </Button>
            </CardTitle>
            <CardDescription>5 המשתמשים האחרונים שנרשמו</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>תאריך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('he-IL')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Managers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                מנהלים במערכת
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin/roles')}
              >
                נהל תפקידים
                <ArrowRight className="h-4 w-4 mr-1" />
              </Button>
            </CardTitle>
            <CardDescription>כל המנהלים הרשומים במערכת</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      אין מנהלים במערכת
                    </TableCell>
                  </TableRow>
                ) : (
                  managers.map((manager) => (
                    <TableRow key={manager.id}>
                      <TableCell className="font-medium">{manager.full_name}</TableCell>
                      <TableCell>{manager.department}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Shield className="h-3 w-3 ml-1" />
                          מנהל
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
