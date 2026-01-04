import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plane, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        toast({
          title: 'שגיאה',
          description: 'לא הצלחנו להתחבר עם Google',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בהתחברות עם Google',
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ms)
      ),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // נותנים יותר זמן כדי למנוע false-timeout בזמן cold-start
      const { error } = await withTimeout(signIn(email, password), 25_000);

      if (error) {
        const msg = typeof error.message === 'string' ? error.message : '';
        const lower = msg.toLowerCase();
        const isNetworkError = lower.includes('failed to fetch') || lower.includes('network');

        toast({
          title: isNetworkError ? 'שגיאת שרת' : 'שגיאת התחברות',
          description: isNetworkError
            ? 'לא הצלחנו להתחבר לשרת. נסה שוב בעוד רגע (לעיתים לוקח זמן להתעורר).'
            : 'שם משתמש או סיסמה שגויים',
          variant: 'destructive',
        });
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const isTimeout = err?.message === 'timeout';
      toast({
        title: isTimeout ? 'התחברות לוקחת זמן' : 'שגיאה',
        description: isTimeout
          ? 'השרת לא הגיב בזמן (ייתכן שהוא מתעורר). נסה שוב בעוד רגע או בדוק חיבור.'
          : 'אירעה שגיאה לא צפויה. נסה שוב.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-background to-indigo-50 dark:from-blue-950/20 dark:via-background dark:to-indigo-950/20 p-3 sm:p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-500/5 rounded-lg" />
        
        <CardHeader className="text-center space-y-4 relative">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-primary to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-300">
                <Plane className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-card flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              כניסה למערכת
            </CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2 text-muted-foreground">
              מערכת דוחות נסיעה עסקית
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-6 sm:px-8 pb-8 relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">אימייל</Label>
              <div className="relative group">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="הזן את כתובת האימייל"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-12 text-base pr-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">סיסמה</Label>
              <div className="relative group">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="הזן סיסמה"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 text-base pr-10 pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Link 
                to="/auth/forgot-password" 
                className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                שכחת סיסמה?
              </Link>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 via-primary to-indigo-600 hover:from-blue-600 hover:via-primary hover:to-indigo-700 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  מתחבר...
                </span>
              ) : (
                'התחבר'
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium border-border/50 hover:bg-muted/50 transition-all"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  התחבר עם Google
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="text-center text-sm sm:text-base">
              <span className="text-muted-foreground">עדיין אין לך חשבון? </span>
              <Link 
                to="/auth/register" 
                className="text-primary hover:text-primary/80 font-semibold hover:underline transition-colors"
              >
                הירשם כאן
              </Link>
            </div>
            <div className="mt-3 text-center text-xs text-muted-foreground">
              <span>מנהל חשבונות ראשון? </span>
              <Link 
                to="/auth/register/bootstrap" 
                className="text-primary/70 hover:text-primary hover:underline transition-colors"
              >
                הקמה ראשונית
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
