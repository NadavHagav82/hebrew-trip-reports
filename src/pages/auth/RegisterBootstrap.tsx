import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RegisterBootstrap() {
  const [formData, setFormData] = useState({
    bootstrapToken: '',
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
    department: '',
  });
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [accountingManagerExists, setAccountingManagerExists] = useState<boolean | null>(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkExistingAccountingManager();
  }, []);

  const checkExistingAccountingManager = async () => {
    try {
      const { data, error } = await supabase.rpc('accounting_manager_exists');

      if (error) throw error;
      
      setAccountingManagerExists(data === true);
    } catch (error) {
      console.error('Error checking accounting manager:', error);
      // If there's an error checking, assume no accounting manager exists
      // This allows the bootstrap process to proceed
      setAccountingManagerExists(false);
    }
  };

  const validateToken = async (token: string) => {
    if (!token.trim()) {
      setTokenValid(null);
      return;
    }

    setValidatingToken(true);
    try {
      const { data, error } = await supabase
        .from('bootstrap_tokens')
        .select('id, is_used, expires_at')
        .eq('token', token.trim())
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      
      setTokenValid(!!data);
      
      if (!data) {
        toast({
          title: 'קוד לא תקין',
          description: 'הקוד שהוזן לא קיים, כבר נוצל, או שפג תוקפו',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setTokenValid(false);
    } finally {
      setValidatingToken(false);
    }
  };

  const handleTokenBlur = () => {
    if (formData.bootstrapToken) {
      validateToken(formData.bootstrapToken);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'bootstrapToken') {
      setTokenValid(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    const requiredFields = ['bootstrapToken', 'email', 'password', 'confirmPassword', 'username', 'full_name', 'department'];
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

    // Final token validation
    setLoading(true);
    
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('bootstrap_tokens')
        .select('id, is_used')
        .eq('token', formData.bootstrapToken.trim())
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) {
        toast({
          title: 'קוד הזמנה לא תקין',
          description: 'הקוד שהוזן לא קיים, כבר נוצל, או שפג תוקפו',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Create user account
      const { error: signUpError } = await signUp(formData.email, formData.password, {
        username: formData.username,
        full_name: formData.full_name,
        employee_id: null,
        department: formData.department,
        is_manager: true,
        manager_id: null,
        accounting_manager_email: null,
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

      // Wait a bit for the profile to be created by the trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the newly created user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Failed to get user after signup');
      }

      // Insert accounting_manager role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'accounting_manager'
        });

      if (roleError) throw roleError;

      // Mark token as used
      const { error: updateError } = await supabase
        .from('bootstrap_tokens')
        .update({
          is_used: true,
          used_by: user.id,
          used_at: new Date().toISOString()
        })
        .eq('id', tokenData.id);

      if (updateError) {
        console.error('Error marking token as used:', updateError);
      }

      toast({
        title: 'הרשמה הצליחה!',
        description: 'חשבון מנהל החשבונות נוצר בהצלחה. מעביר אותך להתחברות...',
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => navigate('/auth/login'), 2000);

    } catch (error: any) {
      console.error('Error during bootstrap registration:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בתהליך ההרשמה',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  if (accountingManagerExists === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  if (accountingManagerExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">הגישה נחסמה</CardTitle>
            <CardDescription>
              כבר קיים מנהל חשבונות במערכת. דף זה מיועד רק להקמה ראשונית.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                אם אתה זקוק למנהל חשבונות נוסף, פנה למנהל החשבונות הקיים במערכת שיוכל ליצור עבורך חשבון דרך דף "ניהול משתמשים".
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/auth/register')}
              >
                חזרה להרשמה
              </Button>
              <Button 
                className="flex-1"
                onClick={() => navigate('/auth/login')}
              >
                כניסה למערכת
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2 sm:mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">הקמת מנהל חשבונות ראשון</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            דף זה מיועד להקמה ראשונית של מנהל החשבונות הראשון במערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>חשוב:</strong> קוד ההקמה הראשוני הוא חד-פעמי ומאובטח. לאחר השימוש בו, לא ניתן יהיה להשתמש בדף זה שוב.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bootstrapToken" className="text-base">
                קוד הקמה ראשוני *
              </Label>
              <div className="relative">
                <Input
                  id="bootstrapToken"
                  name="bootstrapToken"
                  placeholder="BOOTSTRAP-XXXX-XXXX"
                  value={formData.bootstrapToken}
                  onChange={handleChange}
                  onBlur={handleTokenBlur}
                  disabled={loading}
                  className={`h-12 text-base font-mono ${
                    tokenValid === true ? 'border-green-500' : 
                    tokenValid === false ? 'border-destructive' : ''
                  }`}
                />
                {validatingToken && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                הזן את קוד ההקמה הראשוני שקיבלת ממנהל המערכת
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
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
                <Label htmlFor="department">מחלקה *</Label>
                <Input
                  id="department"
                  name="department"
                  placeholder="למשל: הנהלת חשבונות"
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
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || tokenValid === false}
            >
              {loading ? 'יוצר חשבון...' : 'צור מנהל חשבונות'}
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
