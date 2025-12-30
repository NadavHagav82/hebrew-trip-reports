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
  Plane,
  Hotel,
  Utensils,
  Car,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FilterBar } from './FilterBar';

interface EmployeeGrade {
  id: string;
  name: string;
  level: number;
}

interface TravelPolicyRule {
  id: string;
  organization_id: string;
  category: string;
  grade_id: string | null;
  max_amount: number | null;
  currency: string;
  destination_type: string;
  destination_countries: string[] | null;
  per_type: string;
  notes: string | null;
  is_active: boolean;
}

interface Props {
  organizationId: string;
}

const CATEGORIES = [
  { value: 'flights', label: 'טיסות', icon: Plane },
  { value: 'accommodation', label: 'לינה', icon: Hotel },
  { value: 'food', label: 'אוכל', icon: Utensils },
  { value: 'transportation', label: 'תחבורה', icon: Car },
  { value: 'miscellaneous', label: 'אחר', icon: MoreHorizontal },
];

const CURRENCIES = [
  { value: 'ILS', label: '₪ שקל' },
  { value: 'USD', label: '$ דולר' },
  { value: 'EUR', label: '€ אירו' },
];

const DESTINATION_TYPES = [
  { value: 'all', label: 'כל היעדים' },
  { value: 'domestic', label: 'נסיעות מקומיות' },
  { value: 'international', label: 'נסיעות בינלאומיות' },
];

const PER_TYPES = [
  { value: 'per_trip', label: 'לנסיעה' },
  { value: 'per_day', label: 'ליום' },
  { value: 'per_item', label: 'לפריט' },
];

