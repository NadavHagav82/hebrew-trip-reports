import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2 } from 'lucide-react';

interface Manager {
  id: string;
  full_name: string;
  email: string;
}

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
    employee_id: '',
    department: '',
    is_manager: false,
    manager_id: '',
    accounting_manager_email: '',
  });
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('is_manager', true)
        .order('full_name');

      if (error) throw error;
      
      setManagers(data.map(m => ({ 
        id: m.id, 
        full_name: m.full_name, 
        email: m.username 
      })));
    } catch (error) {
      console.error('Error loading managers:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון רשימת מנהלים',
        variant: 'destructive',
      });
    } finally {
      setLoadingManagers(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for required fields
    const requiredFields = ['email', 'password', 'confirmPassword', 'username', 'full_name', 'department'];
    if (requiredFields.some(field => !formData[field as keyof typeof formData])) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות המסומנים ב-*',
        variant: 'destructive',
      });
      return;
    }

    // Validate manager selection for non-managers
    if (!formData.is_manager && !formData.manager_id) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור מנהל מאשר מהרשימה',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמה חייבת להכיל לפחות 8 תווים',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמאות אינן תואמות',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(formData.email, formData.password, {
      username: formData.username,
      full_name: formData.full_name,
      employee_id: formData.employee_id || null,
      department: formData.department,
      is_manager: formData.is_manager,
      manager_id: formData.is_manager ? null : formData.manager_id,
      accounting_manager_email: formData.accounting_manager_email || null,
    });

    if (error) {
      let errorMessage = 'אירעה שגיאה בהרשמה';
      if (error.message?.includes('already registered')) {
        errorMessage = 'כתובת האימייל כבר רשומה במערכת';
      }
      toast({
        title: 'שגיאת הרשמה',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      toast({
        title: 'הרשמה הצליחה',
        description: 'החשבון נוצר בהצלחה. ניתן להתחבר למערכת',
      });
      navigate('/auth/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2 sm:mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">הרשמה למערכת</CardTitle>
          <CardDescription className="text-sm sm:text-base">צור חשבון חדש במערכת דוחות הנסיעה</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-base">שם מלא *</Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="הזן שם מלא"
                value={formData.full_name}
                onChange={handleChange}
                disabled={loading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">שם משתמש *</Label>
              <Input
                id="username"
                name="username"
                placeholder="הזן שם משתמש"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="הזן כתובת אימייל"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_id">מספר עובד (אופציונלי)</Label>
              <Input
                id="employee_id"
                name="employee_id"
                placeholder="הזן מספר עובד"
                value={formData.employee_id}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">מחלקה *</Label>
              <Input
                id="department"
                name="department"
                placeholder="הזן שם מחלקה"
                value={formData.department}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accounting_manager_email">
                מייל הנהלת חשבונות (אופציונלי)
              </Label>
              <Input
                id="accounting_manager_email"
                name="accounting_manager_email"
                type="email"
                placeholder="accounting@company.com"
                value={formData.accounting_manager_email}
                onChange={handleChange}
                disabled={loading}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                דוחות מאושרים יישלחו אוטומטית לכתובת זו. עדכונים על דוחות יישלחו למייל הרישום שלך.
              </p>
            </div>
            
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="is_manager" 
                  checked={formData.is_manager}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_manager: checked as boolean }))}
                  disabled={loading}
                />
                <Label htmlFor="is_manager" className="font-medium cursor-pointer">
                  אני מנהל (דוחות שלי לא דורשים אישור)
                </Label>
              </div>
              
              {!formData.is_manager && (
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground font-medium">בחירת מנהל מאשר *</p>
                  {loadingManagers ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      טוען רשימת מנהלים...
                    </div>
                  ) : managers.length === 0 ? (
                    <div className="p-4 text-sm bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                        לא נמצאו מנהלים במערכת
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        אנא פנה למנהל המערכת להוספת מנהל ראשון. לאחר מכן תוכל להירשם כעובד.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select 
                        value={formData.manager_id} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, manager_id: value }))}
                        disabled={loading}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="בחר מנהל מהרשימה" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50 max-h-[200px]">
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.full_name} ({manager.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        בחר את המנהל הישיר שלך מרשימת המנהלים הרשומים במערכת. 
                        רק מנהלים רשומים יכולים לאשר דוחות.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="לפחות 8 תווים"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="הזן סיסמה שוב"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || (loadingManagers && !formData.is_manager) || (!formData.is_manager && managers.length === 0)}
            >
              {loading ? 'נרשם...' : 'הירשם'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">כבר יש לך חשבון? </span>
            <Link to="/auth/login" className="text-primary hover:underline font-medium">
              התחבר כאן
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
