import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, FileText, LogOut, User, Eye, BarChart3,
  TrendingUp, Wallet, FileCheck, Clock, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { StatusBadge } from '@/components/StatusBadge';
import { NotificationBell } from '@/components/NotificationBell';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/50 dark:via-teal-950/50 dark:to-cyan-950/50 border-b border-emerald-100 dark:border-emerald-900/30 sticky top-0 z-50">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">שלום, {profile?.full_name || 'משתמש'}</h1>
                <p className="text-xs text-muted-foreground">משתמש עצמאי · {profile?.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button
                onClick={() => navigate('/independent/new-report')}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md"
                size="sm"
              >
                <Plus className="w-4 h-4 ml-1" />
                דוח חדש
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} title="התנתק">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-t-lg" />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">סה"כ דוחות</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.total}</p>
                </div>
                <FileText className="w-8 h-8 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 rounded-t-lg" />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">דוחות סגורים</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.closed}</p>
                </div>
                <FileCheck className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-t-lg" />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">בתהליך</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.open}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-purple-400 to-purple-500 rounded-t-lg" />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">סה"כ הוצאות</p>
                  <p className="text-xl font-bold text-purple-600">₪{stats.totalAmount.toLocaleString()}</p>
                </div>
                <Wallet className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New Report CTA */}
        <Card className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
          onClick={() => navigate('/independent/new-report')}>
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-emerald-700 dark:text-emerald-300">צור דוח הוצאות חדש</h3>
              <p className="text-sm text-muted-foreground mt-1">אשף מובנה יעזור לך לאסוף את כל ההוצאות ולייצר PDF</p>
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              הדוחות שלי
            </h2>
          </div>

          {reports.length === 0 ? (
            <Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-900/80">
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">אין עדיין דוחות. לחץ על "דוח חדש" כדי להתחיל.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <Card key={report.id} className="border-0 shadow-sm bg-white/80 dark:bg-slate-900/80 hover:shadow-md transition-all">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{report.trip_destination}</h3>
                        <StatusBadge status={report.status as any} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{report.trip_purpose}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(report.trip_start_date), 'dd/MM/yyyy', { locale: he })} –{' '}
                          {format(new Date(report.trip_end_date), 'dd/MM/yyyy', { locale: he })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-left">
                          <p className="text-sm font-bold text-emerald-600">
                            ₪{(report.total_amount_ils || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(report.created_at), 'dd/MM/yy', { locale: he })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/reports/${report.id}`)}
                          className="border-emerald-200 hover:bg-emerald-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
