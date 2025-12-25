import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2 sm:mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">כניסה למערכת</CardTitle>
          <CardDescription className="text-sm sm:text-base">מערכת דוחות נסיעה עסקית</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="הזן את כתובת האימייל"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">סיסמה</Label>
              <Input
                id="password"
                type="password"
                placeholder="הזן סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 text-base"
              />
            </div>
            <div className="flex items-center justify-between mb-2">
              <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
                שכחת סיסמה?
              </Link>
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? 'מתחבר...' : 'התחבר'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm sm:text-base">
            <span className="text-muted-foreground">עדיין אין לך חשבון? </span>
            <Link to="/auth/register" className="text-primary hover:underline font-medium">
              הירשם כאן
            </Link>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            <span>מנהל חשבונות ראשון? </span>
            <Link to="/auth/register/bootstrap" className="text-primary hover:underline">
              הקמה ראשונית
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
