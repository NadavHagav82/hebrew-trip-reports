import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  FileText,
  Search,
  Filter,
  X
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
  const [hasOrganization, setHasOrganization] = useState(true);
  const [hasPolicy, setHasPolicy] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userGrade, setUserGrade] = useState<EmployeeGrade | null>(null);
  const [isDefaultGrade, setIsDefaultGrade] = useState(false);
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [allGrades, setAllGrades] = useState<EmployeeGrade[]>([]);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [perTypeFilter, setPerTypeFilter] = useState<string>('all');

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Filtered policy rules
  const filteredPolicyRules = useMemo(() => {
    return policyRules.filter(rule => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        CATEGORY_CONFIG[rule.category]?.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        DESTINATION_LABELS[rule.destination_type]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        PER_TYPE_LABELS[rule.per_type]?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || rule.category === categoryFilter;
      
      // Destination filter
      const matchesDestination = destinationFilter === 'all' || rule.destination_type === destinationFilter;
      
      // Per type filter
      const matchesPerType = perTypeFilter === 'all' || rule.per_type === perTypeFilter;
      
      return matchesSearch && matchesCategory && matchesDestination && matchesPerType;
    });
  }, [policyRules, searchQuery, categoryFilter, destinationFilter, perTypeFilter]);
  
  // Filtered restrictions
  const filteredRestrictions = useMemo(() => {
    return restrictions.filter(restriction => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        restriction.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restriction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (restriction.category && CATEGORY_CONFIG[restriction.category]?.label.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || restriction.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [restrictions, searchQuery, categoryFilter]);
  
  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'all' || destinationFilter !== 'all' || perTypeFilter !== 'all';
  
  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDestinationFilter('all');
    setPerTypeFilter('all');
  };

  useEffect(() => {
    if (user) {
      loadPolicyData();
    }
  }, [user]);

  const loadPolicyData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user profile with grade_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

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

      // If no organization, user is independent - no restrictions
      if (!profile.organization_id) {
        setHasOrganization(false);
        setHasPolicy(false);
        setLoading(false);
        return;
      }

      setHasOrganization(true);

      // Get organization name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle();

      setOrganizationName(orgData?.name || '');

      // Get employee grades
      const { data: grades } = await supabase
        .from('employee_grades')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('level', { ascending: true });

      setAllGrades(grades || []);

      // Get user's actual grade from profile
      let currentUserGrade: EmployeeGrade | null = null;
      let usingDefaultGrade = false;
      
      if (profile.grade_id) {
        // User has a grade assigned - find it
        currentUserGrade = grades?.find(g => g.id === profile.grade_id) || null;
      }
      
      // If no grade assigned, use the lowest grade as default
      if (!currentUserGrade && grades && grades.length > 0) {
        currentUserGrade = grades[0];
        usingDefaultGrade = true;
      }
      
      setUserGrade(currentUserGrade);
      setIsDefaultGrade(usingDefaultGrade);

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
        if (currentUserGrade && rule.grade_id === currentUserGrade.id) return true;
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
      
      // Check if there's any policy defined
      const hasPolicyDefined = rulesWithGrades.length > 0 || (restrictionsData && restrictionsData.length > 0);
      setHasPolicy(hasPolicyDefined);

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
    return filteredPolicyRules.filter(rule => rule.category === category);
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
                {hasOrganization && organizationName && (
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{organizationName}</span>
                  </div>
                )}
                {!hasOrganization && (
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>משתמש עצמאי</span>
                  </div>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="bg-background/80 backdrop-blur-sm border-border/50 hover:bg-muted/80"
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* No Organization or No Policy - Show No Restrictions */}
        {(!hasOrganization || !hasPolicy) && (
          <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-emerald-50/50 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/20">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">
                    {!hasOrganization ? 'אין הגבלות' : 'אין מדיניות מוגדרת'}
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                    {!hasOrganization 
                      ? 'אינך משויך לארגון כלשהו. אתה יכול לדווח על הוצאות בכל סכום ובכל קטגוריה ללא הגבלה.'
                      : 'לארגון שלך אין מדיניות נסיעות מוגדרת. אתה יכול לדווח על הוצאות בכל סכום ובכל קטגוריה ללא הגבלה.'
                    }
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-background/80 border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm">
                    <Plane className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">טיסות</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">ללא הגבלה</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-background/80 border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm">
                    <Hotel className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">מלונות</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">ללא הגבלה</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-background/80 border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm">
                    <Utensils className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">ארוחות</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">ללא הגבלה</p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/30 max-w-lg mx-auto">
                  <div className="flex items-start gap-3 text-right">
                    <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        למרות שאין הגבלות, מומלץ לנהוג באחריות ולתעד את ההוצאות כראוי.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regular Policy View - Only show if has organization and has policy */}
        {hasOrganization && hasPolicy && (
          <>
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
                
                {isDefaultGrade && (
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">לא הוגדרה דרגה לחשבון שלך</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          מוצגת מדיניות ברירת מחדל (דרגה בסיסית). פנה למנהל הארגון לעדכון הדרגה שלך.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className={`mt-6 p-4 rounded-xl bg-muted/30 border border-border/30 ${isDefaultGrade ? 'mt-4' : ''}`}>
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

            {/* Quick Navigation Dashboard - Now above search */}
            <div className="bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-2xl p-4 shadow-sm border border-border/30 sticky top-4 z-10 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="text-sm text-muted-foreground font-medium hidden sm:block">קיצורי דרך:</span>
                
                {/* Categories Shortcuts */}
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const IconComp = config.icon;
                  const rulesCount = policyRules.filter(r => r.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setCategoryFilter(key);
                        document.getElementById('policy-categories')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 ${
                        categoryFilter === key 
                          ? `${config.bgColor} ${config.color} shadow-md` 
                          : 'bg-background/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                      <span className="text-sm font-medium hidden md:block">{config.label}</span>
                      {rulesCount > 0 && (
                        <Badge variant="secondary" className="h-5 min-w-[20px] text-xs px-1.5 rounded-full">
                          {rulesCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
                
                {/* Divider */}
                <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />
                
                {/* Restrictions Shortcut */}
                <button
                  onClick={() => document.getElementById('restrictions-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all duration-200 hover:scale-105"
                >
                  <Ban className="h-4 w-4" />
                  <span className="text-sm font-medium hidden md:block">מה אסור</span>
                  {restrictions.length > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-[20px] text-xs px-1.5 rounded-full bg-red-100 text-red-600">
                      {restrictions.length}
                    </Badge>
                  )}
                </button>
                
                {/* Tips Shortcut */}
                <button
                  onClick={() => document.getElementById('tips-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all duration-200 hover:scale-105"
                >
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-sm font-medium hidden md:block">טיפים</span>
                </button>
                
                {/* Clear Filter */}
                {categoryFilter !== 'all' && (
                  <>
                    <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                      <span className="text-sm font-medium hidden md:block">הצג הכל</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search and Filter Section - Modern Design */}
            <div className="bg-gradient-to-r from-muted/50 via-background to-muted/50 rounded-2xl p-6 shadow-sm border border-border/30">
              <div className="flex flex-col gap-5">
                {/* Search Row */}
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10">
                    <Search className="h-4 w-4 text-primary" />
                  </div>
                  <Input
                    placeholder="חיפוש במדיניות..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-14 h-12 text-base rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm focus:shadow-md focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                
                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pl-3 border-l border-border/50">
                    <Filter className="h-4 w-4" />
                    <span className="font-medium">סינון:</span>
                  </div>
                  
                  {/* Category Filter */}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className={`w-auto min-w-[140px] h-10 rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all ${categoryFilter !== 'all' ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <SelectValue placeholder="כל הקטגוריות" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="rounded-lg">כל הקטגוריות</SelectItem>
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                        const IconComp = config.icon;
                        return (
                          <SelectItem key={key} value={key} className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <IconComp className={`h-4 w-4 ${config.color}`} />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  {/* Destination Filter */}
                  <Select value={destinationFilter} onValueChange={setDestinationFilter}>
                    <SelectTrigger className={`w-auto min-w-[130px] h-10 rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all ${destinationFilter !== 'all' ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <SelectValue placeholder="כל היעדים" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="rounded-lg">כל היעדים</SelectItem>
                      {Object.entries(DESTINATION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Per Type Filter */}
                  <Select value={perTypeFilter} onValueChange={setPerTypeFilter}>
                    <SelectTrigger className={`w-auto min-w-[120px] h-10 rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all ${perTypeFilter !== 'all' ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <SelectValue placeholder="כל הסוגים" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="rounded-lg">כל הסוגים</SelectItem>
                      {Object.entries(PER_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Clear Filters Button */}
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="h-10 px-4 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <X className="h-4 w-4 ml-1" />
                      נקה הכל
                    </Button>
                  )}
                </div>
                
                {/* Active Filters Pills */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
                    <span className="text-xs text-muted-foreground/70 font-medium">פעיל:</span>
                    {searchQuery && (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 bg-primary/10 text-primary border-0 gap-1.5 hover:bg-primary/20 transition-colors">
                        <Search className="h-3 w-3" />
                        "{searchQuery}"
                        <button onClick={() => setSearchQuery('')} className="mr-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {categoryFilter !== 'all' && (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 bg-primary/10 text-primary border-0 gap-1.5 hover:bg-primary/20 transition-colors">
                        {(() => {
                          const config = CATEGORY_CONFIG[categoryFilter];
                          const IconComp = config?.icon;
                          return IconComp ? <IconComp className="h-3 w-3" /> : null;
                        })()}
                        {CATEGORY_CONFIG[categoryFilter]?.label}
                        <button onClick={() => setCategoryFilter('all')} className="mr-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {destinationFilter !== 'all' && (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 bg-primary/10 text-primary border-0 gap-1.5 hover:bg-primary/20 transition-colors">
                        {DESTINATION_LABELS[destinationFilter]}
                        <button onClick={() => setDestinationFilter('all')} className="mr-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {perTypeFilter !== 'all' && (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 bg-primary/10 text-primary border-0 gap-1.5 hover:bg-primary/20 transition-colors">
                        {PER_TYPE_LABELS[perTypeFilter]}
                        <button onClick={() => setPerTypeFilter('all')} className="mr-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

        {/* Policy Categories */}
        <div id="policy-categories" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-24">
          {Object.entries(CATEGORY_CONFIG)
            .filter(([category]) => categoryFilter === 'all' || category === categoryFilter)
            .map(([category, config], index) => {
            const rules = getRulesByCategory(category);
            const IconComponent = config.icon;
            
            return (
              <AnimatedCard key={category} delay={index * 100} animation="fade-up">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden h-full">
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
                        {rules.map((rule, ruleIndex) => (
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
              </AnimatedCard>
            );
          })}
        </div>

        {/* Restrictions Section */}
        <div id="restrictions-section" className="scroll-mt-24">
        {filteredRestrictions.length > 0 && (
          <AnimatedCard animation="fade-up" delay={200}>
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-b border-border/30">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10">
                    <Ban className="h-6 w-6 text-red-500" />
                  </div>
                  <span className="text-xl">מה אסור?</span>
                  <Badge variant="secondary" className="mr-auto">{filteredRestrictions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRestrictions.map((restriction, index) => {
                    const categoryConfig = restriction.category ? CATEGORY_CONFIG[restriction.category] : null;
                    
                    return (
                      <div 
                        key={restriction.id}
                        className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-all duration-300 hover:scale-[1.02]"
                        style={{ animationDelay: `${index * 50}ms` }}
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
          </AnimatedCard>
        )}
        </div>
        
        {/* No Results Message */}
        {hasActiveFilters && filteredPolicyRules.length === 0 && filteredRestrictions.length === 0 && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">לא נמצאו תוצאות</h3>
              <p className="text-muted-foreground mb-4">נסה לשנות את מילות החיפוש או הסינון</p>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 ml-2" />
                נקה סינון
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tips Section */}
        <AnimatedCard animation="fade-up" delay={300}>
          <Card id="tips-section" className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-amber-500/5 via-background to-amber-500/10 scroll-mt-24">
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
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30 hover:scale-[1.02] transition-transform duration-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground">שמור קבלות</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      יש לשמור את כל הקבלות והחשבוניות עבור כל הוצאה
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30 hover:scale-[1.02] transition-transform duration-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground">דווח בזמן</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      יש להגיש דוח הוצאות תוך 14 יום מתום הנסיעה
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30 hover:scale-[1.02] transition-transform duration-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground">אישור מראש</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      הוצאות חריגות דורשות אישור מנהל מראש
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/30 hover:scale-[1.02] transition-transform duration-300">
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
        </AnimatedCard>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>מדיניות זו עודכנה לאחרונה ומחייבת את כל עובדי הארגון.</p>
          <p className="mt-1">במקרה של סתירה בין מסמכים, מדיניות זו גוברת.</p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
