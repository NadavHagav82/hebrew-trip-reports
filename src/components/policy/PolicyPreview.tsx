import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Eye,
  Users,
  Plane,
  Hotel,
  Utensils,
  Car,
  MoreHorizontal,
  Ban,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  organizationId: string;
}

interface EmployeeGrade {
  id: string;
  name: string;
  level: number;
  description: string | null;
}

interface PolicyRule {
  id: string;
  category: string;
  grade_id: string | null;
  max_amount: number | null;
  currency: string;
  destination_type: string;
  per_type: string;
  notes: string | null;
}

interface Restriction {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  action_type: string;
}

interface CustomRule {
  id: string;
  rule_name: string;
  description: string | null;
  condition_json: any;
  action_type: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  flights: Plane,
  accommodation: Hotel,
  food: Utensils,
  transportation: Car,
  miscellaneous: MoreHorizontal,
};

const CATEGORY_LABELS: Record<string, string> = {
  flights: 'טיסות',
  accommodation: 'לינה',
  food: 'אוכל',
  transportation: 'תחבורה',
  miscellaneous: 'אחר',
};

export function PolicyPreview({ organizationId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);

  useEffect(() => {
    loadAllData();
  }, [organizationId]);

  const loadAllData = async () => {
    try {
      const [gradesRes, rulesRes, restrictionsRes, customRes] = await Promise.all([
        supabase
          .from('employee_grades')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('level', { ascending: true }),
        supabase
          .from('travel_policy_rules')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('category', { ascending: true }),
        supabase
          .from('travel_policy_restrictions')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('custom_travel_rules')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
      ]);

      if (gradesRes.error) throw gradesRes.error;
      if (rulesRes.error) throw rulesRes.error;
      if (restrictionsRes.error) throw restrictionsRes.error;
      if (customRes.error) throw customRes.error;

      setGrades(gradesRes.data || []);
      setRules(rulesRes.data || []);
      setRestrictions(restrictionsRes.data || []);
      setCustomRules(customRes.data || []);
    } catch (error: any) {
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

  const getGradeName = (gradeId: string | null) => {
    if (!gradeId) return 'כל הדרגות';
    return grades.find(g => g.id === gradeId)?.name || 'לא ידוע';
  };

  const getPerTypeLabel = (perType: string) => {
    const labels: Record<string, string> = {
      per_day: 'ליום',
      per_trip: 'לנסיעה',
      per_item: 'לפריט',
    };
    return labels[perType] || perType;
  };

  const getDestinationLabel = (destType: string) => {
    const labels: Record<string, string> = {
      all: 'כל היעדים',
      domestic: 'מקומי',
      international: 'בינלאומי',
    };
    return labels[destType] || destType;
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'block':
        return XCircle;
      case 'warn':
        return AlertTriangle;
      case 'require_approval':
        return CheckCircle;
      default:
        return AlertTriangle;
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      block: 'חסום',
      warn: 'התרעה',
      require_approval: 'דורש אישור',
    };
    return labels[actionType] || actionType;
  };

  const getConditionSummary = (condition: any) => {
    if (!condition || Object.keys(condition).length === 0) return 'ללא תנאים';
    
    switch (condition.type) {
      case 'max_trip_duration':
        return `מקסימום ${condition.max_days} ימים`;
      case 'max_total_budget':
        return `תקציב: ${condition.max_amount?.toLocaleString()} ${condition.currency || 'ILS'}`;
      case 'weekend_travel':
        return 'נסיעה בסוף שבוע';
      case 'advance_booking':
        return `הזמנה ${condition.min_days} ימים מראש`;
      default:
        return 'חוק מותאם';
    }
  };

  // Group rules by category
  const rulesByCategory = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, PolicyRule[]>);

  const hasAnyData = grades.length > 0 || rules.length > 0 || restrictions.length > 0 || customRules.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
          <span className="text-sm text-muted-foreground">טוען תצוגה מקדימה...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border border-emerald-100/50 p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-emerald-200/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-teal-200/30 to-transparent rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
        
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">תצוגה מקדימה של המדיניות</h2>
            <p className="text-sm text-gray-600 mt-1">סקירה כללית של כל חוקי המדיניות שהוגדרו</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {!hasAnyData ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">אין מדיניות מוגדרת</h3>
            <p className="text-sm text-gray-500 text-center max-w-md">
              עדיין לא הוגדרה מדיניות נסיעות. השתמש בלשוניות למעלה כדי להגדיר חוקים.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Employee Grades */}
          {grades.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">דרגות עובדים</h3>
                  <p className="text-xs text-gray-500">{grades.length} דרגות מוגדרות</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {grades.map((grade) => (
                  <div 
                    key={grade.id} 
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100"
                  >
                    <span className="w-6 h-6 rounded-full bg-violet-200 text-violet-700 text-xs font-bold flex items-center justify-center">
                      {grade.level}
                    </span>
                    <span className="font-medium text-gray-700">{grade.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Rules */}
          {Object.keys(rulesByCategory).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center">
                  <Plane className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">מגבלות לפי קטגוריה</h3>
                  <p className="text-xs text-gray-500">{rules.length} חוקים מוגדרים</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(rulesByCategory).map(([category, categoryRules]) => {
                  const Icon = CATEGORY_ICONS[category] || MoreHorizontal;
                  const categoryColors: Record<string, { bg: string; icon: string; border: string }> = {
                    flights: { bg: 'from-sky-50 to-blue-50', icon: 'text-sky-600', border: 'border-sky-100' },
                    accommodation: { bg: 'from-violet-50 to-purple-50', icon: 'text-violet-600', border: 'border-violet-100' },
                    food: { bg: 'from-orange-50 to-amber-50', icon: 'text-orange-600', border: 'border-orange-100' },
                    transportation: { bg: 'from-emerald-50 to-green-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
                    miscellaneous: { bg: 'from-gray-50 to-slate-50', icon: 'text-gray-600', border: 'border-gray-100' },
                  };
                  const colors = categoryColors[category] || categoryColors.miscellaneous;
                  
                  return (
                    <div 
                      key={category} 
                      className={`rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border} overflow-hidden`}
                    >
                      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${colors.icon}`} />
                        <span className="font-semibold text-gray-800">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs bg-white/60">
                          {categoryRules.length} חוקים
                        </Badge>
                      </div>
                      <div className="p-4 space-y-2">
                        {categoryRules.map((rule) => (
                          <div 
                            key={rule.id} 
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/60 text-sm"
                          >
                            <span className="text-gray-600">
                              {getGradeName(rule.grade_id)} • {getDestinationLabel(rule.destination_type)}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {rule.max_amount ? (
                                <>
                                  {rule.max_amount.toLocaleString()} {rule.currency} {getPerTypeLabel(rule.per_type)}
                                </>
                              ) : (
                                <span className="text-gray-400 font-normal">ללא הגבלה</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Restrictions */}
          {restrictions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">הגבלות ואיסורים</h3>
                  <p className="text-xs text-gray-500">{restrictions.length} הגבלות מוגדרות</p>
                </div>
              </div>
              <div className="space-y-2">
                {restrictions.map((restriction) => {
                  const ActionIcon = getActionIcon(restriction.action_type);
                  const actionColors: Record<string, { bg: string; text: string; badge: string }> = {
                    block: { bg: 'from-rose-50 to-red-50', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
                    warn: { bg: 'from-amber-50 to-yellow-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
                    require_approval: { bg: 'from-blue-50 to-indigo-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
                  };
                  const colors = actionColors[restriction.action_type] || actionColors.warn;
                  
                  return (
                    <div
                      key={restriction.id}
                      className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-br ${colors.bg} border border-white/50`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center`}>
                          <ActionIcon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">{restriction.name}</span>
                          {restriction.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{restriction.description}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={colors.badge}>
                        {getActionLabel(restriction.action_type)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Rules */}
          {customRules.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">חוקים מותאמים</h3>
                  <p className="text-xs text-gray-500">{customRules.length} חוקים מותאמים</p>
                </div>
              </div>
              <div className="space-y-2">
                {customRules.map((rule) => {
                  const ActionIcon = getActionIcon(rule.action_type);
                  const actionColors: Record<string, { bg: string; text: string; badge: string }> = {
                    block: { bg: 'from-rose-50 to-red-50', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
                    warn: { bg: 'from-amber-50 to-yellow-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
                    require_approval: { bg: 'from-blue-50 to-indigo-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
                  };
                  const colors = actionColors[rule.action_type] || actionColors.warn;
                  
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-br ${colors.bg} border border-white/50`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center`}>
                          <ActionIcon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">{rule.rule_name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs bg-white/60 text-gray-600 border-gray-200">
                              {getConditionSummary(rule.condition_json)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={colors.badge}>
                        {getActionLabel(rule.action_type)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
