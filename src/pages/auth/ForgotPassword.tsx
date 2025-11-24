import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין כתובת אימייל',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: 'מייל נשלח',
        description: 'נשלח אליך מייל עם קישור לאיפוס הסיסמה',
      });
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשליחת המייל',
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
          <CardTitle className="text-xl sm:text-2xl font-bold">
            {emailSent ? 'בדוק את המייל שלך' : 'שכחת סיסמה?'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {emailSent 
              ? 'שלחנו אליך קישור לאיפוס הסיסמה' 
              : 'הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס סיסמה'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {emailSent ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  אם חשבון עם כתובת האימייל <strong>{email}</strong> קיים במערכת, 
                  נשלח אליך מייל עם הוראות לאיפוס הסיסמה.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
              >
                שלח מייל שוב
              </Button>
              <div className="text-center">
                <Link to="/auth/login" className="text-primary hover:underline font-medium text-sm sm:text-base">
                  חזור להתחברות
                </Link>
              </div>
            </div>
          ) : (
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
                {loading ? 'שולח...' : (
                  <>
                    שלח קישור לאיפוס סיסמה
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <div className="text-center text-sm sm:text-base">
                <Link to="/auth/login" className="text-primary hover:underline font-medium">
                  חזור להתחברות
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
