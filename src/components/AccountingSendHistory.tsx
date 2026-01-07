import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Mail, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface SendHistoryRecord {
  id: string;
  sent_to_email: string;
  sent_to_name: string | null;
  send_method: string;
  sent_at: string;
  sent_by_profile?: {
    full_name: string;
  };
}

interface AccountingSendHistoryProps {
  reportId: string;
}

export function AccountingSendHistory({ reportId }: AccountingSendHistoryProps) {
  const [history, setHistory] = useState<SendHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [reportId]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_send_history')
        .select(`
          id,
          sent_to_email,
          sent_to_name,
          send_method,
          sent_at,
          sent_by
        `)
        .eq('report_id', reportId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Fetch sender names
      if (data && data.length > 0) {
        const senderIds = [...new Set(data.map(d => d.sent_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const historyWithProfiles = data.map(record => ({
          ...record,
          sent_by_profile: profileMap.get(record.sent_by),
        }));

        setHistory(historyWithProfiles);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Error loading send history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-600" />
          היסטוריית שליחה להנהלת חשבונות
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((record) => (
          <div 
            key={record.id} 
            className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border"
          >
            <div className="flex-shrink-0 mt-0.5">
              {record.send_method === 'system' ? (
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {record.sent_to_name || record.sent_to_email}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {record.send_method === 'system' ? 'במערכת' : 'מייל'}
                </Badge>
              </div>
              {record.sent_to_name && (
                <p className="text-sm text-muted-foreground truncate">
                  {record.sent_to_email}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="w-3 h-3" />
                <span>
                  {format(new Date(record.sent_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                </span>
                {record.sent_by_profile && (
                  <span className="mr-2">
                    • נשלח ע"י {record.sent_by_profile.full_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
