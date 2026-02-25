import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, CalendarDays } from 'lucide-react';
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

interface Expense {
  id: string;
  report_id: string;
  category: string;
  amount_in_ils: number;
  expense_date: string;
  payment_method: string;
}

export default function IndependentStats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth/login'); return; }
    const fetchAll = async () => {
      const [reportsRes, expensesRes] = await Promise.all([
        supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('expenses').select('id, report_id, category, amount_in_ils, expense_date, payment_method')
          .in('report_id', (await supabase.from('reports').select('id').eq('user_id', user.id)).data?.map(r => r.id) || []),
      ]);
      if (reportsRes.data) setReports(reportsRes.data);
      if (expensesRes.data) setExpenses(expensesRes.data);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  // Filter reports & expenses by date range
  const filteredReports = reports.filter(r => {
    if (r.status === 'draft') return false;
    if (dateFrom && r.trip_start_date < dateFrom) return false;
    if (dateTo && r.trip_end_date > dateTo) return false;
    return true;
  });

  const filteredReportIds = new Set(filteredReports.map(r => r.id));
  const filteredExpenses = expenses.filter(e => filteredReportIds.has(e.report_id));

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

      <main className="px-3 sm:px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {/* Date filter */}
        <div className="bg-card rounded-xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            סינון לפי תאריכים
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dateFrom" className="text-xs">מתאריך</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label htmlFor="dateTo" className="text-xs">עד תאריך</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-primary mt-2 underline">
              נקה סינון
            </button>
          )}
        </div>

        <IndependentCharts reports={filteredReports} expenses={filteredExpenses} />

        {filteredReports.length === 0 && (
          <div className="bg-card rounded-xl border p-8 text-center">
            <p className="text-sm text-muted-foreground">אין נתונים להצגה בטווח התאריכים שנבחר</p>
          </div>
        )}
      </main>
    </div>
  );
}
