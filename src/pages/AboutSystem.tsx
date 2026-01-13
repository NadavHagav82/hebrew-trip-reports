import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  Users,
  FileText,
  Plane,
  BarChart3,
  Calculator,
  Building2,
  Shield,
  Bell,
  Mail,
  Sparkles,
  Globe,
  Smartphone,
  Lock,
  FileDown,
  Palette,
  CheckCircle,
  Receipt,
  CreditCard,
  Clock,
  UserCheck,
  Settings,
  GitBranch,
  Ban,
  Hotel,
  Utensils,
  Car,
  Package,
  Camera,
  Wifi,
  Languages,
  Moon
} from 'lucide-react';

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeatureCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  features: FeatureItem[];
}

const featureCategories: FeatureCategory[] = [
  {
    id: 'users',
    title: 'סוגי משתמשים',
    icon: <Users className="w-5 h-5" />,
    color: 'from-blue-500 to-indigo-600',
    features: [
      { icon: <Users className="w-4 h-4" />, title: 'עובד רגיל', description: 'יצירת דוחות הוצאות, הגשת בקשות נסיעה, צפייה בהיסטוריה' },
      { icon: <UserCheck className="w-4 h-4" />, title: 'מנהל', description: 'אישור דוחות ובקשות נסיעה, צפייה בסטטיסטיקות הצוות' },
      { icon: <Calculator className="w-4 h-4" />, title: 'הנהלת חשבונות', description: 'ניהול כל הדוחות, אנליטיקות, ניהול משתמשים' },
      { icon: <Building2 className="w-4 h-4" />, title: 'מנהל ארגון', description: 'הגדרת מדיניות נסיעות, ניהול קודי הזמנה' },
      { icon: <Shield className="w-4 h-4" />, title: 'מנהל מערכת', description: 'גישה מלאה לכל הנתונים והגדרות' },
    ]
  },
  {
    id: 'reports',
    title: 'דוחות הוצאות',
    icon: <FileText className="w-5 h-5" />,
    color: 'from-emerald-500 to-teal-600',
    features: [
      { icon: <Receipt className="w-4 h-4" />, title: 'יצירת דוחות', description: 'יצירת דוחות הוצאות עם פרטי נסיעה מלאים' },
      { icon: <Sparkles className="w-4 h-4" />, title: 'זיהוי קבלות AI', description: 'סריקה אוטומטית של קבלות וחילוץ נתונים' },
      { icon: <Globe className="w-4 h-4" />, title: '50+ מטבעות', description: 'תמיכה ביותר מ-50 מטבעות עם המרה אוטומטית' },
      { icon: <CreditCard className="w-4 h-4" />, title: 'קצבת יומית', description: 'חישוב אוטומטי לפי מדינה ($100 או $125)' },
      { icon: <Clock className="w-4 h-4" />, title: 'שמירה אוטומטית', description: 'שמירת טיוטה אוטומטית - אין צורך ללחוץ שמור' },
      { icon: <FileDown className="w-4 h-4" />, title: 'ייצוא PDF', description: 'ייצוא דוחות לקובץ PDF מעוצב' },
    ]
  },
  {
    id: 'travel',
    title: 'בקשות נסיעה',
    icon: <Plane className="w-5 h-5" />,
    color: 'from-violet-500 to-purple-600',
    features: [
      { icon: <Plane className="w-4 h-4" />, title: 'בקשות נסיעה', description: 'הגשת בקשות נסיעה עם אומדן עלויות' },
      { icon: <Hotel className="w-4 h-4" />, title: 'אומדן לינה', description: 'הערכת עלות לינה ללילה' },
      { icon: <Utensils className="w-4 h-4" />, title: 'אומדן ארוחות', description: 'הערכת עלות ארוחות ליום' },
      { icon: <Car className="w-4 h-4" />, title: 'אומדן תחבורה', description: 'הערכת עלויות תחבורה מקומית' },
      { icon: <GitBranch className="w-4 h-4" />, title: 'שרשרת אישורים', description: 'אישורים מרובי רמות לפי הגדרות הארגון' },
      { icon: <Shield className="w-4 h-4" />, title: 'בדיקת מדיניות', description: 'התראה אוטומטית על חריגות ממדיניות' },
    ]
  },
  {
    id: 'policy',
    title: 'מדיניות נסיעות',
    icon: <Shield className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-600',
    features: [
      { icon: <Users className="w-4 h-4" />, title: 'דרגות עובדים', description: 'הגדרת דרגות עם תקציבים שונים' },
      { icon: <GitBranch className="w-4 h-4" />, title: 'שרשראות אישורים', description: 'הגדרת מי מאשר ובאיזה סדר' },
      { icon: <Package className="w-4 h-4" />, title: 'חוקי קטגוריות', description: 'תקרות לטיסות, מלונות, ארוחות ותחבורה' },
      { icon: <Ban className="w-4 h-4" />, title: 'הגבלות', description: 'מדינות אסורות, חברות מועדפות' },
      { icon: <Sparkles className="w-4 h-4" />, title: 'חוקים מותאמים', description: 'כללים ייחודיים לארגון' },
      { icon: <Clock className="w-4 h-4" />, title: 'יומן שינויים', description: 'מעקב אחר כל השינויים במדיניות' },
    ]
  },
  {
    id: 'analytics',
    title: 'אנליטיקות',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-600',
    features: [
      { icon: <BarChart3 className="w-4 h-4" />, title: 'סטטיסטיקות', description: 'ניתוח הוצאות לפי קטגוריה, זמן ומחלקה' },
      { icon: <Users className="w-4 h-4" />, title: 'דוחות צוות', description: 'צפייה בהוצאות הצוות למנהלים' },
      { icon: <Building2 className="w-4 h-4" />, title: 'אנליטיקות ארגוניות', description: 'ניתוח מעמיק ברמת הארגון' },
      { icon: <Sparkles className="w-4 h-4" />, title: 'אנליטיקות AI', description: 'ניתוח דיוק זיהוי קבלות' },
      { icon: <CreditCard className="w-4 h-4" />, title: 'סיכום החזרים', description: 'מעקב אחר החזרים לעובדים' },
    ]
  },
  {
    id: 'notifications',
    title: 'התראות ודוא"ל',
    icon: <Bell className="w-5 h-5" />,
    color: 'from-cyan-500 to-sky-600',
    features: [
      { icon: <Bell className="w-4 h-4" />, title: 'התראות בזמן אמת', description: 'קבלת עדכונים על שינויים בדוחות ובקשות' },
      { icon: <Mail className="w-4 h-4" />, title: 'דוא"ל אוטומטי', description: 'שליחת מיילים על אישורים ודחיות' },
      { icon: <UserCheck className="w-4 h-4" />, title: 'התראות למנהל', description: 'עדכון על דוחות ובקשות חדשות' },
      { icon: <FileText className="w-4 h-4" />, title: 'שליחה להנה"ח', description: 'שליחת דוחות ישירות להנהלת חשבונות' },
    ]
  },
  {
    id: 'security',
    title: 'אבטחה והרשאות',
    icon: <Lock className="w-5 h-5" />,
    color: 'from-slate-500 to-gray-600',
    features: [
      { icon: <Lock className="w-4 h-4" />, title: 'Row Level Security', description: 'הגבלת גישה לנתונים ברמת השורה' },
      { icon: <Shield className="w-4 h-4" />, title: 'הרשאות לפי תפקיד', description: 'כל משתמש רואה רק מה שמותר לו' },
      { icon: <UserCheck className="w-4 h-4" />, title: 'אימות חזק', description: 'מערכת אימות מאובטחת' },
      { icon: <Settings className="w-4 h-4" />, title: 'קודי הזמנה', description: 'הרשמת עובדים עם קודים מאובטחים' },
    ]
  },
  {
    id: 'mobile',
    title: 'מובייל ונגישות',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-600',
    features: [
      { icon: <Smartphone className="w-4 h-4" />, title: 'רספונסיביות מלאה', description: 'כל הדפים מותאמים למובייל' },
      { icon: <Camera className="w-4 h-4" />, title: 'צילום קבלות', description: 'צילום ישיר מהמצלמה' },
      { icon: <Wifi className="w-4 h-4" />, title: 'PWA', description: 'התקנה כאפליקציה על המכשיר' },
      { icon: <Languages className="w-4 h-4" />, title: 'עברית מלאה', description: 'ממשק מלא בעברית עם תמיכה ב-RTL' },
      { icon: <Moon className="w-4 h-4" />, title: 'מצב כהה', description: 'תמיכה במצב כהה' },
      { icon: <Palette className="w-4 h-4" />, title: 'עיצוב מודרני', description: 'ממשק משתמש מודרני ונגיש' },
    ]
  },
];