export function CategoryRulesManager({ organizationId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<TravelPolicyRule[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TravelPolicyRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [formData, setFormData] = useState({
    category: 'flights' as string,
    grade_id: '' as string,
    max_amount: '' as string,
    currency: 'ILS',
    destination_type: 'all',
    per_type: 'per_trip',
    notes: '',
    is_active: true,
  });

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || MoreHorizontal;
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getGradeName = (gradeId: string | null) => {
    if (!gradeId) return 'כל הדרגות';
    return grades.find(g => g.id === gradeId)?.name || 'לא ידוע';
  };

  const getPerTypeLabel = (perType: string) => {
    return PER_TYPES.find(p => p.value === perType)?.label || perType;
  };

  const getDestinationLabel = (destType: string) => {
    return DESTINATION_TYPES.find(d => d.value === destType)?.label || destType;
  };

  const filteredRules = rules.filter(rule => {
    // Filter by status
    if (filterStatus === 'active' && !rule.is_active) return false;
    if (filterStatus === 'inactive' && rule.is_active) return false;
    
    // Filter by category
    if (filterCategory !== 'all' && rule.category !== filterCategory) return false;
    
    // Filter by grade
    if (filterGrade !== 'all') {
      if (filterGrade === 'none' && rule.grade_id !== null) return false;
      if (filterGrade !== 'none' && rule.grade_id !== filterGrade) return false;
    }
    
    // Text search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const categoryLabel = getCategoryLabel(rule.category).toLowerCase();
    const gradeName = getGradeName(rule.grade_id).toLowerCase();
    const notes = (rule.notes || '').toLowerCase();
    return categoryLabel.includes(query) || gradeName.includes(query) || notes.includes(query);
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCategory('all');
    setFilterGrade('all');
  };

  const hasActiveFilters = !!searchQuery || filterStatus !== 'all' || filterCategory !== 'all' || filterGrade !== 'all';

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      const [rulesRes, gradesRes] = await Promise.all([
        supabase
          .from('travel_policy_rules')
          .select('*')
          .eq('organization_id', organizationId)
          .order('category', { ascending: true }),
        supabase
          .from('employee_grades')
          .select('id, name, level')
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
      category: 'flights',
      grade_id: '',
      max_amount: '',
      currency: 'ILS',
      destination_type: 'all',
      per_type: 'per_trip',
      notes: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rule: TravelPolicyRule) => {
    setEditingRule(rule);
    setFormData({
      category: rule.category,
      grade_id: rule.grade_id || '',
      max_amount: rule.max_amount?.toString() || '',
      currency: rule.currency,
      destination_type: rule.destination_type,
      per_type: rule.per_type,
      notes: rule.notes || '',
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ruleData = {
        organization_id: organizationId,
        category: formData.category as any,
        grade_id: formData.grade_id || null,
        max_amount: formData.max_amount ? parseFloat(formData.max_amount) : null,
        currency: formData.currency as any,
        destination_type: formData.destination_type as any,
        per_type: formData.per_type as any,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        created_by: user?.id,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('travel_policy_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;

        toast({
          title: 'החוק עודכן',
          description: 'חוק המדיניות עודכן בהצלחה',
        });
      } else {
        const { error } = await supabase
          .from('travel_policy_rules')
          .insert(ruleData);

        if (error) throw error;

        toast({
          title: 'החוק נוצר',
          description: 'חוק מדיניות חדש נוסף בהצלחה',
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

  const handleDelete = async (rule: TravelPolicyRule) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק חוק זה?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('travel_policy_rules')
        .delete()
        .eq('id', rule.id);

      if (error) throw error;

      toast({
        title: 'החוק נמחק',
        description: 'חוק המדיניות נמחק בהצלחה',
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
              <Plane className="w-5 h-5" />
              חוקי קטגוריות
            </CardTitle>
            <CardDescription>
              הגדר מגבלות תקציב לפי קטגוריית הוצאה ודרגת עובד
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף חוק
          </Button>
        </div>
        {rules.length > 0 && (
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="חיפוש לפי קטגוריה, דרגה או הערות..."
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
                key: 'category',
                label: 'קטגוריה',
                placeholder: 'קטגוריה',
                value: filterCategory,
                onChange: setFilterCategory,
                options: [
                  { value: 'all', label: 'כל הקטגוריות' },
                  ...CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
                ],
              },
              {
                key: 'grade',
                label: 'דרגה',
                placeholder: 'דרגה',
                value: filterGrade,
                onChange: setFilterGrade,
                options: [
                  { value: 'all', label: 'כל הדרגות' },
                  { value: 'none', label: 'ללא דרגה' },
                  ...grades.map((grade) => ({ value: grade.id, label: grade.name })),
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
            <AlertDescription>
              עדיין לא הוגדרו חוקי קטגוריות. הוסף חוקים כדי להגביל הוצאות לפי קטגוריה.
            </AlertDescription>
          </Alert>
        ) : filteredRules.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              לא נמצאו חוקים התואמים את החיפוש "{searchQuery}"
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>קטגוריה</TableHead>
                <TableHead>דרגה</TableHead>
                <TableHead>תקרה</TableHead>
                <TableHead>יעד</TableHead>
                <TableHead>לכל</TableHead>
                <TableHead className="w-24">סטטוס</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule) => {
                const Icon = getCategoryIcon(rule.category);
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{getCategoryLabel(rule.category)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getGradeName(rule.grade_id)}</TableCell>
                    <TableCell>
                      {rule.max_amount ? (
                        <span className="font-mono">
                          {rule.max_amount.toLocaleString()} {rule.currency}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">ללא הגבלה</span>
                      )}
                    </TableCell>
                    <TableCell>{getDestinationLabel(rule.destination_type)}</TableCell>
                    <TableCell>{getPerTypeLabel(rule.per_type)}</TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'ערוך חוק קטגוריה' : 'הוסף חוק קטגוריה חדש'}
              </DialogTitle>
              <DialogDescription>
                הגדר מגבלת תקציב לקטגוריית הוצאה
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>קטגוריה</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>דרגת עובד</Label>
                  <Select
                    value={formData.grade_id || "all"}
                    onValueChange={(v) => setFormData({ ...formData, grade_id: v === "all" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="כל הדרגות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הדרגות</SelectItem>
                      {grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>תקרת סכום</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.max_amount}
                    onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                    placeholder="ללא הגבלה"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>מטבע</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => setFormData({ ...formData, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>סוג יעד</Label>
                  <Select
                    value={formData.destination_type}
                    onValueChange={(v) => setFormData({ ...formData, destination_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESTINATION_TYPES.map((dest) => (
                        <SelectItem key={dest.value} value={dest.value}>
                          {dest.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>לכל</Label>
                  <Select
                    value={formData.per_type}
                    onValueChange={(v) => setFormData({ ...formData, per_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PER_TYPES.map((per) => (
                        <SelectItem key={per.value} value={per.value}>
                          {per.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות לחוק זה"
                  rows={2}
                />
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
