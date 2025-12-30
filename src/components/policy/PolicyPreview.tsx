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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          תצוגה מקדימה של המדיניות
        </CardTitle>
        <CardDescription>
          סקירה כללית של כל חוקי המדיניות שהוגדרו
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAnyData ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              עדיין לא הוגדרה מדיניות נסיעות. השתמש בלשוניות למעלה כדי להגדיר חוקים.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Employee Grades */}
            {grades.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  דרגות עובדים
                </h3>
                <div className="flex flex-wrap gap-2">
                  {grades.map((grade) => (
                    <Badge key={grade.id} variant="outline" className="py-1.5 px-3">
                      <span className="font-mono text-xs ml-2">#{grade.level}</span>
                      {grade.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {grades.length > 0 && (rules.length > 0 || restrictions.length > 0 || customRules.length > 0) && (
              <Separator />
            )}

            {/* Category Rules */}
            {Object.keys(rulesByCategory).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Plane className="w-5 h-5 text-green-600" />
                  מגבלות לפי קטגוריה
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(rulesByCategory).map(([category, categoryRules]) => {
                    const Icon = CATEGORY_ICONS[category] || MoreHorizontal;
                    return (
                      <Card key={category} className="border-dashed">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {CATEGORY_LABELS[category] || category}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2">
                          <ul className="space-y-2 text-sm">
                            {categoryRules.map((rule) => (
                              <li key={rule.id} className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  {getGradeName(rule.grade_id)} • {getDestinationLabel(rule.destination_type)}
                                </span>
                                <span className="font-medium">
                                  {rule.max_amount ? (
                                    <>
                                      {rule.max_amount.toLocaleString()} {rule.currency} {getPerTypeLabel(rule.per_type)}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">ללא הגבלה</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {Object.keys(rulesByCategory).length > 0 && (restrictions.length > 0 || customRules.length > 0) && (
              <Separator />
            )}

            {/* Restrictions */}
            {restrictions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Ban className="w-5 h-5 text-red-600" />
                  הגבלות ואיסורים
                </h3>
                <div className="grid gap-2">
                  {restrictions.map((restriction) => {
                    const ActionIcon = getActionIcon(restriction.action_type);
                    return (
                      <div
                        key={restriction.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <ActionIcon className={`w-4 h-4 ${
                            restriction.action_type === 'block' ? 'text-red-500' :
                            restriction.action_type === 'warn' ? 'text-amber-500' :
                            'text-blue-500'
                          }`} />
                          <span className="font-medium">{restriction.name}</span>
                          {restriction.description && (
                            <span className="text-muted-foreground text-sm">
                              - {restriction.description}
                            </span>
                          )}
                        </div>
                        <Badge variant={
                          restriction.action_type === 'block' ? 'destructive' :
                          restriction.action_type === 'warn' ? 'secondary' :
                          'default'
                        }>
                          {getActionLabel(restriction.action_type)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {restrictions.length > 0 && customRules.length > 0 && (
              <Separator />
            )}

            {/* Custom Rules */}
            {customRules.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  חוקים מותאמים
                </h3>
                <div className="grid gap-2">
                  {customRules.map((rule) => {
                    const ActionIcon = getActionIcon(rule.action_type);
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <ActionIcon className={`w-4 h-4 ${
                            rule.action_type === 'block' ? 'text-red-500' :
                            rule.action_type === 'warn' ? 'text-amber-500' :
                            'text-blue-500'
                          }`} />
                          <span className="font-medium">{rule.rule_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {getConditionSummary(rule.condition_json)}
                          </Badge>
                        </div>
                        <Badge variant={
                          rule.action_type === 'block' ? 'destructive' :
                          rule.action_type === 'warn' ? 'secondary' :
                          'default'
                        }>
                          {getActionLabel(rule.action_type)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
