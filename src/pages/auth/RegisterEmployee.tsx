import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Check, ChevronsUpDown, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function RegisterEmployee() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
    employee_id: '',
    department: '',
    manager_email: '',
    accounting_manager_email: '',
    organization_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Array<{ id: string; email: string; full_name: string }>>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [openManagerCombobox, setOpenManagerCombobox] = useState(false);
  const [manualManagerEntry, setManualManagerEntry] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load managers and organizations
  useEffect(() => {
    const loadManagers = async () => {
      setLoadingManagers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('is_manager', true)
          .order('full_name');

        if (error) throw error;
        setManagers(data || []);
      } catch (error) {
        console.error('Error loading managers:', error);
      } finally {
        setLoadingManagers(false);
      }
    };

    const loadOrganizations = async () => {
      setLoadingOrgs(true);
      try {
        const { data, error }: any = await (supabase as any)
          .from('organizations')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setOrganizations(data || []);
      } catch (error) {
        console.error('Error loading organizations:', error);
      } finally {
        setLoadingOrgs(false);
      }
    };

    loadManagers();
    loadOrganizations();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields = ['email', 'password', 'confirmPassword', 'username', 'full_name', 'department', 'manager_email'];
    if (requiredFields.some(field => !formData[field as keyof typeof formData])) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות המסומנים ב-*',
        variant: 'destructive',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.manager_email)) {
      toast({
        title: 'שגיאה',
        description: 'כתובת המייל של המנהל אינה תקינה',
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

    // Find manager by email
    const normalizedManagerEmail = formData.manager_email.trim();
    const { data: managerData, error: managerError } = await supabase
      .from('profiles')
      .select('id, is_manager')
      .ilike('email', normalizedManagerEmail)
      .eq('is_manager', true)
      .maybeSingle();

    if (managerError || !managerData) {
      toast({
        title: 'שגיאה',
        description: 'לא נמצא מנהל עם כתובת המייל שהוזנה',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const { error } = await signUp(formData.email, formData.password, {
      username: formData.username,
      full_name: formData.full_name,
      employee_id: formData.employee_id || null,
      department: formData.department,
      is_manager: false,
      manager_id: managerData.id,
      accounting_manager_email: formData.accounting_manager_email || null,
      organization_id: formData.organization_id || null,
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
      // Send notification to manager
      try {
        await supabase.functions.invoke('notify-manager-new-employee', {
          body: {
            employeeName: formData.full_name,
            employeeEmail: formData.email,
            employeeId: formData.employee_id || null,
            department: formData.department,
            managerId: managerData.id,
          }
        });
      } catch (emailError) {
        console.error('Failed to send manager notification:', emailError);
      }

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
          <CardTitle className="text-xl sm:text-2xl font-bold">הרשמה כעובד</CardTitle>
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
              <Label htmlFor="organization_id">ארגון (אופציונלי)</Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, organization_id: value }))}
                disabled={loading || loadingOrgs}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={loadingOrgs ? "טוען..." : "בחר ארגון"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                דוחות מאושרים יישלחו אוטומטית לכתובת זו
              </p>
            </div>
            
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="manager_email">מייל מנהל מאשר *</Label>
              {!manualManagerEntry ? (
                <>
                  <Popover open={openManagerCombobox} onOpenChange={setOpenManagerCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openManagerCombobox}
                        className="w-full justify-between h-12 text-base"
                        disabled={loading || loadingManagers}
                      >
                        {formData.manager_email || "בחר מנהל מאשר..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="חפש מנהל..." dir="rtl" />
                        <CommandList>
                          <CommandEmpty>לא נמצאו מנהלים</CommandEmpty>
                          <CommandGroup>
                            {managers.map((manager) => (
                              <CommandItem
                                key={manager.id}
                                value={manager.email}
                                onSelect={(currentValue) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    manager_email: currentValue === formData.manager_email ? "" : currentValue
                                  }));
                                  setOpenManagerCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.manager_email === manager.email ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{manager.full_name}</span>
                                  <span className="text-sm text-muted-foreground">{manager.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={() => {
                      setManualManagerEntry(true);
                      setFormData(prev => ({ ...prev, manager_email: '' }));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    המנהל שלי לא ברשימה - הזן ידנית
                  </button>
                </>
              ) : (
                <>
                  <Input
                    id="manager_email"
                    name="manager_email"
                    type="email"
                    placeholder="הזן מייל מנהל"
                    value={formData.manager_email}
                    onChange={handleChange}
                    disabled={loading}
                    dir="ltr"
                    className="h-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setManualManagerEntry(false);
                      setFormData(prev => ({ ...prev, manager_email: '' }));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    חזור לבחירה מהרשימה
                  </button>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {manualManagerEntry 
                  ? "הזן את כתובת המייל של המנהל הישיר שלך"
                  : "בחר את המנהל הישיר שלך מהרשימה"}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה *</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="לפחות 8 תווים"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  className="pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="הזן סיסמה שוב"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  className="pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'נרשם...' : 'הירשם'}
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            <div className="text-center text-sm">
              <button
                onClick={() => navigate('/auth/register')}
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <ArrowRight className="h-4 w-4" />
                חזור לבחירת סוג משתמש
              </button>
            </div>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">כבר יש לך חשבון? </span>
              <Link to="/auth/login" className="text-primary hover:underline font-medium">
                התחבר כאן
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
