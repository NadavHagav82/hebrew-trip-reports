import { useState, useEffect, useRef } from "react";
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
import { UserPlus, Edit, Loader2, ArrowRight, KeyRound, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
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
import { Progress } from "@/components/ui/progress";

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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: { row: number; email: string; error: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          manager_id
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

      // Map managers to users
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const usersData = (profilesData || []).map(user => ({
        ...user,
        manager: user.manager_id && profilesMap.get(user.manager_id) 
          ? { full_name: profilesMap.get(user.manager_id)!.full_name }
          : null
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

  const downloadTemplate = () => {
    const template = [
      {
        "כתובת מייל": "example@company.com",
        "שם מלא": "ישראל ישראלי",
        "שם משתמש": "israel123",
        "מספר עובד": "12345",
        "מחלקה": "פיתוח",
        "תפקיד": "user",
        "מנהל צוות": "לא",
        "מייל מנהל": "manager@company.com"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משתמשים");
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // כתובת מייל
      { wch: 20 }, // שם מלא
      { wch: 15 }, // שם משתמש
      { wch: 12 }, // מספר עובד
      { wch: 15 }, // מחלקה
      { wch: 20 }, // תפקיד
      { wch: 12 }, // מנהל צוות
      { wch: 25 }  // מייל מנהל
    ];

    XLSX.writeFile(wb, "template_users.xlsx");
    
    toast({
      title: "טמפלייט הורד בהצלחה",
      description: "מלא את הפרטים בקובץ והעלה אותו לייבוא",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        await importUsers(jsonData);
      } catch (error) {
        console.error("Error reading file:", error);
        toast({
          title: "שגיאה בקריאת הקובץ",
          description: "אנא ודא שהקובץ בפורמט נכון",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const importUsers = async (data: any[]) => {
    setImporting(true);
    setImportProgress(0);
    setImportDialogOpen(true);
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; email: string; error: string }[]
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and we have a header

      try {
        // Validate required fields
        if (!row["כתובת מייל"] || !row["שם מלא"] || !row["שם משתמש"] || !row["מחלקה"]) {
          throw new Error("שדות חובה חסרים");
        }

        // Find manager if specified
        let managerId = null;
        if (row["מייל מנהל"]) {
          const { data: managerData } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", row["מייל מנהל"])
            .single();
          
          if (managerData) {
            managerId = managerData.id;
          }
        }

        const userData = {
          email: row["כתובת מייל"],
          full_name: row["שם מלא"],
          username: row["שם משתמש"],
          employee_id: row["מספר עובד"] || "",
          department: row["מחלקה"],
          is_manager: row["מנהל צוות"]?.toLowerCase() === "כן",
          manager_id: managerId || "",
          role: row["תפקיד"] || "user"
        };

        const { error } = await supabase.functions.invoke("create-user", {
          body: userData,
        });

        if (error) throw error;

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          email: row["כתובת מייל"] || "לא צוין",
          error: error.message || "שגיאה לא ידועה"
        });
      }

      setImportProgress(((i + 1) / data.length) * 100);
    }

    setImportResults(results);
    setImporting(false);
    loadUsers();

    toast({
      title: "ייבוא הושלם",
      description: `נוצרו ${results.success} משתמשים, ${results.failed} נכשלו`,
      variant: results.failed > 0 ? "destructive" : "default",
    });
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
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 ml-2" />
              הורד טמפלייט
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 ml-2" />
              ייבא משתמשים
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
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
                      value={formData.manager_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מנהל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא מנהל</SelectItem>
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
                  value={formData.manager_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר מנהל" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא מנהל</SelectItem>
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

      {/* Import Results Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>תוצאות ייבוא משתמשים</DialogTitle>
          </DialogHeader>
          
          {importing ? (
            <div className="space-y-4">
              <p className="text-center">מייבא משתמשים...</p>
              <Progress value={importProgress} />
              <p className="text-center text-sm text-muted-foreground">
                {Math.round(importProgress)}%
              </p>
            </div>
          ) : importResults ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                      <p className="text-sm text-muted-foreground">משתמשים נוצרו בהצלחה</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                      <p className="text-sm text-muted-foreground">נכשלו</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {importResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">שגיאות:</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {importResults.errors.map((error, idx) => (
                      <Card key={idx} className="bg-red-50">
                        <CardContent className="pt-4">
                          <p className="text-sm">
                            <strong>שורה {error.row}:</strong> {error.email}
                          </p>
                          <p className="text-sm text-red-600">{error.error}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => {
                  setImportDialogOpen(false);
                  setImportResults(null);
                }}>
                  סגור
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
