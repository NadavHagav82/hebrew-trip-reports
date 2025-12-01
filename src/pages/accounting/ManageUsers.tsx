import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Edit, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  employee_id: string | null;
  department: string;
  is_manager: boolean;
  manager_id: string | null;
  manager?: {
    full_name: string;
  } | null;
}

interface ManagerProfile {
  id: string;
  full_name: string;
  email: string | null;
}

interface UserRole {
  role: string;
}

export default function ManageUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountingManager, setIsAccountingManager] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    username: "",
    employee_id: "",
    department: "",
    is_manager: false,
    manager_id: "",
    role: "user" as "user" | "manager" | "accounting_manager",
  });

  useEffect(() => {
    checkAccountingManagerStatus();
  }, [user]);

  const checkAccountingManagerStatus = async () => {
    if (!user) return;

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "accounting_manager");

      if (!roles || roles.length === 0) {
        toast({
          title: "אין הרשאה",
          description: "רק מנהלי הנהלת חשבונות יכולים לגשת לדף זה",
          variant: "destructive",
        });
        return;
      }

      setIsAccountingManager(true);
      loadUsers();
      loadManagers();
    } catch (error) {
      console.error("Error checking accounting manager status:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          username,
          full_name,
          email,
          employee_id,
          department,
          is_manager,
          manager_id,
          manager:profiles!profiles_manager_id_fkey(full_name)
        `)
        .order("full_name");

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const rolesMap: Record<string, string[]> = {};
      rolesData?.forEach((role) => {
        if (!rolesMap[role.user_id]) {
          rolesMap[role.user_id] = [];
        }
        rolesMap[role.user_id].push(role.role);
      });

      const usersData = (profilesData || []).map(user => ({
        ...user,
        manager: Array.isArray(user.manager) && user.manager.length > 0 ? user.manager[0] : null
      }));

      setUsers(usersData);
      setUserRoles(rolesMap);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את רשימת המשתמשים",
        variant: "destructive",
      });
    }
  };

  const loadManagers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_manager", true)
        .order("full_name");

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error("Error loading managers:", error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "משתמש נוצר בהצלחה",
        description: "פרטי ההתחברות נשלחו למשתמש במייל",
      });

      setCreateDialogOpen(false);
      setFormData({
        email: "",
        full_name: "",
        username: "",
        employee_id: "",
        department: "",
        is_manager: false,
        manager_id: "",
        role: "user",
      });
      loadUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "שגיאה ביצירת משתמש",
        description: error.message || "אנא נסה שנית",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          username: formData.username,
          employee_id: formData.employee_id || null,
          department: formData.department,
          is_manager: formData.is_manager,
          manager_id: formData.manager_id || null,
        })
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Update role
      const { error: deleteRoleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id);

      if (deleteRoleError) throw deleteRoleError;

      const { error: insertRoleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUser.id,
          role: formData.role,
        });

      if (insertRoleError) throw insertRoleError;

      toast({
        title: "המשתמש עודכן בהצלחה",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "שגיאה בעדכון משתמש",
        description: error.message || "אנא נסה שנית",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      full_name: user.full_name,
      username: user.username,
      employee_id: user.employee_id || "",
      department: user.department,
      is_manager: user.is_manager,
      manager_id: user.manager_id || "",
      role: (userRoles[user.id]?.[0] as any) || "user",
    });
    setEditDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: userToReset.id },
      });

      if (error) throw error;

      toast({
        title: "הסיסמה אופסה בהצלחה",
        description: `סיסמה חדשה נשלחה ל-${userToReset.email}`,
      });

      setResetPasswordDialogOpen(false);
      setUserToReset(null);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "שגיאה באיפוס סיסמה",
        description: error.message || "אנא נסה שנית",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (userId: string) => {
    const roles = userRoles[userId] || [];
    if (roles.includes("accounting_manager")) {
      return <Badge variant="default">הנהלת חשבונות</Badge>;
    }
    if (roles.includes("manager")) {
      return <Badge variant="secondary">מנהל</Badge>;
    }
    if (roles.includes("admin")) {
      return <Badge variant="destructive">אדמין</Badge>;
    }
    return <Badge variant="outline">עובד</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAccountingManager) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4" dir="rtl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">ניהול משתמשים</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/accounting')}>
              חזרה לדשבורד
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 ml-2" />
                  יצירת משתמש חדש
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>יצירת משתמש חדש</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">כתובת מייל *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">שם מלא *</Label>
                    <Input
                      id="full_name"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">שם משתמש *</Label>
                    <Input
                      id="username"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_id">מספר עובד</Label>
                    <Input
                      id="employee_id"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">מחלקה *</Label>
                    <Input
                      id="department"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">תפקיד *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">עובד</SelectItem>
                        <SelectItem value="manager">מנהל</SelectItem>
                        <SelectItem value="accounting_manager">הנהלת חשבונות</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Switch
                    id="is_manager"
                    checked={formData.is_manager}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_manager: checked })}
                  />
                  <Label htmlFor="is_manager">מנהל צוות</Label>
                </div>
                {!formData.is_manager && (
                  <div className="space-y-2">
                    <Label htmlFor="manager_id">מנהל ישיר</Label>
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
                            {manager.full_name} ({manager.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "יצירה"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם מלא</TableHead>
                <TableHead className="text-right">מייל</TableHead>
                <TableHead className="text-right">מחלקה</TableHead>
                <TableHead className="text-right">תפקיד</TableHead>
                <TableHead className="text-right">מנהל ישיר</TableHead>
                <TableHead className="text-right w-[180px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>{getRoleBadge(user.id)}</TableCell>
                  <TableCell>
                    {user.manager ? user.manager.full_name : user.is_manager ? "מנהל צוות" : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        title="ערוך משתמש"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUserToReset(user);
                          setResetPasswordDialogOpen(true);
                        }}
                        title="אפס סיסמה"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת משתמש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_email">כתובת מייל</Label>
                <Input id="edit_email" type="email" value={formData.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">שם מלא *</Label>
                <Input
                  id="edit_full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_username">שם משתמש *</Label>
                <Input
                  id="edit_username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_employee_id">מספר עובד</Label>
                <Input
                  id="edit_employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_department">מחלקה *</Label>
                <Input
                  id="edit_department"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_role">תפקיד *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">עובד</SelectItem>
                    <SelectItem value="manager">מנהל</SelectItem>
                    <SelectItem value="accounting_manager">הנהלת חשבונות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Switch
                id="edit_is_manager"
                checked={formData.is_manager}
                onCheckedChange={(checked) => setFormData({ ...formData, is_manager: checked })}
              />
              <Label htmlFor="edit_is_manager">מנהל צוות</Label>
            </div>
            {!formData.is_manager && (
              <div className="space-y-2">
                <Label htmlFor="edit_manager_id">מנהל ישיר</Label>
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
                        {manager.full_name} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "עדכון"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirmation Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור איפוס סיסמה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך לאפס את הסיסמה עבור <strong>{userToReset?.full_name}</strong>?
              <br /><br />
              סיסמה חדשה תיווצר ותישלח למייל: <strong>{userToReset?.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetPassword}
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              אפס סיסמה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
