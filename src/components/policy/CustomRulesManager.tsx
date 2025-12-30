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
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

        toast({
          title: 'החוק עודכן',
          description: `חוק "${formData.rule_name}" עודכן בהצלחה`,
        });
      } else {
        const { error } = await supabase
          .from('custom_travel_rules')
          .insert(ruleData);

        if (error) throw error;

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              חוקים מותאמים אישית
            </CardTitle>
            <CardDescription>
              צור חוקים מורכבים ומותאמים לצרכי הארגון
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף חוק
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              עדיין לא הוגדרו חוקים מותאמים. הוסף חוקים לבקרה מתקדמת.
              <br />
              <span className="text-muted-foreground text-sm">
                דוגמאות: מגבלת ימי נסיעה, הזמנה מראש, תקציב כולל
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
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
              {rules.map((rule) => (
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
