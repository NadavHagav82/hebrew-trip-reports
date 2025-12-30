import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { usePolicyAuditLog } from '@/hooks/usePolicyAuditLog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  Sparkles,
  AlertCircle,
  Code
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FilterBar } from './FilterBar';

interface CustomRule {
  id: string;
  organization_id: string;
  rule_name: string;
  description: string | null;
  condition_json: any;
  action_type: string;
  applies_to_grades: string[] | null;
  is_active: boolean;
  priority: number;
}

interface EmployeeGrade {
  id: string;
  name: string;
}

interface Props {
  organizationId: string;
}

const ACTION_TYPES = [
  { value: 'block', label: 'חסום', color: 'destructive' as const },
  { value: 'warn', label: 'התרעה', color: 'secondary' as const },
  { value: 'require_approval', label: 'דורש אישור', color: 'default' as const },
];

const CONDITION_TEMPLATES = [
  { 
    value: 'max_trip_duration',
    label: 'מגבלת ימי נסיעה',
    description: 'הגבל את מספר ימי הנסיעה המקסימלי',
    defaultCondition: { type: 'max_trip_duration', max_days: 7 }
  },
  { 
    value: 'max_total_budget',
    label: 'תקציב כולל לנסיעה',
    description: 'הגבל את סך התקציב לנסיעה',
    defaultCondition: { type: 'max_total_budget', max_amount: 10000, currency: 'ILS' }
  },
  { 
    value: 'weekend_travel',
    label: 'נסיעה בסוף שבוע',
    description: 'בדוק אם הנסיעה כוללת סוף שבוע',
    defaultCondition: { type: 'weekend_travel' }
  },
  { 
    value: 'advance_booking',
    label: 'הזמנה מראש',
    description: 'דרוש הזמנה מספר ימים מראש',
    defaultCondition: { type: 'advance_booking', min_days: 14 }
  },
  { 
    value: 'custom',
    label: 'חוק מותאם אישית',
    description: 'הגדר תנאים מותאמים אישית',
    defaultCondition: {}
  },
];

