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

        toast({
          title: 'הדרגה עודכנה',
          description: `דרגת "${formData.name}" עודכנה בהצלחה`,
        });
      } else {
        const { error } = await supabase
          .from('employee_grades')
          .insert({
            organization_id: organizationId,
            name: formData.name.trim(),
            level: formData.level,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            created_by: user?.id,
          });

        if (error) throw error;

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
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              דרגות עובדים
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              הגדר את דרגות העובדים בארגון לצורך הפעלת חוקי מדיניות שונים
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" />
            הוסף דרגה
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {grades.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              עדיין לא הוגדרו דרגות עובדים. הוסף דרגות כדי להפעיל חוקי מדיניות מותאמים.
              <br />
              <span className="text-muted-foreground text-xs">
                דוגמאות: עובד, מנהל צוות, מנהל בכיר, מנהל אזורי
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {grades.map((grade) => (
                <div key={grade.id} className="border rounded-lg p-3 bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        רמה {grade.level}
                      </Badge>
                      <span className="font-medium text-sm">{grade.name}</span>
                    </div>
                    <Badge variant={grade.is_active ? 'default' : 'secondary'} className="text-xs">
                      {grade.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  {grade.description && (
                    <p className="text-xs text-muted-foreground mb-2">{grade.description}</p>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(grade)} className="flex-1">
                      <Edit className="w-3 h-3 ml-1" />
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(grade)}
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
                  <TableHead className="w-12">רמה</TableHead>
                  <TableHead>שם הדרגה</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead className="w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {grade.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{grade.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {grade.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={grade.is_active ? 'default' : 'secondary'}>
                        {grade.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(grade)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(grade)}
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
                {editingGrade ? 'ערוך דרגה' : 'הוסף דרגה חדשה'}
              </DialogTitle>
              <DialogDescription>
                הגדר דרגת עובד חדשה עבור מדיניות הנסיעות
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">שם הדרגה *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: מנהל בכיר"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="level">רמת היררכיה</Label>
                <Input
                  id="level"
                  type="number"
                  min={1}
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">
                  מספר נמוך יותר = דרגה נמוכה יותר (1 = עובד רגיל)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">תיאור</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="תיאור קצר של הדרגה"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">דרגה פעילה</Label>
                <Switch
                  id="is_active"
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
                ) : editingGrade ? (
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
