import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  Edit,
  History,
  Plus,
  FileDown,
  Copy,
  BarChart3,
  Loader2,
  AlertTriangle
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const configuredCount = categories.filter(c => c.isConfigured).length;
  const totalCategories = categories.length;
  const completionPercentage = Math.round((configuredCount / totalCategories) * 100);

  return (
    <div className="space-y-6">
      {/* Part 1: General Policy Info */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">
                  מדיניות נסיעות עסקיות - {organizationName}
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  ניהול כללי מדיניות הנסיעות של הארגון
                </p>
              </div>
            </div>
            <Badge 
              variant={policyActive ? "default" : "secondary"}
              className={`text-sm px-3 py-1 ${policyActive ? 'bg-green-500 hover:bg-green-600' : ''}`}
            >
              {policyActive ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  פעיל
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  לא פעיל
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">עדכון אחרון:</span>
              <span className="font-medium">
                {lastUpdate 
                  ? format(new Date(lastUpdate), 'd בMMMM yyyy, HH:mm', { locale: he })
                  : 'לא עודכן עדיין'
                }
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">חל על:</span>
              <span className="font-medium">{employeeCount} עובדים</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">השלמת הגדרות:</span>
              <span className="font-medium">{completionPercentage}%</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigateToTab('preview')}>
              <Edit className="w-4 h-4 ml-2" />
              צפה במדיניות
            </Button>
            <Button variant="outline" size="sm" onClick={handleViewCompliance}>
              <History className="w-4 h-4 ml-2" />
              יומן שינויים
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completion Warning */}
      {completionPercentage < 100 && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  המדיניות לא הושלמה
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  {totalCategories - configuredCount} קטגוריות עדיין לא הוגדרו. לחץ על הקטגוריות האדומות כדי להשלים את ההגדרות.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Part 2: Quick Summary Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          סיכום מהיר
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((category) => (
            <Card 
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${
                category.isConfigured 
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' 
                  : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
              }`}
              onClick={() => onNavigateToTab(category.tab)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${
                    category.isConfigured 
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                  }`}>
                    {category.icon}
                  </div>
                  {category.isConfigured ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">{category.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {category.count > 0 
                    ? `${category.count} ${category.id === 'grades' ? 'דרגות' : 'חוקים'} פעילים`
                    : 'לא הוגדר עדיין'
                  }
                </p>
                {category.lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(category.lastUpdated), 'd/M/yyyy', { locale: he })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Part 3: Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          פעולות מהירות
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onNavigateToTab('categories')} className="gap-2">
            <Plus className="w-4 h-4" />
            הוסף חוק חדש
          </Button>
          <Button variant="outline" onClick={handleExportPdf} className="gap-2">
            <FileDown className="w-4 h-4" />
            ייצא מדיניות ל-PDF
          </Button>
          <Button variant="outline" onClick={handleDuplicatePolicy} className="gap-2">
            <Copy className="w-4 h-4" />
            שכפל מדיניות לארגון אחר
          </Button>
          <Button variant="outline" onClick={handleViewCompliance} className="gap-2">
            <BarChart3 className="w-4 h-4" />
            הצג דוח ציות
          </Button>
        </div>
      </div>
    </div>
  );
}
