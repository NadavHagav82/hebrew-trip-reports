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
  Users,
  GripVertical,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmployeeGrade {
  id: string;
  organization_id: string;
  name: string;
  level: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  organizationId: string;
}

export function EmployeeGradesManager({ organizationId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logChange } = usePolicyAuditLog();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<EmployeeGrade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    level: 1,
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadGrades();
  }, [organizationId]);

  const loadGrades = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_grades')
        .select('*')
        .eq('organization_id', organizationId)
        .order('level', { ascending: true });

      if (error) throw error;
      setGrades(data || []);
    } catch (error: any) {
      console.error('Error loading grades:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את דרגות העובדים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingGrade(null);
    setFormData({
      name: '',
      level: grades.length + 1,
      description: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (grade: EmployeeGrade) => {
    setEditingGrade(grade);
    setFormData({
      name: grade.name,
      level: grade.level,
      description: grade.description || '',
      is_active: grade.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לדרגה',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingGrade) {
        const { error } = await supabase
          .from('employee_grades')
          .update({
            name: formData.name.trim(),
            level: formData.level,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          })
          .eq('id', editingGrade.id);

        if (error) throw error;

        // Log the change
        await logChange({
          organizationId,
          action: 'update',
          entityType: 'employee_grade',
          entityId: editingGrade.id,
          entityName: formData.name.trim(),
          oldValues: {
            name: editingGrade.name,
            level: editingGrade.level,
            description: editingGrade.description,
            is_active: editingGrade.is_active,
          },
          newValues: {
            name: formData.name.trim(),
            level: formData.level,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          },
        });

        toast({
          title: 'הדרגה עודכנה',
          description: `דרגת "${formData.name}" עודכנה בהצלחה`,
        });
      } else {
        const { data: newGrade, error } = await supabase
          .from('employee_grades')
          .insert({
            organization_id: organizationId,
            name: formData.name.trim(),
            level: formData.level,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Log the change
        await logChange({
          organizationId,
          action: 'create',
          entityType: 'employee_grade',
          entityId: newGrade?.id,
          entityName: formData.name.trim(),
          newValues: {
            name: formData.name.trim(),
            level: formData.level,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          },
        });

        toast({
          title: 'הדרגה נוצרה',
          description: `דרגת "${formData.name}" נוספה בהצלחה`,
        });
      }

      setDialogOpen(false);
      loadGrades();
    } catch (error: any) {
      console.error('Error saving grade:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת הדרגה',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (grade: EmployeeGrade) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את דרגת "${grade.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('employee_grades')
        .delete()
        .eq('id', grade.id);

      if (error) throw error;

      // Log the change
      await logChange({
        organizationId,
        action: 'delete',
        entityType: 'employee_grade',
        entityId: grade.id,
        entityName: grade.name,
        oldValues: {
          name: grade.name,
          level: grade.level,
          description: grade.description,
          is_active: grade.is_active,
        },
      });

      toast({
        title: 'הדרגה נמחקה',
        description: `דרגת "${grade.name}" נמחקה בהצלחה`,
      });

      loadGrades();
    } catch (error: any) {
      console.error('Error deleting grade:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת הדרגה',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-violet-200 dark:border-violet-800 border-t-violet-600 dark:border-t-violet-400 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">טוען דרגות עובדים...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 via-purple-50/50 to-slate-50 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-slate-900/50 border-b border-violet-100/50 dark:border-violet-900/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">דרגות עובדים</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                הגדר את דרגות העובדים בארגון לצורך הפעלת חוקי מדיניות שונים
              </p>
            </div>
          </div>
          <Button 
            onClick={openCreateDialog} 
            className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף דרגה
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6">
        {grades.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Users className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">עדיין לא הוגדרו דרגות עובדים</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              הוסף דרגות כדי להפעיל חוקי מדיניות מותאמים
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              דוגמאות: עובד, מנהל צוות, מנהל בכיר, מנהל אזורי
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {grades.map((grade, index) => (
                <div 
                  key={grade.id} 
                  className="group relative bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition-all duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 rounded-lg flex items-center justify-center font-bold text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-700/50">
                        {grade.level}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{grade.name}</span>
                        {grade.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{grade.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      className={`${
                        grade.is_active 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
                      }`}
                    >
                      {grade.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => openEditDialog(grade)} 
                      className="flex-1 h-9 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                    >
                      <Edit className="w-3.5 h-3.5 ml-1.5" />
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(grade)}
                      className="flex-1 h-9 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                      מחיקה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-700/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <TableHead className="w-20 font-semibold text-slate-700 dark:text-slate-300">רמה</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">שם הדרגה</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">תיאור</TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700 dark:text-slate-300">סטטוס</TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700 dark:text-slate-300">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grades.map((grade, index) => (
                    <TableRow 
                      key={grade.id} 
                      className="group hover:bg-violet-50/30 dark:hover:bg-violet-950/10 transition-colors"
                    >
                      <TableCell>
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 rounded-lg flex items-center justify-center font-bold text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-700/50">
                          {grade.level}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{grade.name}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {grade.description || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${
                            grade.is_active 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' 
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
                          }`}
                        >
                          {grade.is_active ? 'פעיל' : 'לא פעיל'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(grade)}
                            className="h-9 w-9 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/30"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(grade)}
                            className="h-9 w-9 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/30"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                {editingGrade ? <Edit className="w-4 h-4 text-violet-600 dark:text-violet-400" /> : <Plus className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
              </div>
              {editingGrade ? 'ערוך דרגה' : 'הוסף דרגה חדשה'}
            </DialogTitle>
            <DialogDescription>
              הגדר דרגת עובד חדשה עבור מדיניות הנסיעות
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium">שם הדרגה *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: מנהל בכיר"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="level" className="text-sm font-medium">רמת היררכיה</Label>
              <Input
                id="level"
                type="number"
                min={1}
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                מספר נמוך יותר = דרגה נמוכה יותר (1 = עובד רגיל)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של הדרגה"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <Label htmlFor="is_active" className="text-sm font-medium">דרגה פעילה</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : editingGrade ? (
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
