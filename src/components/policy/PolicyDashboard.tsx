import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PolicyAuditLog } from './PolicyAuditLog';
import { 
  Building2, 
  Users, 
  Plane, 
  Hotel, 
  Utensils, 
  Car, 
  Ban, 
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  History,
  Plus,
  FileDown,
  Copy,
  BarChart3,
  Loader2,
  AlertTriangle,
  ArrowUpLeft,
  TrendingUp,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface PolicyDashboardProps {
  organizationId: string;
  organizationName: string;
  onNavigateToTab: (tab: string) => void;
}

interface CategoryStats {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
  isConfigured: boolean;
  lastUpdated: string | null;
  tab: string;
}

export function PolicyDashboard({ organizationId, organizationName, onNavigateToTab }: PolicyDashboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [policyActive, setPolicyActive] = useState(true);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [categories, setCategories] = useState<CategoryStats[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [organizationId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load employee count
      const { count: empCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      
      setEmployeeCount(empCount || 0);

      // Load employee grades
      const { data: grades, error: gradesError } = await supabase
        .from('employee_grades')
        .select('id, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (gradesError) throw gradesError;

      // Load travel policy rules by category
      const { data: rules, error: rulesError } = await supabase
        .from('travel_policy_rules')
        .select('id, category, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (rulesError) throw rulesError;

      // Load restrictions (uses created_at since no updated_at column)
      const { data: restrictions, error: restrictionsError } = await supabase
        .from('travel_policy_restrictions')
        .select('id, created_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (restrictionsError) throw restrictionsError;

      // Load custom rules
      const { data: customRules, error: customRulesError } = await supabase
        .from('custom_travel_rules')
        .select('id, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (customRulesError) throw customRulesError;

      // Calculate category stats
      const flightRules = rules?.filter(r => r.category === 'flights') || [];
      const hotelRules = rules?.filter(r => r.category === 'accommodation') || [];
      const foodRules = rules?.filter(r => r.category === 'food') || [];
      const transportRules = rules?.filter(r => r.category === 'transportation') || [];
      const miscRules = rules?.filter(r => r.category === 'miscellaneous') || [];

      const getLatestDate = (items: any[], dateField = 'updated_at') => {
        if (!items || items.length === 0) return null;
        const dates = items.map(i => new Date(i[dateField] || i.created_at || i.updated_at).getTime());
        return new Date(Math.max(...dates)).toISOString();
      };

      const categoryStats: CategoryStats[] = [
        {
          id: 'grades',
          name: 'דרגות עובדים',
          icon: <Users className="w-6 h-6" />,
          count: grades?.length || 0,
          isConfigured: (grades?.length || 0) > 0,
          lastUpdated: getLatestDate(grades || []),
          tab: 'grades'
        },
        {
          id: 'flights',
          name: 'חוקי טיסות',
          icon: <Plane className="w-6 h-6" />,
          count: flightRules.length,
          isConfigured: flightRules.length > 0,
          lastUpdated: getLatestDate(flightRules),
          tab: 'categories'
        },
        {
          id: 'accommodation',
          name: 'חוקי מלונות',
          icon: <Hotel className="w-6 h-6" />,
          count: hotelRules.length,
          isConfigured: hotelRules.length > 0,
          lastUpdated: getLatestDate(hotelRules),
          tab: 'categories'
        },
        {
          id: 'food',
          name: 'חוקי ארוחות',
          icon: <Utensils className="w-6 h-6" />,
          count: foodRules.length,
          isConfigured: foodRules.length > 0,
          lastUpdated: getLatestDate(foodRules),
          tab: 'categories'
        },
        {
          id: 'transportation',
          name: 'חוקי תחבורה',
          icon: <Car className="w-6 h-6" />,
          count: transportRules.length,
          isConfigured: transportRules.length > 0,
          lastUpdated: getLatestDate(transportRules),
          tab: 'categories'
        },
        {
          id: 'restrictions',
          name: 'הגבלות',
          icon: <Ban className="w-6 h-6" />,
          count: restrictions?.length || 0,
          isConfigured: (restrictions?.length || 0) > 0,
          lastUpdated: getLatestDate(restrictions || [], 'created_at'),
          tab: 'restrictions'
        },
        {
          id: 'custom',
          name: 'חוקים מותאמים',
          icon: <Sparkles className="w-6 h-6" />,
          count: customRules?.length || 0,
          isConfigured: (customRules?.length || 0) > 0,
          lastUpdated: getLatestDate(customRules || []),
          tab: 'custom'
        }
      ];

      setCategories(categoryStats);

      // Find overall last update
      const allDates = categoryStats
        .filter(c => c.lastUpdated)
        .map(c => new Date(c.lastUpdated!).getTime());
      
      if (allDates.length > 0) {
        setLastUpdate(new Date(Math.max(...allDates)).toISOString());
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני הדשבורד',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    toast({
      title: 'בקרוב',
      description: 'ייצוא ל-PDF יהיה זמין בקרוב',
    });
  };

  const handleDuplicatePolicy = () => {
    toast({
      title: 'בקרוב',
      description: 'שכפול מדיניות יהיה זמין בקרוב',
    });
  };

  const handleViewCompliance = () => {
    toast({
      title: 'בקרוב',
      description: 'דוח ציות יהיה זמין בקרוב',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">טוען נתוני מדיניות...</p>
        </div>
      </div>
    );
  }

  const configuredCount = categories.filter(c => c.isConfigured).length;
  const totalCategories = categories.length;
  const completionPercentage = Math.round((configuredCount / totalCategories) * 100);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-6 sm:p-8 text-primary-foreground">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-x-1/4 translate-y-1/4" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  מדיניות נסיעות
                </h1>
                <p className="text-white/70 mt-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {organizationName}
                </p>
              </div>
            </div>
            <Badge 
              className={`text-sm px-4 py-2 font-medium backdrop-blur-sm ${
                policyActive 
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-100' 
                  : 'bg-white/10 border border-white/20'
              }`}
            >
              {policyActive ? (
                <>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full ml-2 animate-pulse" />
                  פעיל
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 ml-2" />
                  לא פעיל
                </>
              )}
            </Badge>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">עדכון אחרון</p>
                  <p className="font-medium text-sm">
                    {lastUpdate 
                      ? format(new Date(lastUpdate), 'd בMMMM yyyy', { locale: he })
                      : 'לא עודכן עדיין'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">חל על</p>
                  <p className="font-medium text-sm">{employeeCount} עובדים</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">השלמת הגדרות</p>
                  <p className="font-medium text-sm">{completionPercentage}%</p>
                </div>
              </div>
              <Progress value={completionPercentage} className="h-1.5 bg-white/20" />
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => onNavigateToTab('preview')}
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
            >
              <Eye className="w-4 h-4 ml-2" />
              צפה במדיניות
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setAuditLogOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
            >
              <History className="w-4 h-4 ml-2" />
              יומן שינויים
            </Button>
          </div>
          
          <PolicyAuditLog 
            organizationId={organizationId}
            isOpen={auditLogOpen}
            onClose={() => setAuditLogOpen(false)}
          />
        </div>
      </div>

      {/* Completion Warning */}
      {completionPercentage < 100 && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              המדיניות לא הושלמה ({completionPercentage}%)
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-200">
              {totalCategories - configuredCount} קטגוריות עדיין לא הוגדרו. לחץ על הקטגוריות למטה כדי להשלים את ההגדרות.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
            onClick={() => onNavigateToTab('categories')}
          >
            השלם עכשיו
            <ArrowUpLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}

      {/* Category Cards Grid */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">סיכום קטגוריות</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((category, index) => (
            <Card 
              key={category.id}
              className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 border-2 overflow-hidden ${
                category.isConfigured 
                  ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30' 
                  : 'border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30'
              }`}
              onClick={() => onNavigateToTab(category.tab)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-5 relative">
                {/* Background decoration */}
                <div className={`absolute -left-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${
                  category.isConfigured ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl shadow-sm transition-transform group-hover:scale-110 ${
                      category.isConfigured 
                        ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white'
                        : 'bg-gradient-to-br from-rose-400 to-red-500 text-white'
                    }`}>
                      {category.icon}
                    </div>
                    <div className={`p-1.5 rounded-full ${
                      category.isConfigured 
                        ? 'bg-emerald-100 dark:bg-emerald-900/50'
                        : 'bg-rose-100 dark:bg-rose-900/50'
                    }`}>
                      {category.isConfigured ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-sm mb-1">{category.name}</h3>
                  <p className={`text-xs font-medium mb-3 ${
                    category.isConfigured 
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}>
                    {category.count > 0 
                      ? `${category.count} ${category.id === 'grades' ? 'דרגות' : 'חוקים'} פעילים`
                      : 'לא הוגדר עדיין'
                    }
                  </p>
                  
                  {category.lastUpdated ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(category.lastUpdated), 'd/M/yyyy', { locale: he })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpLeft className="w-3 h-3" />
                      לחץ להגדרה
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-secondary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-secondary" />
          </div>
          <h2 className="text-xl font-bold">פעולות מהירות</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button 
            onClick={() => onNavigateToTab('categories')} 
            className="h-auto py-4 flex-col gap-2 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">הוסף חוק חדש</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportPdf} 
            className="h-auto py-4 flex-col gap-2 hover:bg-muted/50"
          >
            <FileDown className="w-5 h-5" />
            <span className="text-sm">ייצא ל-PDF</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDuplicatePolicy} 
            className="h-auto py-4 flex-col gap-2 hover:bg-muted/50"
          >
            <Copy className="w-5 h-5" />
            <span className="text-sm">שכפל מדיניות</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleViewCompliance} 
            className="h-auto py-4 flex-col gap-2 hover:bg-muted/50"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm">דוח ציות</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
