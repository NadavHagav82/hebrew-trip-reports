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
  Plane,
  Hotel,
  Utensils,
  Car,
  MoreHorizontal,
  AlertCircle,
  Upload
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FilterBar } from './FilterBar';
import { PolicyImportDialog } from './PolicyImportDialog';

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
  const { logChange } = usePolicyAuditLog();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<TravelPolicyRule[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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

  const handleImportRules = async (parsedRules: any[]) => {
    for (const rule of parsedRules) {
      const ruleData = {
        organization_id: organizationId,
        category: rule.category as any,
        grade_id: null, // Will need to match by name if provided
        max_amount: rule.max_amount || null,
        currency: (rule.currency || 'ILS') as any,
        destination_type: (rule.destination_type || 'all') as any,
        per_type: (rule.per_type || 'per_trip') as any,
        notes: rule.notes || null,
        is_active: true,
        created_by: user?.id,
      };

      // Try to find matching grade
      if (rule.grade) {
        const matchingGrade = grades.find(g => 
          g.name.toLowerCase().includes(rule.grade.toLowerCase()) ||
          rule.grade.toLowerCase().includes(g.name.toLowerCase())
        );
        if (matchingGrade) {
          ruleData.grade_id = matchingGrade.id;
        }
      }

      const { error } = await supabase
        .from('travel_policy_rules')
        .insert(ruleData);

      if (error) throw error;
    }

    loadData();
  };

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

        await logChange({
          organizationId,
          action: 'update',
          entityType: 'travel_rule',
          entityId: editingRule.id,
          entityName: getCategoryLabel(formData.category),
          oldValues: {
            category: editingRule.category,
            max_amount: editingRule.max_amount,
            currency: editingRule.currency,
            destination_type: editingRule.destination_type,
            per_type: editingRule.per_type,
          },
          newValues: ruleData,
        });

        toast({
          title: 'החוק עודכן',
          description: 'חוק המדיניות עודכן בהצלחה',
        });
      } else {
        const { data: newRule, error } = await supabase
          .from('travel_policy_rules')
          .insert(ruleData)
          .select()
          .single();

        if (error) throw error;

        await logChange({
          organizationId,
          action: 'create',
          entityType: 'travel_rule',
          entityId: newRule?.id,
          entityName: getCategoryLabel(formData.category),
          newValues: ruleData,
        });

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

      await logChange({
        organizationId,
        action: 'delete',
        entityType: 'travel_rule',
        entityId: rule.id,
        entityName: getCategoryLabel(rule.category),
        oldValues: {
          category: rule.category,
          max_amount: rule.max_amount,
          currency: rule.currency,
          destination_type: rule.destination_type,
          per_type: rule.per_type,
        },
      });

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
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          <span className="text-sm text-muted-foreground">טוען חוקים...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 border border-sky-100/50 p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-sky-200/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-cyan-200/30 to-transparent rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
        
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-200/50">
              <Plane className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">חוקי קטגוריות</h2>
              <p className="text-sm text-gray-600 mt-1">הגדר מגבלות תקציב לפי קטגוריית הוצאה ודרגת עובד</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setImportDialogOpen(true)} 
              className="flex-1 sm:flex-initial bg-white/80 border-sky-200 hover:bg-sky-50 hover:border-sky-300"
            >
              <Upload className="w-4 h-4 ml-2" />
              <span className="hidden sm:inline">ייבוא</span>
            </Button>
            <Button 
              onClick={openCreateDialog} 
              className="flex-1 sm:flex-initial bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 shadow-lg shadow-sky-200/50"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף חוק
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      {rules.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-gray-500 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">סינון וחיפוש</h3>
              <p className="text-xs text-gray-500">מצא את החוקים שאתה מחפש</p>
            </div>
          </div>
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
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 flex items-center justify-center mb-4">
              <Plane className="w-8 h-8 text-sky-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">אין חוקי קטגוריות</h3>
            <p className="text-sm text-gray-500 text-center max-w-md mb-6">
              עדיין לא הוגדרו חוקי קטגוריות. הוסף חוקים כדי להגביל הוצאות לפי קטגוריה.
            </p>
            <Button 
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף חוק ראשון
            </Button>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-sm text-gray-600 text-center">
              לא נמצאו חוקים התואמים את החיפוש "{searchQuery}"
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredRules.map((rule, index) => {
                const Icon = getCategoryIcon(rule.category);
                return (
                  <div 
                    key={rule.id} 
                    className="p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          rule.category === 'flights' ? 'bg-gradient-to-br from-sky-100 to-blue-100' :
                          rule.category === 'accommodation' ? 'bg-gradient-to-br from-violet-100 to-purple-100' :
                          rule.category === 'food' ? 'bg-gradient-to-br from-orange-100 to-amber-100' :
                          rule.category === 'transportation' ? 'bg-gradient-to-br from-emerald-100 to-green-100' :
                          'bg-gradient-to-br from-gray-100 to-slate-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            rule.category === 'flights' ? 'text-sky-600' :
                            rule.category === 'accommodation' ? 'text-violet-600' :
                            rule.category === 'food' ? 'text-orange-600' :
                            rule.category === 'transportation' ? 'text-emerald-600' :
                            'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{getCategoryLabel(rule.category)}</h3>
                          <p className="text-xs text-gray-500">{getGradeName(rule.grade_id)}</p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={`text-xs ${rule.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >
                        {rule.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-sky-50/50 rounded-lg p-2">
                        <span className="text-xs text-gray-500 block">תקרה</span>
                        <span className="text-sm font-semibold text-sky-700">
                          {rule.max_amount ? `${rule.max_amount.toLocaleString()} ${rule.currency}` : 'ללא הגבלה'}
                        </span>
                      </div>
                      <div className="bg-purple-50/50 rounded-lg p-2">
                        <span className="text-xs text-gray-500 block">יעד</span>
                        <span className="text-sm font-semibold text-purple-700">{getDestinationLabel(rule.destination_type)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openEditDialog(rule)} 
                        className="flex-1 h-9 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        עריכה
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule)}
                        className="flex-1 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4 ml-1" />
                        מחיקה
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="font-semibold text-gray-700">קטגוריה</TableHead>
                    <TableHead className="font-semibold text-gray-700">דרגה</TableHead>
                    <TableHead className="font-semibold text-gray-700">תקרה</TableHead>
                    <TableHead className="font-semibold text-gray-700">יעד</TableHead>
                    <TableHead className="font-semibold text-gray-700">לכל</TableHead>
                    <TableHead className="font-semibold text-gray-700 w-24">סטטוס</TableHead>
                    <TableHead className="font-semibold text-gray-700 w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const Icon = getCategoryIcon(rule.category);
                    return (
                      <TableRow 
                        key={rule.id}
                        className="group hover:bg-sky-50/30 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              rule.category === 'flights' ? 'bg-gradient-to-br from-sky-100 to-blue-100' :
                              rule.category === 'accommodation' ? 'bg-gradient-to-br from-violet-100 to-purple-100' :
                              rule.category === 'food' ? 'bg-gradient-to-br from-orange-100 to-amber-100' :
                              rule.category === 'transportation' ? 'bg-gradient-to-br from-emerald-100 to-green-100' :
                              'bg-gradient-to-br from-gray-100 to-slate-100'
                            }`}>
                              <Icon className={`w-5 h-5 ${
                                rule.category === 'flights' ? 'text-sky-600' :
                                rule.category === 'accommodation' ? 'text-violet-600' :
                                rule.category === 'food' ? 'text-orange-600' :
                                rule.category === 'transportation' ? 'text-emerald-600' :
                                'text-gray-600'
                              }`} />
                            </div>
                            <span className="font-medium text-gray-800">{getCategoryLabel(rule.category)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">{getGradeName(rule.grade_id)}</TableCell>
                        <TableCell>
                          {rule.max_amount ? (
                            <span className="font-mono font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded">
                              {rule.max_amount.toLocaleString()} {rule.currency}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">ללא הגבלה</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-600">{getDestinationLabel(rule.destination_type)}</TableCell>
                        <TableCell className="text-gray-600">{getPerTypeLabel(rule.per_type)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={rule.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-gray-50 text-gray-600 border-gray-200'}
                          >
                            {rule.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditDialog(rule)}
                              className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule)}
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
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
            </div>
          </>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {editingRule ? 'ערוך חוק קטגוריה' : 'הוסף חוק קטגוריה חדש'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  הגדר מגבלת תקציב לקטגוריית הוצאה
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">קטגוריה</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
                <Label className="text-sm font-medium">דרגת עובד</Label>
                <Select
                  value={formData.grade_id || "all"}
                  onValueChange={(v) => setFormData({ ...formData, grade_id: v === "all" ? "" : v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
                <Label className="text-sm font-medium">תקרת סכום</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                  placeholder="ללא הגבלה"
                  className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">מטבע</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
                <Label className="text-sm font-medium">סוג יעד</Label>
                <Select
                  value={formData.destination_type}
                  onValueChange={(v) => setFormData({ ...formData, destination_type: v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
                <Label className="text-sm font-medium">לכל</Label>
                <Select
                  value={formData.per_type}
                  onValueChange={(v) => setFormData({ ...formData, per_type: v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
              <Label className="text-sm font-medium">הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הערות נוספות לחוק זה"
                rows={2}
                className="bg-gray-50/50 border-gray-200 focus:bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50/80 border border-gray-100">
              <div>
                <Label className="text-sm font-medium">חוק פעיל</Label>
                <p className="text-xs text-gray-500">הפעל או השבת את החוק</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600"
            >
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

      <PolicyImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportRules}
        type="category_rules"
      />
    </div>
  );
}