export default function AboutSystem() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');

  const totalFeatures = featureCategories.reduce((sum, cat) => sum + cat.features.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-300/20 rounded-full blur-2xl translate-x-1/4 translate-y-1/4" />
        
        <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה
            </Button>
          </div>
          
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">מערכת מתקדמת לניהול הוצאות</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              אודות המערכת
            </h1>
            <p className="text-lg text-white/80 mb-8">
              מערכת מקיפה לניהול הוצאות נסיעות עסקיות, אישור בקשות נסיעה, מעקב תקציבים ודיווח הוצאות
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3">
                <div className="text-3xl font-bold">{featureCategories.length}</div>
                <div className="text-sm text-white/70">מודולים</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3">
                <div className="text-3xl font-bold">{totalFeatures}+</div>
                <div className="text-sm text-white/70">פיצ'רים</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3">
                <div className="text-3xl font-bold">50+</div>
                <div className="text-sm text-white/70">מטבעות</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3">
                <div className="text-3xl font-bold">5</div>
                <div className="text-sm text-white/70">סוגי משתמשים</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Category Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-2">
            <ScrollArea className="w-full">
              <TabsList className="flex w-max gap-1 bg-transparent p-0">
                {featureCategories.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all data-[state=active]:shadow-md ${
                      activeTab === category.id
                        ? `bg-gradient-to-r ${category.color} text-white`
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {category.icon}
                    <span className="hidden sm:inline font-medium">{category.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </div>

          {/* Feature Content */}
          {featureCategories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-6">
              <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
                <CardHeader className={`bg-gradient-to-r ${category.color} text-white rounded-t-xl`}>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl">
                      {category.icon}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{category.title}</CardTitle>
                      <CardDescription className="text-white/80">
                        {category.features.length} פיצ'רים
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.features.map((feature, index) => (
                      <div
                        key={index}
                        className="group p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${category.color} text-white shrink-0 group-hover:scale-110 transition-transform`}>
                            {feature.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {feature.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Quick Overview Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureCategories.slice(0, 4).map((category) => (
            <Card 
              key={category.id}
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/30"
              onClick={() => setActiveTab(category.id)}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {category.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{category.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {category.features.length} פיצ'רים זמינים
                </p>
                <div className="flex flex-wrap gap-1">
                  {category.features.slice(0, 3).map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f.title}
                    </Badge>
                  ))}
                  {category.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{category.features.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-2 border-primary/20">
            <CardContent className="py-12">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">מוכנים להתחיל?</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                התחברו למערכת ותתחילו לנהל את ההוצאות והנסיעות שלכם בצורה חכמה ויעילה
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" onClick={() => navigate('/auth/login')}>
                  התחברות
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/auth/register')}>
                  הרשמה
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} מערכת ניהול הוצאות ונסיעות. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}
