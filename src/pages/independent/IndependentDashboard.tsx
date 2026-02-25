import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, FileText, LogOut, User, Eye, BarChart3,
  Wallet, FileCheck, Clock, Edit3, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { StatusBadge } from '@/components/StatusBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { IndependentProfileDialog } from '@/components/independent/IndependentProfileDialog';
import { IndependentCharts } from '@/components/independent/IndependentCharts';

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  status: string;
  total_amount_ils: number | null;
  created_at: string;
}

export default function IndependentDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; department: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth/login'); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [reportsRes, profileRes] = await Promise.all([
      supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('full_name, department').eq('id', user.id).single(),
    ]);
    if (reportsRes.data) setReports(reportsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  };

  const stats = {
    total: reports.length,
    closed: reports.filter(r => r.status === 'closed').length,
    open: reports.filter(r => r.status === 'open' || r.status === 'draft').length,
    totalAmount: reports.reduce((s, r) => s + (r.total_amount_ils || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b safe-top">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">שלום, {profile?.full_name || 'משתמש'}</h1>
                <p className="text-[11px] text-muted-foreground truncate">{profile?.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <IndependentProfileDialog onUpdate={fetchData} />
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={signOut} title="התנתק" className="w-9 h-9">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {/* Stats – 2x2 grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'סה"כ דוחות', value: stats.total, icon: FileText, color: 'emerald' },
            { label: 'דוחות סגורים', value: stats.closed, icon: FileCheck, color: 'blue' },
            { label: 'בתהליך', value: stats.open, icon: Clock, color: 'amber' },
            { label: 'סה"כ הוצאות', value: `₪${stats.totalAmount.toLocaleString()}`, icon: Wallet, color: 'purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card rounded-xl p-3.5 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold mt-0.5 text-${color}-600 dark:text-${color}-400`}>{value}</p>
                </div>
                <Icon className={`w-7 h-7 text-${color}-200 dark:text-${color}-800`} />
              </div>
            </div>
          ))}
        </div>

        {/* New Report CTA – big touch target */}
        <button
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-5 flex items-center gap-4 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 active:scale-[0.98] transition-transform"
          onClick={() => navigate('/independent/new-report')}
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-right">
            <p className="font-bold text-base">צור דוח הוצאות חדש</p>
            <p className="text-xs text-white/80 mt-0.5">אשף מובנה לאיסוף הוצאות</p>
          </div>
        </button>

        {/* Draft Reports */}
        {reports.filter(r => r.status === 'draft').length > 0 && (
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3 text-amber-600 dark:text-amber-400">
              <Edit3 className="w-4 h-4" />
              טיוטות ({reports.filter(r => r.status === 'draft').length})
            </h2>
            <div className="space-y-2">
              {reports.filter(r => r.status === 'draft').map(report => (
                <div
                  key={report.id}
                  className="bg-card rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 shadow-sm p-3.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{report.trip_destination || 'טיוטא'}</h3>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">טיוטא</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{report.trip_purpose || 'לא הוגדרה מטרה'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(report.created_at), 'dd/MM/yy HH:mm', { locale: he })}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-2 text-xs font-medium active:scale-95 transition-transform"
                      onClick={() => navigate(`/independent/new-report?draft=${report.id}`)}
                    >
                      המשך
                    </button>
                    <button
                      className="bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg p-2 active:scale-95 transition-all"
                      onClick={async () => {
                        if (confirm('למחוק טיוטא זו?')) {
                          await supabase.from('reports').delete().eq('id', report.id);
                          localStorage.removeItem('independent_draft_wizard');
                          fetchData();
                          toast({ title: 'הטיוטא נמחקה' });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        <IndependentCharts reports={reports} />

        {/* Completed Reports List */}
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            הדוחות שלי ({reports.filter(r => r.status !== 'draft').length})
          </h2>

          {reports.filter(r => r.status !== 'draft').length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">אין עדיין דוחות</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.filter(r => r.status !== 'draft').map(report => (
                <button
                  key={report.id}
                  className="w-full bg-card rounded-xl border shadow-sm p-3.5 flex items-center gap-3 text-right active:scale-[0.99] transition-transform hover:shadow-md"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{report.trip_destination}</h3>
                      <StatusBadge status={report.status as any} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{report.trip_purpose}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(report.trip_start_date), 'dd/MM/yy', { locale: he })} – {format(new Date(report.trip_end_date), 'dd/MM/yy', { locale: he })}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₪{(report.total_amount_ils || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(report.created_at), 'dd/MM/yy', { locale: he })}
                    </p>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
