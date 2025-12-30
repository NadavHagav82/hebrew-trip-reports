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
              <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
              הגבלות
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              הגדר פריטים או שירותים שאסורים או דורשים אישור מיוחד
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" />
            הוסף הגבלה
          </Button>
        </div>
        {restrictions.length > 0 && (
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
        )}
      </CardHeader>
      <CardContent>
        {restrictions.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              עדיין לא הוגדרו הגבלות. הוסף הגבלות לפריטים אסורים.
              <br />
              <span className="text-muted-foreground text-xs">
                דוגמאות: ספא, אלכוהול, כביסה, שדרוג מחלקה
              </span>
            </AlertDescription>
          </Alert>
        ) : filteredRestrictions.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              לא נמצאו הגבלות התואמות את החיפוש "{searchQuery}"
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredRestrictions.map((restriction) => (
                <div key={restriction.id} className="border rounded-lg p-3 bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{restriction.name}</span>
                    <Badge variant={restriction.is_active ? 'default' : 'secondary'} className="text-xs">
                      {restriction.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  {restriction.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{restriction.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant={getActionColor(restriction.action_type)} className="text-xs">
                      {getActionLabel(restriction.action_type)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(restriction.category)}
                    </Badge>
                  </div>
                  {restriction.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {restriction.keywords.slice(0, 3).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {kw}
                        </Badge>
                      ))}
                      {restriction.keywords.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{restriction.keywords.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(restriction)} className="flex-1">
                      <Edit className="w-3 h-3 ml-1" />
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(restriction)}
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
                  <TableHead>שם</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>מילות מפתח</TableHead>
                  <TableHead>פעולה</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead className="w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestrictions.map((restriction) => (
                  <TableRow key={restriction.id}>
                    <TableCell className="font-medium">{restriction.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {restriction.description || '-'}
                    </TableCell>
                    <TableCell>{getCategoryLabel(restriction.category)}</TableCell>
                    <TableCell>
                      {restriction.keywords?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {restriction.keywords.slice(0, 3).map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {restriction.keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{restriction.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(restriction.action_type)}>
                        {getActionLabel(restriction.action_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={restriction.is_active ? 'default' : 'secondary'}>
                        {restriction.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(restriction)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(restriction)}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRestriction ? 'ערוך הגבלה' : 'הוסף הגבלה חדשה'}
              </DialogTitle>
              <DialogDescription>
                הגדר פריט או שירות שאסור או דורש אישור
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">שם ההגבלה *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: אלכוהול"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">תיאור</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="הסבר על ההגבלה"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>קטגוריה</Label>
                  <Select
                    value={formData.category || "all"}
                    onValueChange={(v) => setFormData({ ...formData, category: v === "all" ? "" : v })}
                  >
                    <SelectTrigger>
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
              </div>

              <div className="grid gap-2">
                <Label htmlFor="keywords">מילות מפתח</Label>
                <Input
                  id="keywords"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="מילים מופרדות בפסיקים: spa, ספא, massage"
                />
                <p className="text-xs text-muted-foreground">
                  המערכת תחפש מילים אלו בתיאור ההוצאות
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>הגבלה פעילה</Label>
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
                ) : editingRestriction ? (
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
