import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';

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

const COLORS = [
  'hsl(160, 60%, 45%)',
  'hsl(200, 60%, 50%)',
  'hsl(40, 80%, 55%)',
  'hsl(280, 50%, 55%)',
  'hsl(340, 60%, 55%)',
  'hsl(20, 70%, 55%)',
];

export function IndependentCharts({ reports }: { reports: Report[] }) {
  const nonDraftReports = reports.filter(r => r.status !== 'draft');

  const destinationData = useMemo(() => {
    const map = new Map<string, number>();
    nonDraftReports.forEach(r => {
      const dest = r.trip_destination || 'לא ידוע';
      map.set(dest, (map.get(dest) || 0) + (r.total_amount_ils || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [nonDraftReports]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    nonDraftReports.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + (r.total_amount_ils || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({
        month: month.slice(5) + '/' + month.slice(2, 4),
        total: Math.round(total),
      }));
  }, [nonDraftReports]);

  if (nonDraftReports.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
        <TrendingUp className="w-4 h-4" />
        סטטיסטיקות
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {/* Monthly bar chart */}
        {monthlyData.length > 1 && (
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">הוצאות לפי חודש (₪)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`₪${v.toLocaleString()}`, 'סכום']}
                  contentStyle={{ direction: 'rtl', fontSize: 12 }}
                />
                <Bar dataKey="total" fill="hsl(160, 60%, 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Destination pie chart */}
        {destinationData.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5" />
              הוצאות לפי יעד
            </p>
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={destinationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    dataKey="value"
                    stroke="none"
                  >
                    {destinationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₪${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {destinationData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-medium text-muted-foreground">₪{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
