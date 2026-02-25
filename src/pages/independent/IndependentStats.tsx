import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
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

export default function IndependentStats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth/login'); return; }
    supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); setLoading(false); });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="px-3 sm:px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/independent')} className="w-9 h-9">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-bold">סטטיסטיקות</h1>
        </div>
      </header>

      <main className="px-3 sm:px-4 py-4 pb-28 max-w-lg mx-auto">
        <IndependentCharts reports={reports} />
        {reports.filter(r => r.status !== 'draft').length === 0 && (
          <div className="bg-card rounded-xl border p-8 text-center mt-4">
            <p className="text-sm text-muted-foreground">אין עדיין נתונים להצגה</p>
          </div>
        )}
      </main>
    </div>
  );
}
