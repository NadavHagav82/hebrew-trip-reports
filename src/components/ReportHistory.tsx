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
      <Card className="mt-6 shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
        <CardHeader className="pb-4 bg-gradient-to-l from-purple-500/10 to-transparent">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl">היסטוריית שינויים</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">מעקב אחר פעולות בדוח</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="mt-6 shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
        <CardHeader className="pb-4 bg-gradient-to-l from-purple-500/10 to-transparent">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl">היסטוריית שינויים</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">מעקב אחר פעולות בדוח</p>
            </div>
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
    <Card className="mt-6 shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
      <CardHeader className="pb-4 bg-gradient-to-l from-purple-500/10 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl">היסטוריית שינויים</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">מעקב אחר פעולות בדוח</p>
            </div>
          </CardTitle>
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md">
            {history.length} פעולות
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute right-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 via-indigo-300 to-blue-300 dark:from-purple-800 dark:via-indigo-800 dark:to-blue-800" />
          
          <div className="space-y-6">
            {history.map((entry, index) => {
              const Icon = getActionIcon(entry.action);
              const colorClass = getActionColor(entry.action);
              
              return (
                <div key={entry.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass} ring-4 ring-background shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className={`inline-block px-3 py-1.5 rounded-xl text-xs font-bold ${colorClass}`}>
                            {getActionLabel(entry.action)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 text-left bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                          {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </div>
                      </div>
                      
                      <div className="text-sm mt-3">
                        <span className="font-bold text-slate-800 dark:text-white">{entry.profiles?.full_name || 'משתמש לא ידוע'}</span>
                        <span className="text-slate-400 mx-2">•</span>
                        <span className="text-slate-600 dark:text-slate-400">{getActionLabel(entry.action)}</span>
                      </div>
                      
                      {entry.notes && (
                        <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border-r-4 border-purple-400">
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
