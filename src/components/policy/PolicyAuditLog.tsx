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
import { Separator } from '@/components/ui/separator';
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
  Package,
  ArrowRight,
  Clock,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

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

const ACTION_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  create: { 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/30',
    icon: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25'
  },
  update: { 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/30',
    icon: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
  },
  delete: { 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30',
    icon: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25'
  },
  activate: { 
    bg: 'bg-teal-500/10', 
    border: 'border-teal-500/30',
    icon: 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25'
  },
  deactivate: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/30',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
  },
};

const ENTITY_LABELS: Record<string, string> = {
  employee_grade: 'דרגת עובד',
  travel_rule: 'חוק נסיעות',
  restriction: 'הגבלה',
  custom_rule: 'חוק מותאם',
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  employee_grade: <Users className="w-3.5 h-3.5" />,
  travel_rule: <Package className="w-3.5 h-3.5" />,
  restriction: <Ban className="w-3.5 h-3.5" />,
  custom_rule: <Sparkles className="w-3.5 h-3.5" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  flights: <Plane className="w-3.5 h-3.5" />,
  accommodation: <Hotel className="w-3.5 h-3.5" />,
  food: <Utensils className="w-3.5 h-3.5" />,
  transportation: <Car className="w-3.5 h-3.5" />,
  miscellaneous: <Package className="w-3.5 h-3.5" />,
};

export function PolicyAuditLog({ organizationId, isOpen, onClose }: PolicyAuditLogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string | null>(null);

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
    return ENTITY_ICONS[entry.entity_type] || <Package className="w-3.5 h-3.5" />;
  };

  const formatChanges = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return null;
    
    const changes: { field: string; old: any; new: any }[] = [];
    
    if (newValues && !oldValues) {
      Object.entries(newValues).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'organization_id' && key !== 'created_by') {
          changes.push({ field: key, old: null, new: value });
        }
      });
    } else if (oldValues && newValues) {
      Object.entries(newValues).forEach(([key, value]) => {
        if (oldValues[key] !== value && key !== 'updated_at') {
          changes.push({ field: key, old: oldValues[key], new: value });
        }
      });
    } else if (oldValues && !newValues) {
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

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ENTITY_LABELS[entry.entity_type]?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !filterAction || entry.action === filterAction;
    
    return matchesSearch && matchesFilter;
  });

  const actionCounts = entries.reduce((acc, entry) => {
    acc[entry.action] = (acc[entry.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
                <History className="w-5 h-5" />
              </div>
              <div>
                <span className="block">יומן שינויים במדיניות</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {entries.length} פעולות נרשמו
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Search and filters */}
          <div className="px-6 pb-4 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, משתמש או סוג..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40"
              />
            </div>
            
            {/* Quick filter chips */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterAction === null ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterAction(null)}
                className="h-8 text-xs rounded-full"
              >
                הכל ({entries.length})
              </Button>
              {Object.entries(ACTION_LABELS).map(([action, label]) => {
                const count = actionCounts[action] || 0;
                if (count === 0) return null;
                return (
                  <Button
                    key={action}
                    variant={filterAction === action ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterAction(filterAction === action ? null : action)}
                    className="h-8 text-xs rounded-full gap-1.5"
                  >
                    {ACTION_ICONS[action]}
                    {label} ({count})
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadAuditLog}
                className="h-8 text-xs rounded-full gap-1.5 mr-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                רענון
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[50vh]">
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <History className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {searchTerm || filterAction ? 'לא נמצאו תוצאות' : 'אין שינויים ביומן'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterAction 
                    ? 'נסה לשנות את החיפוש או הסינון' 
                    : 'שינויים במדיניות יופיעו כאן'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry, index) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  const changes = formatChanges(entry.old_values, entry.new_values);
                  const styles = ACTION_STYLES[entry.action] || ACTION_STYLES.update;

                  return (
                    <div
                      key={entry.id}
                      className={`
                        group relative rounded-xl border transition-all duration-200
                        ${styles.bg} ${styles.border}
                        hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]
                        ${isExpanded ? 'ring-2 ring-primary/20' : ''}
                      `}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div 
                        className="flex items-start gap-4 p-4 cursor-pointer"
                        onClick={() => changes && changes.length > 0 && toggleEntry(entry.id)}
                      >
                        {/* Action icon */}
                        <div className={`p-2.5 rounded-xl ${styles.icon} transition-transform group-hover:scale-110`}>
                          {ACTION_ICONS[entry.action] || <Edit className="w-4 h-4" />}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge 
                              variant="secondary" 
                              className="gap-1.5 bg-background/60 backdrop-blur-sm border border-border/50 font-medium"
                            >
                              {getEntityIcon(entry)}
                              {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                            </Badge>
                            <span className="font-semibold text-sm text-foreground">
                              {ACTION_LABELS[entry.action] || entry.action}
                            </span>
                            {entry.entity_name && (
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                "{entry.entity_name}"
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-md">
                              <User className="w-3 h-3" />
                              {entry.user_name}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(entry.created_at), { locale: he, addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        {/* Expand button */}
                        {changes && changes.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`
                              shrink-0 rounded-lg transition-all duration-200
                              ${isExpanded ? 'bg-primary/10 text-primary' : 'opacity-50 group-hover:opacity-100'}
                            `}
                          >
                            <span className="text-xs ml-1">{changes.length} שינויים</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Expanded changes */}
                      {isExpanded && changes && changes.length > 0 && (
                        <div className="px-4 pb-4">
                          <Separator className="mb-4" />
                          <div className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                              <Filter className="w-3.5 h-3.5" />
                              פירוט השינויים
                            </div>
                            {changes.map((change, idx) => (
                              <div key={idx} className="flex items-start gap-3 text-sm">
                                <span className="font-medium text-muted-foreground min-w-[100px] text-right">
                                  {fieldLabels[change.field] || change.field}
                                </span>
                                <div className="flex items-center gap-2 flex-1 flex-wrap">
                                  {change.old !== null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-xs line-through">
                                      {typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old)}
                                    </span>
                                  )}
                                  {change.old !== null && change.new !== null && (
                                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                  {change.new !== null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                      {typeof change.new === 'object' ? JSON.stringify(change.new) : String(change.new)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground text-center">
                            {format(new Date(entry.created_at), 'd בMMMM yyyy, HH:mm', { locale: he })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
