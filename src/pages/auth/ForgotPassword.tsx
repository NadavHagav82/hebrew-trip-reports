import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, ArrowRight } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כתובת האימייל',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בשליחת המייל. אנא נסה שוב.',
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      setEmailSent(true);
      toast({
        title: 'המייל נשלח בהצלחה',
        description: 'בדוק את תיבת הדואר שלך להמשך התהליך',
      });
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
          <CardTitle className="text-xl sm:text-2xl font-bold">איפוס סיסמה</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {emailSent 
              ? 'נשלח לך מייל עם קישור לאיפוס הסיסמה'
              : 'הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {!emailSent ? (
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
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center text-muted-foreground">
                בדוק את תיבת הדואר שלך ולחץ על הקישור שנשלח כדי לאפס את הסיסמה
              </div>
              <Button asChild className="w-full h-12 text-base">
                <Link to="/auth/login">
                  חזור לכניסה
                  <ArrowRight className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
          <div className="mt-4 text-center text-sm sm:text-base">
            <Link to="/auth/login" className="text-primary hover:underline font-medium">
              חזור לכניסה
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
