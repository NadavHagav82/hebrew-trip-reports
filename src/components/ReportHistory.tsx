import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { CheckCircle, XCircle, Edit, Send, FileText, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryEntry {
  id: string;
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'edited';
  performed_by: string;
  timestamp: string;
  notes: string | null;
  profiles: {
    full_name: string;
  };
}

interface ReportHistoryProps {
  reportId: string;
}

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    created: 'נוצר',
    submitted: 'הוגש לאישור',
    approved: 'אושר',
    rejected: 'נדחה',
    edited: 'נערך',
  };
  return labels[action] || action;
};

const getActionIcon = (action: string) => {
  const icons: Record<string, any> = {
    created: FileText,
    submitted: Send,
    approved: CheckCircle,
    rejected: XCircle,
    edited: Edit,
  };
  return icons[action] || Clock;
};

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    submitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    edited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return colors[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
};

export const ReportHistory = ({ reportId }: ReportHistoryProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [reportId]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('report_history')
        .select('*, profiles!report_history_performed_by_fkey(full_name)')
        .eq('report_id', reportId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading report history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            היסטוריית שינויים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            היסטוריית שינויים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            אין היסטוריית שינויים לדוח זה
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          היסטוריית שינויים ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {history.map((entry, index) => {
              const Icon = getActionIcon(entry.action);
              const colorClass = getActionColor(entry.action);
              
              return (
                <div key={entry.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass} ring-4 ring-background`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                            {getActionLabel(entry.action)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground text-left">
                          {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-semibold">{entry.profiles?.full_name || 'משתמש לא ידוע'}</span>
                        <span className="text-muted-foreground mx-1">•</span>
                        <span className="text-muted-foreground">{getActionLabel(entry.action)}</span>
                      </div>
                      
                      {entry.notes && (
                        <div className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded border-r-2 border-primary">
                          {entry.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
