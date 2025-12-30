import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Users,
  Plane,
  Hotel,
  Utensils,
  Car,
  Ban,
  Sparkles,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface PolicyAuditLogProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  user_name?: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
  activate: 'הפעלה',
  deactivate: 'השבתה',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="w-4 h-4" />,
  update: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  activate: <ToggleRight className="w-4 h-4" />,
  deactivate: <ToggleLeft className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  activate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  deactivate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
};

const ENTITY_LABELS: Record<string, string> = {
  employee_grade: 'דרגת עובד',
  travel_rule: 'חוק נסיעות',
  restriction: 'הגבלה',
  custom_rule: 'חוק מותאם',
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  employee_grade: <Users className="w-4 h-4" />,
  travel_rule: <Package className="w-4 h-4" />,
  restriction: <Ban className="w-4 h-4" />,
  custom_rule: <Sparkles className="w-4 h-4" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  flights: <Plane className="w-4 h-4" />,
  accommodation: <Hotel className="w-4 h-4" />,
  food: <Utensils className="w-4 h-4" />,
  transportation: <Car className="w-4 h-4" />,
  miscellaneous: <Package className="w-4 h-4" />,
};

export function PolicyAuditLog({ organizationId, isOpen, onClose }: PolicyAuditLogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadAuditLog();
    }
  }, [isOpen, organizationId]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('policy_audit_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set(data?.map(e => e.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const entriesWithNames = (data || []).map(entry => ({
        ...entry,
        user_name: userMap.get(entry.user_id) || 'משתמש לא ידוע'
      }));

      setEntries(entriesWithNames);
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const getEntityIcon = (entry: AuditLogEntry) => {
    if (entry.entity_type === 'travel_rule' && entry.new_values?.category) {
      return CATEGORY_ICONS[entry.new_values.category] || ENTITY_ICONS[entry.entity_type];
    }
    return ENTITY_ICONS[entry.entity_type] || <Package className="w-4 h-4" />;
  };

  const formatChanges = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return null;
    
    const changes: { field: string; old: any; new: any }[] = [];
    
    if (newValues && !oldValues) {
      // Creation - show new values
      Object.entries(newValues).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'organization_id' && key !== 'created_by') {
          changes.push({ field: key, old: null, new: value });
        }
      });
    } else if (oldValues && newValues) {
      // Update - show changes
      Object.entries(newValues).forEach(([key, value]) => {
        if (oldValues[key] !== value && key !== 'updated_at') {
          changes.push({ field: key, old: oldValues[key], new: value });
        }
      });
    } else if (oldValues && !newValues) {
      // Deletion - show old values
      Object.entries(oldValues).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'organization_id') {
          changes.push({ field: key, old: value, new: null });
        }
      });
    }

    return changes;
  };

  const fieldLabels: Record<string, string> = {
    name: 'שם',
    description: 'תיאור',
    level: 'רמה',
    category: 'קטגוריה',
    max_amount: 'סכום מקסימלי',
    currency: 'מטבע',
    per_type: 'סוג חישוב',
    destination_type: 'סוג יעד',
    is_active: 'פעיל',
    action_type: 'סוג פעולה',
    rule_name: 'שם החוק',
    keywords: 'מילות מפתח',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            יומן שינויים במדיניות
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>אין שינויים ביומן</p>
              <p className="text-sm">שינויים במדיניות יופיעו כאן</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const isExpanded = expandedEntries.has(entry.id);
                const changes = formatChanges(entry.old_values, entry.new_values);

                return (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div 
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => changes && changes.length > 0 && toggleEntry(entry.id)}
                    >
                      <div className={`p-2 rounded-full ${ACTION_COLORS[entry.action] || 'bg-gray-100'}`}>
                        {ACTION_ICONS[entry.action] || <Edit className="w-4 h-4" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="gap-1">
                            {getEntityIcon(entry)}
                            {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                          </Badge>
                          <span className="font-medium text-sm">
                            {ACTION_LABELS[entry.action] || entry.action}
                          </span>
                          {entry.entity_name && (
                            <span className="text-muted-foreground text-sm">
                              "{entry.entity_name}"
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(entry.created_at), 'd בMMMM yyyy, HH:mm', { locale: he })}
                          </span>
                        </div>
                      </div>

                      {changes && changes.length > 0 && (
                        <Button variant="ghost" size="icon" className="shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {isExpanded && changes && changes.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {changes.map((change, idx) => (
                          <div key={idx} className="text-sm flex items-start gap-2">
                            <span className="font-medium text-muted-foreground min-w-[100px]">
                              {fieldLabels[change.field] || change.field}:
                            </span>
                            <div className="flex-1">
                              {change.old !== null && (
                                <span className="line-through text-red-500 mr-2">
                                  {typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old)}
                                </span>
                              )}
                              {change.new !== null && (
                                <span className="text-green-600">
                                  {typeof change.new === 'object' ? JSON.stringify(change.new) : String(change.new)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
