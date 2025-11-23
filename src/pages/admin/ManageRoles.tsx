import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, User, Loader2 } from "lucide-react";

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
  role: 'admin' | 'manager' | 'user';
}

export default function ManageRoles() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, Set<string>>>(new Map());
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

  const toggleRole = async (userId: string, role: 'admin' | 'manager') => {
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
          title: "Role Removed",
          description: `${role} role removed successfully`,
        });
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;

        toast({
          title: "Role Assigned",
          description: `${role} role assigned successfully`,
        });
      }

      // Reload users to refresh the UI
      await loadUsers();
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
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
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            User Role Management
          </CardTitle>
          <CardDescription>
            Assign or remove admin and manager roles for users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userProfile) => {
                const roles = userRoles.get(userProfile.id) || new Set();
                const isManager = roles.has('manager');
                const isAdminUser = roles.has('admin');

                return (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">{userProfile.full_name}</TableCell>
                    <TableCell>{userProfile.email}</TableCell>
                    <TableCell>{userProfile.employee_id}</TableCell>
                    <TableCell>{userProfile.department}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {isAdminUser && (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                        {isManager && (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Manager
                          </Badge>
                        )}
                        {!isAdminUser && !isManager && (
                          <Badge variant="outline" className="gap-1">
                            <User className="h-3 w-3" />
                            User
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={isAdminUser ? "destructive" : "outline"}
                          onClick={() => toggleRole(userProfile.id, 'admin')}
                          disabled={userProfile.id === user?.id}
                        >
                          {isAdminUser ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant={isManager ? "secondary" : "outline"}
                          onClick={() => toggleRole(userProfile.id, 'manager')}
                        >
                          {isManager ? "Remove Manager" : "Make Manager"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
