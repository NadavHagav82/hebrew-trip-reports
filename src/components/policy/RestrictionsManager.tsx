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
  Ban,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FilterBar } from './FilterBar';

interface Restriction {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string | null;
  keywords: string[] | null;
  action_type: string;
  is_active: boolean;
}

interface Props {
  organizationId: string;
}

const CATEGORIES = [
  { value: 'all', label: 'כל הקטגוריות' },
  { value: 'flights', label: 'טיסות' },
  { value: 'accommodation', label: 'לינה' },
  { value: 'food', label: 'אוכל' },
  { value: 'transportation', label: 'תחבורה' },
  { value: 'miscellaneous', label: 'אחר' },
];

const ACTION_TYPES = [
  { value: 'block', label: 'חסום', color: 'destructive' as const },
  { value: 'warn', label: 'התרעה', color: 'secondary' as const },
  { value: 'require_approval', label: 'דורש אישור', color: 'default' as const },
];

export function RestrictionsManager({ organizationId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logChange } = usePolicyAuditLog();
  const [loading, setLoading] = useState(true);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRestriction, setEditingRestriction] = useState<Restriction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    keywords: '',
    action_type: 'block',
    is_active: true,
  });

  const getCategoryLabel = (category: string | null) => {
    if (!category) return 'כל הקטגוריות';
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType)?.label || actionType;
  };

  const getActionColor = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType)?.color || 'secondary';
  };

  const filteredRestrictions = restrictions.filter(restriction => {
    // Filter by status
    if (filterStatus === 'active' && !restriction.is_active) return false;
    if (filterStatus === 'inactive' && restriction.is_active) return false;
    
    // Filter by category
    if (filterCategory !== 'all') {
      if (filterCategory === 'none' && restriction.category !== null) return false;
      if (filterCategory !== 'none' && restriction.category !== filterCategory) return false;
    }
    
    // Filter by action type
    if (filterAction !== 'all' && restriction.action_type !== filterAction) return false;
    
    // Text search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = restriction.name.toLowerCase();
    const description = (restriction.description || '').toLowerCase();
    const keywords = (restriction.keywords || []).join(' ').toLowerCase();
    return name.includes(query) || description.includes(query) || keywords.includes(query);
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCategory('all');
    setFilterAction('all');
  };

  const hasActiveFilters = !!searchQuery || filterStatus !== 'all' || filterCategory !== 'all' || filterAction !== 'all';

  useEffect(() => {
    loadRestrictions();
  }, [organizationId]);

  const loadRestrictions = async () => {
    try {
      const { data, error } = await supabase
        .from('travel_policy_restrictions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setRestrictions(data || []);
    } catch (error: any) {
      console.error('Error loading restrictions:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את ההגבלות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const openCreateDialog = () => {
    setEditingRestriction(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      keywords: '',
      action_type: 'block',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (restriction: Restriction) => {
    setEditingRestriction(restriction);
    setFormData({
      name: restriction.name,
      description: restriction.description || '',
      category: restriction.category || '',
      keywords: restriction.keywords?.join(', ') || '',
      action_type: restriction.action_type,
      is_active: restriction.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם להגבלה',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const keywordsArray = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const restrictionData = {
        organization_id: organizationId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: (formData.category || null) as any,
        keywords: keywordsArray.length > 0 ? keywordsArray : null,
        action_type: formData.action_type as any,
        is_active: formData.is_active,
        created_by: user?.id,
      };

      if (editingRestriction) {
        const { error } = await supabase
          .from('travel_policy_restrictions')
          .update(restrictionData)
          .eq('id', editingRestriction.id);

        if (error) throw error;

        await logChange({
          organizationId,
          action: 'update',
          entityType: 'restriction',
          entityId: editingRestriction.id,
          entityName: formData.name.trim(),
          oldValues: {
            name: editingRestriction.name,
            description: editingRestriction.description,
            category: editingRestriction.category,
            action_type: editingRestriction.action_type,
            keywords: editingRestriction.keywords,
          },
          newValues: restrictionData,
        });

        toast({
          title: 'ההגבלה עודכנה',
          description: `הגבלת "${formData.name}" עודכנה בהצלחה`,
        });
      } else {
        const { data: newRestriction, error } = await supabase
          .from('travel_policy_restrictions')
          .insert(restrictionData)
          .select()
          .single();

        if (error) throw error;

        await logChange({
          organizationId,
          action: 'create',
          entityType: 'restriction',
          entityId: newRestriction?.id,
          entityName: formData.name.trim(),
          newValues: restrictionData,
        });

        toast({
          title: 'ההגבלה נוצרה',
          description: `הגבלת "${formData.name}" נוספה בהצלחה`,
        });
      }

      setDialogOpen(false);
      loadRestrictions();
    } catch (error: any) {
      console.error('Error saving restriction:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת ההגבלה',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (restriction: Restriction) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הגבלת "${restriction.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('travel_policy_restrictions')
        .delete()
        .eq('id', restriction.id);

      if (error) throw error;

      await logChange({
        organizationId,
        action: 'delete',
        entityType: 'restriction',
        entityId: restriction.id,
        entityName: restriction.name,
        oldValues: {
          name: restriction.name,
          description: restriction.description,
          category: restriction.category,
          action_type: restriction.action_type,
          keywords: restriction.keywords,
        },
      });

      toast({
        title: 'ההגבלה נמחקה',
        description: `הגבלת "${restriction.name}" נמחקה בהצלחה`,
      });

      loadRestrictions();
    } catch (error: any) {
      console.error('Error deleting restriction:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת ההגבלה',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-rose-200 border-t-rose-500 animate-spin" />
          <span className="text-sm text-muted-foreground">טוען הגבלות...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 border border-rose-100/50 p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-rose-200/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-pink-200/30 to-transparent rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
        
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-200/50">
              <Ban className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">הגבלות</h2>
              <p className="text-sm text-gray-600 mt-1">הגדר פריטים או שירותים שאסורים או דורשים אישור מיוחד</p>
            </div>
          </div>
          <Button 
            onClick={openCreateDialog} 
            className="w-full sm:w-auto bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-lg shadow-rose-200/50"
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף הגבלה
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      {restrictions.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-gray-500 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">סינון וחיפוש</h3>
              <p className="text-xs text-gray-500">מצא את ההגבלות שאתה מחפש</p>
            </div>
          </div>
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="חיפוש לפי שם, תיאור או מילות מפתח..."
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
                  { value: 'none', label: 'ללא קטגוריה' },
                  ...CATEGORIES.filter(c => c.value !== 'all').map((cat) => ({ value: cat.value, label: cat.label })),
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
            totalCount={restrictions.length}
            filteredCount={filteredRestrictions.length}
          />
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {restrictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center mb-4">
              <Ban className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">אין הגבלות</h3>
            <p className="text-sm text-gray-500 text-center max-w-md mb-2">
              עדיין לא הוגדרו הגבלות. הוסף הגבלות לפריטים אסורים.
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              דוגמאות: ספא, אלכוהול, כביסה, שדרוג מחלקה
            </p>
            <Button 
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף הגבלה ראשונה
            </Button>
          </div>
        ) : filteredRestrictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-sm text-gray-600 text-center">
              לא נמצאו הגבלות התואמות את החיפוש "{searchQuery}"
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredRestrictions.map((restriction) => (
                <div 
                  key={restriction.id} 
                  className="p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        restriction.action_type === 'block' ? 'bg-gradient-to-br from-rose-100 to-red-100' :
                        restriction.action_type === 'warn' ? 'bg-gradient-to-br from-amber-100 to-yellow-100' :
                        'bg-gradient-to-br from-blue-100 to-indigo-100'
                      }`}>
                        <Ban className={`w-5 h-5 ${
                          restriction.action_type === 'block' ? 'text-rose-600' :
                          restriction.action_type === 'warn' ? 'text-amber-600' :
                          'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{restriction.name}</h3>
                        <p className="text-xs text-gray-500">{getCategoryLabel(restriction.category)}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline"
                      className={`text-xs ${restriction.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      {restriction.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  
                  {restriction.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{restriction.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge 
                      variant="outline"
                      className={`text-xs ${
                        restriction.action_type === 'block' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        restriction.action_type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {getActionLabel(restriction.action_type)}
                    </Badge>
                    {restriction.keywords?.slice(0, 2).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        {kw}
                      </Badge>
                    ))}
                    {restriction.keywords && restriction.keywords.length > 2 && (
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        +{restriction.keywords.length - 2}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => openEditDialog(restriction)} 
                      className="flex-1 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Edit className="w-4 h-4 ml-1" />
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(restriction)}
                      className="flex-1 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      מחיקה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="font-semibold text-gray-700">שם</TableHead>
                    <TableHead className="font-semibold text-gray-700">תיאור</TableHead>
                    <TableHead className="font-semibold text-gray-700">קטגוריה</TableHead>
                    <TableHead className="font-semibold text-gray-700">מילות מפתח</TableHead>
                    <TableHead className="font-semibold text-gray-700">פעולה</TableHead>
                    <TableHead className="font-semibold text-gray-700 w-24">סטטוס</TableHead>
                    <TableHead className="font-semibold text-gray-700 w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRestrictions.map((restriction) => (
                    <TableRow 
                      key={restriction.id}
                      className="group hover:bg-rose-50/30 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            restriction.action_type === 'block' ? 'bg-gradient-to-br from-rose-100 to-red-100' :
                            restriction.action_type === 'warn' ? 'bg-gradient-to-br from-amber-100 to-yellow-100' :
                            'bg-gradient-to-br from-blue-100 to-indigo-100'
                          }`}>
                            <Ban className={`w-5 h-5 ${
                              restriction.action_type === 'block' ? 'text-rose-600' :
                              restriction.action_type === 'warn' ? 'text-amber-600' :
                              'text-blue-600'
                            }`} />
                          </div>
                          <span className="font-medium text-gray-800">{restriction.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 max-w-[200px] truncate">
                        {restriction.description || <span className="italic text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-gray-600">{getCategoryLabel(restriction.category)}</TableCell>
                      <TableCell>
                        {restriction.keywords?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {restriction.keywords.slice(0, 3).map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                {kw}
                              </Badge>
                            ))}
                            {restriction.keywords.length > 3 && (
                              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                +{restriction.keywords.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="italic text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={`${
                            restriction.action_type === 'block' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            restriction.action_type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {getActionLabel(restriction.action_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={restriction.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-gray-50 text-gray-600 border-gray-200'}
                        >
                          {restriction.is_active ? 'פעיל' : 'לא פעיל'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openEditDialog(restriction)}
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(restriction)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                <Ban className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {editingRestriction ? 'ערוך הגבלה' : 'הוסף הגבלה חדשה'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  הגדר פריט או שירות שאסור או דורש אישור
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium">שם ההגבלה *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: אלכוהול"
                className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="הסבר על ההגבלה"
                rows={2}
                className="bg-gray-50/50 border-gray-200 focus:bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">קטגוריה</Label>
                <Select
                  value={formData.category || "all"}
                  onValueChange={(v) => setFormData({ ...formData, category: v === "all" ? "" : v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
                    <SelectValue placeholder="כל הקטגוריות" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">פעולה</Label>
                <Select
                  value={formData.action_type}
                  onValueChange={(v) => setFormData({ ...formData, action_type: v })}
                >
                  <SelectTrigger className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white">
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="keywords" className="text-sm font-medium">מילות מפתח</Label>
              <Input
                id="keywords"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="מילים מופרדות בפסיקים: spa, ספא, massage"
                className="h-10 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <p className="text-xs text-gray-500">
                המערכת תחפש מילים אלו בתיאור ההוצאות
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50/80 border border-gray-100">
              <div>
                <Label className="text-sm font-medium">הגבלה פעילה</Label>
                <p className="text-xs text-gray-500">הפעל או השבת את ההגבלה</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                className="data-[state=checked]:bg-rose-500"
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
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : editingRestriction ? (
                'עדכן'
              ) : (
                'הוסף'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