export function CustomRulesManager({ organizationId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logChange } = usePolicyAuditLog();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [formData, setFormData] = useState({
    rule_name: '',
    description: '',
    condition_template: 'max_trip_duration',
    condition_value: '',
    action_type: 'warn',
    applies_to_grades: [] as string[],
    priority: 0,
    is_active: true,
  });

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType)?.label || actionType;
  };

  const getActionColor = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType)?.color || 'secondary';
  };

  const getConditionSummary = (condition: any) => {
    if (!condition || Object.keys(condition).length === 0) return 'ללא תנאים';
    
    switch (condition.type) {
      case 'max_trip_duration':
        return `מקסימום ${condition.max_days} ימים`;
      case 'max_total_budget':
        return `תקציב: ${condition.max_amount?.toLocaleString()} ${condition.currency}`;
      case 'weekend_travel':
        return 'נסיעה בסוף שבוע';
      case 'advance_booking':
        return `הזמנה ${condition.min_days} ימים מראש`;
      default:
        return 'חוק מותאם';
    }
  };

  const filteredRules = rules.filter(rule => {
    // Filter by status
    if (filterStatus === 'active' && !rule.is_active) return false;
    if (filterStatus === 'inactive' && rule.is_active) return false;
    
    // Filter by action type
    if (filterAction !== 'all' && rule.action_type !== filterAction) return false;
    
    // Text search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = rule.rule_name.toLowerCase();
    const description = (rule.description || '').toLowerCase();
    const conditionSummary = getConditionSummary(rule.condition_json).toLowerCase();
    return name.includes(query) || description.includes(query) || conditionSummary.includes(query);
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterAction('all');
  };

  const hasActiveFilters = !!searchQuery || filterStatus !== 'all' || filterAction !== 'all';

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      const [rulesRes, gradesRes] = await Promise.all([
        supabase
          .from('custom_travel_rules')
          .select('*')
          .eq('organization_id', organizationId)
          .order('priority', { ascending: false }),
        supabase
          .from('employee_grades')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('level', { ascending: true }),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (gradesRes.error) throw gradesRes.error;

      setRules(rulesRes.data || []);
      setGrades(gradesRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      rule_name: '',
      description: '',
      condition_template: 'max_trip_duration',
      condition_value: '7',
      action_type: 'warn',
      applies_to_grades: [],
      priority: 0,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rule: CustomRule) => {
    setEditingRule(rule);
    const condition = rule.condition_json || {};
    let template = 'custom';
    let value = '';

    if (condition.type === 'max_trip_duration') {
      template = 'max_trip_duration';
      value = condition.max_days?.toString() || '';
    } else if (condition.type === 'max_total_budget') {
      template = 'max_total_budget';
      value = condition.max_amount?.toString() || '';
    } else if (condition.type === 'advance_booking') {
      template = 'advance_booking';
      value = condition.min_days?.toString() || '';
    } else if (condition.type === 'weekend_travel') {
      template = 'weekend_travel';
    }

    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || '',
      condition_template: template,
      condition_value: value,
      action_type: rule.action_type,
      applies_to_grades: rule.applies_to_grades || [],
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const buildConditionJson = () => {
    const template = CONDITION_TEMPLATES.find(t => t.value === formData.condition_template);
    if (!template) return {};

    const base = { ...template.defaultCondition };
    
    if (formData.condition_template === 'max_trip_duration' && formData.condition_value) {
      base.max_days = parseInt(formData.condition_value);
    } else if (formData.condition_template === 'max_total_budget' && formData.condition_value) {
      base.max_amount = parseFloat(formData.condition_value);
    } else if (formData.condition_template === 'advance_booking' && formData.condition_value) {
      base.min_days = parseInt(formData.condition_value);
    }

    return base;
  };

  const handleSubmit = async () => {
    if (!formData.rule_name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לחוק',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const ruleData = {
        organization_id: organizationId,
        rule_name: formData.rule_name.trim(),
        description: formData.description.trim() || null,
        condition_json: buildConditionJson(),
        action_type: formData.action_type as any,
        applies_to_grades: formData.applies_to_grades.length > 0 ? formData.applies_to_grades : null,
        priority: formData.priority,
        is_active: formData.is_active,
        created_by: user?.id,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('custom_travel_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;

        await logChange({
          organizationId,
          action: 'update',
          entityType: 'custom_rule',
          entityId: editingRule.id,
          entityName: formData.rule_name.trim(),
          oldValues: {
            rule_name: editingRule.rule_name,
            description: editingRule.description,
            condition_json: editingRule.condition_json,
            action_type: editingRule.action_type,
            priority: editingRule.priority,
          },
          newValues: ruleData,
        });

        toast({
          title: 'החוק עודכן',
          description: `חוק "${formData.rule_name}" עודכן בהצלחה`,
        });
      } else {
        const { data: newRule, error } = await supabase
          .from('custom_travel_rules')
          .insert(ruleData)
          .select()
          .single();

        if (error) throw error;

        await logChange({
          organizationId,
          action: 'create',
          entityType: 'custom_rule',
          entityId: newRule?.id,
          entityName: formData.rule_name.trim(),
          newValues: ruleData,
        });

        toast({
          title: 'החוק נוצר',
          description: `חוק "${formData.rule_name}" נוסף בהצלחה`,
        });
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת החוק',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule: CustomRule) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את חוק "${rule.rule_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_travel_rules')
        .delete()
        .eq('id', rule.id);

      if (error) throw error;

      await logChange({
        organizationId,
        action: 'delete',
        entityType: 'custom_rule',
        entityId: rule.id,
        entityName: rule.rule_name,
        oldValues: {
          rule_name: rule.rule_name,
          description: rule.description,
          condition_json: rule.condition_json,
          action_type: rule.action_type,
          priority: rule.priority,
        },
      });

      toast({
        title: 'החוק נמחק',
        description: `חוק "${rule.rule_name}" נמחק בהצלחה`,
      });

      loadData();
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת החוק',
        variant: 'destructive',
      });
    }
  };

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              חוקים מותאמים אישית
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              צור חוקים מורכבים ומותאמים לצרכי הארגון
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" />
            הוסף חוק
          </Button>
        </div>
        {rules.length > 0 && (
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="חיפוש לפי שם חוק, תיאור או תנאי..."
            filters={[
              {
                key: 'status',
                label: 'סטטוס',
                placeholder: 'סטטוס',
                value: filterStatus,
                onChange: (v) => setFilterStatus(v as 'all' | 'active' | 'inactive'),
                options: [
                  { value: 'all', label: 'כל הסטטוסים' },
                  { value: 'active', label: 'פעיל' },
                  { value: 'inactive', label: 'לא פעיל' },
                ],
              },
              {
                key: 'action',
                label: 'פעולה',
                placeholder: 'פעולה',
                value: filterAction,
                onChange: setFilterAction,
                options: [
                  { value: 'all', label: 'כל הפעולות' },
                  ...ACTION_TYPES.map((action) => ({ value: action.value, label: action.label })),
                ],
              },
            ]}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            totalCount={rules.length}
            filteredCount={filteredRules.length}
          />
        )}
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              עדיין לא הוגדרו חוקים מותאמים. הוסף חוקים לבקרה מתקדמת.
              <br />
              <span className="text-muted-foreground text-xs">
                דוגמאות: מגבלת ימי נסיעה, הזמנה מראש, תקציב כולל
              </span>
            </AlertDescription>
          </Alert>
        ) : filteredRules.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              לא נמצאו חוקים התואמים את החיפוש "{searchQuery}"
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredRules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-3 bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{rule.rule_name}</span>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">
                      {rule.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant={getActionColor(rule.action_type)} className="text-xs">
                      {getActionLabel(rule.action_type)}
                    </Badge>
                    <Badge variant="outline" className="font-normal text-xs">
                      <Code className="w-2.5 h-2.5 ml-1" />
                      {getConditionSummary(rule.condition_json)}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      עדיפות: {rule.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)} className="flex-1">
                      <Edit className="w-3 h-3 ml-1" />
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule)}
                      className="flex-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 ml-1" />
                      מחיקה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead>שם החוק</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>תנאי</TableHead>
                  <TableHead>פעולה</TableHead>
                  <TableHead>עדיפות</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead className="w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {rule.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        <Code className="w-3 h-3 ml-1" />
                        {getConditionSummary(rule.condition_json)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(rule.action_type)}>
                        {getActionLabel(rule.action_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {rule.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rule)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'ערוך חוק מותאם' : 'הוסף חוק מותאם חדש'}
              </DialogTitle>
              <DialogDescription>
                הגדר חוק מותאם אישית לבקרת נסיעות
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rule_name">שם החוק *</Label>
                <Input
                  id="rule_name"
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  placeholder="לדוגמה: מגבלת נסיעה שבועית"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">תיאור</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="הסבר על החוק"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label>סוג התנאי</Label>
                <Select
                  value={formData.condition_template}
                  onValueChange={(v) => setFormData({ ...formData, condition_template: v, condition_value: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TEMPLATES.map((template) => (
                      <SelectItem key={template.value} value={template.value}>
                        <div>
                          <div>{template.label}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {['max_trip_duration', 'max_total_budget', 'advance_booking'].includes(formData.condition_template) && (
                <div className="grid gap-2">
                  <Label htmlFor="condition_value">
                    {formData.condition_template === 'max_trip_duration' && 'מספר ימים מקסימלי'}
                    {formData.condition_template === 'max_total_budget' && 'תקציב מקסימלי (₪)'}
                    {formData.condition_template === 'advance_booking' && 'ימים מראש'}
                  </Label>
                  <Input
                    id="condition_value"
                    type="number"
                    min={1}
                    value={formData.condition_value}
                    onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>פעולה</Label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(v) => setFormData({ ...formData, action_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">עדיפות</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>חוק פעיל</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                ביטול
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    שומר...
                  </>
                ) : editingRule ? (
                  'עדכן'
                ) : (
                  'הוסף'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
