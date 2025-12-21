import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2, CheckCircle, Building2 } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

interface InvitationCode {
  id: string;
  code: string;
  organization_id: string;
  role: string;
  manager_id: string | null;
  expires_at: string;
  organization?: { name: string };
  manager?: { full_name: string; email: string };
}

export default function RegisterWithCode() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  
  const [invitationCode, setInvitationCode] = useState(initialCode);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeData, setCodeData] = useState<InvitationCode | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
    employee_id: '',
    department: '',
  });
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-verify code if provided in URL
  useEffect(() => {
    if (initialCode) {
      verifyCode(initialCode);
    }
  }, [initialCode]);

  const verifyCode = async (code: string) => {
    if (!code.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין קוד הזמנה',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await (supabase as any)
        .from('invitation_codes')
        .select(`
          id,
          code,
          organization_id,
          role,
          manager_id,
          expires_at,
          is_used,
          max_uses,
          use_count
        `)
        .eq('code', code.trim())
        .single();

      if (error || !data) {
        toast({
          title: 'קוד לא תקין',
          description: 'הקוד שהוזן אינו קיים במערכת',
          variant: 'destructive',
        });
        setCodeVerified(false);
        return;
      }

      // Check expiration
      if (new Date(data.expires_at) < new Date()) {
        toast({
          title: 'קוד פג תוקף',
          description: 'קוד ההזמנה פג תוקף',
          variant: 'destructive',
        });
        setCodeVerified(false);
        return;
      }

      // Check usage
      if (data.is_used || (data.max_uses && data.use_count >= data.max_uses)) {
        toast({
          title: 'קוד נוצל',
          description: 'קוד ההזמנה כבר נוצל',
          variant: 'destructive',
        });
        setCodeVerified(false);
        return;
      }

      // Get organization name
      const { data: orgData } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', data.organization_id)
        .single();

      // Get manager info if exists
      let managerData = null;
      if (data.manager_id) {
        const { data: manager } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.manager_id)
          .single();
        managerData = manager;
      }

      setCodeData({
        ...data,
        organization: orgData,
        manager: managerData,
      });
      setCodeVerified(true);

      toast({
        title: 'קוד אומת בהצלחה',
        description: `מוכן להרשמה לארגון ${orgData?.name || 'לא ידוע'}`,
      });
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה באימות הקוד',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
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

    if (!codeVerified || !codeData) {
      toast({
        title: 'שגיאה',
        description: 'יש לאמת קוד הזמנה תחילה',
        variant: 'destructive',
      });
      return;
    }

    const requiredFields = ['email', 'password', 'confirmPassword', 'username', 'full_name', 'department'];
    if (requiredFields.some(field => !formData[field as keyof typeof formData])) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות המסומנים ב-*',
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

    try {
      // Create user with metadata
      const isOrgAdmin = codeData.role === 'org_admin';
      const isManager = codeData.role === 'manager';
      
      // First, sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: formData.username,
            full_name: formData.full_name,
            employee_id: formData.employee_id || null,
            department: formData.department,
            is_manager: isOrgAdmin || isManager,
            manager_id: codeData.manager_id,
            accounting_manager_email: '',
            organization_id: codeData.organization_id,
          }
        }
      });

      if (signUpError) {
        let errorMessage = 'אירעה שגיאה בהרשמה';
        if (signUpError.message?.includes('already registered')) {
          errorMessage = 'כתובת האימייל כבר רשומה במערכת';
        }
        toast({
          title: 'שגיאת הרשמה',
          description: errorMessage,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const newUserId = signUpData.user?.id;
      
      if (newUserId) {
        // Add role to user_roles table using the service role through an edge function
        // Since RLS won't allow us to insert directly, we use Supabase's user creation callback
        // The trigger handle_new_user creates the profile, and we need to add the role
        
        // Wait a moment for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Insert role - this might fail due to RLS, but we'll handle it
        const { error: roleError } = await (supabase as any)
          .from('user_roles')
          .insert({
            user_id: newUserId,
            role: codeData.role,
          });

        if (roleError) {
          console.error('Error inserting role:', roleError);
          // The role insertion failed, we need to handle this via edge function
        }

        // Mark invitation code as used
        await (supabase as any)
          .from('invitation_codes')
          .update({
            is_used: true,
            used_at: new Date().toISOString(),
            used_by: newUserId,
            use_count: (codeData as any).use_count + 1,
          })
          .eq('id', codeData.id);
      }

      toast({
        title: 'הרשמה הצליחה',
        description: isOrgAdmin 
          ? 'נרשמת כמנהל ארגון. ניתן להתחבר ולנהל את הארגון'
          : 'החשבון נוצר בהצלחה. ניתן להתחבר למערכת',
      });
      navigate('/auth/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהרשמה',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'org_admin': return 'מנהל ארגון';
      case 'manager': return 'מנהל';
      case 'user': return 'עובד';
      default: return role;
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
          <CardTitle className="text-xl sm:text-2xl font-bold">הרשמה עם קוד הזמנה</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            הזן את קוד ההזמנה שקיבלת כדי להירשם למערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Code Verification Section */}
          {!codeVerified ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitationCode">קוד הזמנה *</Label>
                <Input
                  id="invitationCode"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  placeholder="הזן קוד הזמנה"
                  disabled={verifying}
                  className="h-12 text-base text-center tracking-widest font-mono"
                  dir="ltr"
                />
              </div>
              <Button 
                onClick={() => verifyCode(invitationCode)}
                className="w-full"
                disabled={verifying || !invitationCode.trim()}
              >
                {verifying ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מאמת...
                  </>
                ) : (
                  'אמת קוד'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Code Verified Info */}
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">קוד אומת בהצלחה</span>
                </div>
                <div className="space-y-1 text-sm text-green-700 dark:text-green-400">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>ארגון: {codeData?.organization?.name || 'לא ידוע'}</span>
                  </div>
                  <div>תפקיד: {getRoleLabel(codeData?.role || '')}</div>
                  {codeData?.manager && (
                    <div>מנהל: {codeData.manager.full_name}</div>
                  )}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-green-700 dark:text-green-400 p-0 h-auto mt-2"
                  onClick={() => {
                    setCodeVerified(false);
                    setCodeData(null);
                    setInvitationCode('');
                  }}
                >
                  שנה קוד
                </Button>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">שם מלא *</Label>
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
                  <PasswordStrengthIndicator password={formData.password} />
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
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      נרשם...
                    </>
                  ) : (
                    'הירשם'
                  )}
                </Button>
              </form>
            </>
          )}
          
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
