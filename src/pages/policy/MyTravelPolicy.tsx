import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowRight, 
  Building2,
  Plane,
  Hotel,
  Utensils,
  Car,
  Package,
  Ban,
  Info,
  Lightbulb,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Shield,
  FileText
} from 'lucide-react';

interface PolicyRule {
  id: string;
  category: string;
  max_amount: number | null;
  currency: string;
  destination_type: string;
  per_type: string;
  notes: string | null;
  grade_id: string | null;
  grade_name?: string;
}

interface Restriction {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  action_type: string;
  keywords: string[] | null;
}

interface EmployeeGrade {
  id: string;
  name: string;
  level: number;
  description: string | null;
}

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  flights: { icon: Plane, label: 'טיסות', color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
  accommodation: { icon: Hotel, label: 'מלונות', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
  food: { icon: Utensils, label: 'ארוחות', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  transportation: { icon: Car, label: 'תחבורה', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
  miscellaneous: { icon: Package, label: 'הוצאות שונות', color: 'text-pink-600', bgColor: 'bg-pink-500/10' }
};

const PER_TYPE_LABELS: Record<string, string> = {
  per_day: 'ליום',
  per_trip: 'לנסיעה',
  per_item: 'לפריט'
};

const DESTINATION_LABELS: Record<string, string> = {
  domestic: 'פנים ארצי',
  international: 'בינלאומי',
  all: 'כל היעדים'
};

export default function MyTravelPolicy() {
  const [loading, setLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userGrade, setUserGrade] = useState<EmployeeGrade | null>(null);
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [allGrades, setAllGrades] = useState<EmployeeGrade[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadPolicyData();
    }
  }, [user]);

  const loadPolicyData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן לטעון את הפרופיל',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setUserProfile(profile);

      if (!profile.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון משויך',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Get organization name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single();

      setOrganizationName(orgData?.name || '');

      // Get employee grades
      const { data: grades } = await supabase
        .from('employee_grades')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('level', { ascending: true });

      setAllGrades(grades || []);

      // For now, assume user is at the lowest grade level if not specified
      // In a real implementation, the profile would have a grade_id field
      const lowestGrade = grades?.[0] || null;
      setUserGrade(lowestGrade);

      // Get policy rules - filter by user's grade or rules without specific grade
      const { data: rules } = await supabase
        .from('travel_policy_rules')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      // Filter rules relevant to user's grade
      const relevantRules = (rules || []).filter(rule => {
        // If rule has no grade specified, it applies to everyone
        if (!rule.grade_id) return true;
        // If user has a grade, check if it matches
        if (lowestGrade && rule.grade_id === lowestGrade.id) return true;
        return false;
      });

      // Add grade names to rules
      const rulesWithGrades = relevantRules.map(rule => ({
        ...rule,
        grade_name: grades?.find(g => g.id === rule.grade_id)?.name || 'כללי'
      }));

      setPolicyRules(rulesWithGrades);

      // Get restrictions
      const { data: restrictionsData } = await supabase
        .from('travel_policy_restrictions')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      setRestrictions(restrictionsData || []);

    } catch (error) {
      console.error('Error loading policy data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני המדיניות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRulesByCategory = (category: string) => {
    return policyRules.filter(rule => rule.category === category);
  };

  const formatAmount = (amount: number | null, currency: string) => {
    if (!amount) return 'ללא הגבלה';
    const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
    return `${symbol}${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/30 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-muted-foreground animate-pulse">טוען את המדיניות שלך...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background" dir="rtl">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">מדיניות הנסיעות שלי</h1>
                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{organizationName}</span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="bg-background/80 backdrop-blur-sm border-border/50 hover:bg-muted/80"
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Card */}
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground">
                  שלום {userProfile?.full_name || 'משתמש'},
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="rounded-full px-4 py-1">
                    <Shield className="h-3.5 w-3.5 ml-1.5" />
                    {userGrade?.name || 'עובד'}
                  </Badge>
                  {userGrade?.description && (
                    <span className="text-sm text-muted-foreground">{userGrade.description}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">להלן התקציבים והחוקים שחלים עליך</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    המידע המוצג כאן הוא בהתאם לדרגה שלך בארגון. במידה ויש שאלות, פנה למנהל הישיר שלך.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
            const rules = getRulesByCategory(category);
            const IconComponent = config.icon;
            
            return (
              <Card key={category} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <CardHeader className={`${config.bgColor} border-b border-border/30`}>
                  <CardTitle className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-white/80 dark:bg-background/80 shadow-sm`}>
                      <IconComponent className={`h-6 w-6 ${config.color}`} />
                    </div>
                    <span className="text-xl">{config.label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {rules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>אין הגבלות מיוחדות בקטגוריה זו</p>
                      <p className="text-sm mt-1">בכל מקרה, פעל בהתאם לשיקול דעת סביר</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {rules.map((rule, index) => (
                        <div 
                          key={rule.id}
                          className="p-4 rounded-xl bg-muted/30 border border-border/30 hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="rounded-full text-xs">
                                  {DESTINATION_LABELS[rule.destination_type] || rule.destination_type}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full text-xs">
                                  {PER_TYPE_LABELS[rule.per_type] || rule.per_type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                  {formatAmount(rule.max_amount, rule.currency)}
                                </span>
                                <span className="text-muted-foreground">
                                  {PER_TYPE_LABELS[rule.per_type] || ''}
                                </span>
                              </div>
                              {rule.notes && (
                                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <span>{rule.notes}</span>
                                </div>
                              )}
                            </div>
                            <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Restrictions Section */}
        {restrictions.length > 0 && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-b border-border/30">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10">
                  <Ban className="h-6 w-6 text-red-500" />
                </div>
                <span className="text-xl">מה אסור?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {restrictions.map((restriction) => {
                  const categoryConfig = restriction.category ? CATEGORY_CONFIG[restriction.category] : null;
                  
                  return (
                    <div 
                      key={restriction.id}
                      className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${restriction.action_type === 'block' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                          {restriction.action_type === 'block' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{restriction.name}</h4>
                          {restriction.description && (
                            <p className="text-sm text-muted-foreground mt-1">{restriction.description}</p>
                          )}
                          {categoryConfig && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {categoryConfig.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips Section */}
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-amber-500/5 via-background to-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <Lightbulb className="h-6 w-6 text-amber-500" />
              </div>
              <span className="text-xl">טיפים חשובים</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-foreground">שמור קבלות</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    יש לשמור את כל הקבלות והחשבוניות עבור כל הוצאה
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-foreground">דווח בזמן</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    יש להגיש דוח הוצאות תוך 14 יום מתום הנסיעה
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-foreground">אישור מראש</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    הוצאות חריגות דורשות אישור מנהל מראש
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-foreground">שאלות?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    בכל שאלה פנה למנהל הישיר או למחלקת הכספים
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>מדיניות זו עודכנה לאחרונה ומחייבת את כל עובדי הארגון.</p>
          <p className="mt-1">במקרה של סתירה בין מסמכים, מדיניות זו גוברת.</p>
        </div>
      </div>
    </div>
  );
}
