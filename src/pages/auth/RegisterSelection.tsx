import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, BriefcaseBusiness, Ticket, User } from 'lucide-react';

export default function RegisterSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">הרשמה למערכת</h1>
          <p className="text-muted-foreground">בחר את סוג המשתמש שלך</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Employee Registration */}
          <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-lg group">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl">הרשמה כעובד</CardTitle>
                <CardDescription className="text-sm mt-2">
                  אני עובד במערכת ואני מגיש דוחות נסיעה
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>יצירת דוחות נסיעה והוצאות</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>שליחה לאישור מנהל</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>מעקב אחר סטטוס הדוחות</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => navigate('/auth/register/employee')}
              >
                המשך כעובד
              </Button>
            </CardContent>
          </Card>

          {/* Independent User Registration */}
          <Card className="cursor-pointer hover:border-green-500 transition-all hover:shadow-lg group">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <User className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl">משתמש עצמאי</CardTitle>
                <CardDescription className="text-sm mt-2">
                  אני עצמאי ושולח דוחות ישירות להנה"ח
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>דוחות ללא צורך באישור מנהל</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>גישה מלאה לסטטיסטיקות</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>שליחה ישירה להנהלת חשבונות</span>
                </li>
              </ul>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700" 
                size="lg"
                onClick={() => navigate('/auth/register/independent')}
              >
                המשך כעצמאי
              </Button>
            </CardContent>
          </Card>

          {/* Manager Registration */}
          <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-lg group">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <BriefcaseBusiness className="w-10 h-10 text-secondary-foreground" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl">הרשמה כמנהל</CardTitle>
                <CardDescription className="text-sm mt-2">
                  אני מנהל צוות ומאשר דוחות נסיעה
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-secondary-foreground mt-1">•</span>
                  <span>אישור דוחות של העובדים</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary-foreground mt-1">•</span>
                  <span>הצגת דוחות הצוות</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary-foreground mt-1">•</span>
                  <span>דוחות אישיים ללא צורך באישור</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                variant="secondary"
                onClick={() => navigate('/auth/register/manager')}
              >
                המשך כמנהל
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-2">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Ticket className="w-5 h-5 text-primary" />
              <span className="font-medium">יש לך קוד הזמנה?</span>
            </div>
            <Link 
              to="/auth/register/code" 
              className="text-primary hover:underline font-medium"
            >
              לחץ כאן להרשמה עם קוד הזמנה
            </Link>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">כבר יש לך חשבון? </span>
            <Link to="/auth/login" className="text-primary hover:underline font-medium">
              התחבר כאן
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">
            <span>מנהל חשבונות ראשון במערכת? </span>
            <Link to="/auth/register/bootstrap" className="text-primary hover:underline font-medium">
              הקמה ראשונית
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
