import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Tag, CreditCard } from 'lucide-react';

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

const COLORS = [
  'hsl(160, 60%, 45%)',
  'hsl(200, 60%, 50%)',
  'hsl(40, 80%, 55%)',
  'hsl(280, 50%, 55%)',
  'hsl(340, 60%, 55%)',
  'hsl(20, 70%, 55%)',
  'hsl(120, 50%, 45%)',
  'hsl(260, 60%, 55%)',
];

const CATEGORY_LABELS: Record<string, string> = {
  flights: 'טיסות',
  accommodation: 'לינה',
  meals: 'ארוחות',
  transportation: 'תחבורה',
  fuel: 'דלק',
  phone: 'טלפון',
  other: 'אחר',
  car_rental: 'השכרת רכב',
  conference: 'כנסים',
  office_supplies: 'ציוד משרדי',
};

const PAYMENT_LABELS: Record<string, string> = {
  out_of_pocket: 'מכיסי',
  company_card: 'כרטיס חברה',
};

interface Props {
  reports: Report[];
  expenses?: Expense[];
}

export function IndependentCharts({ reports, expenses = [] }: Props) {
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

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const cat = CATEGORY_LABELS[e.category] || e.category;
      map.set(cat, (map.get(cat) || 0) + e.amount_in_ils);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const pm = PAYMENT_LABELS[e.payment_method] || e.payment_method;
      map.set(pm, (map.get(pm) || 0) + e.amount_in_ils);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (nonDraftReports.length === 0) return null;

  const PieLegend = ({ data }: { data: { name: string; value: number }[] }) => (
    <div className="flex-1 space-y-1.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
          <span className="truncate flex-1">{d.name}</span>
          <span className="font-medium text-muted-foreground">₪{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );

  const PieWithLegend = ({ data, title, icon: Icon }: { data: { name: string; value: number }[]; title: string; icon: any }) => (
    <div className="bg-card rounded-xl border shadow-sm p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </p>
      <div className="flex items-center gap-2">
        <ResponsiveContainer width="50%" height={160}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [`₪${v.toLocaleString()}`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <PieLegend data={data} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
        <TrendingUp className="w-4 h-4" />
        סטטיסטיקות ({nonDraftReports.length} דוחות)
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-card rounded-xl border shadow-sm p-3.5 text-center">
          <p className="text-[11px] text-muted-foreground">סה״כ הוצאות</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            ₪{nonDraftReports.reduce((s, r) => s + (r.total_amount_ils || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-xl border shadow-sm p-3.5 text-center">
          <p className="text-[11px] text-muted-foreground">פריטי הוצאה</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{expenses.length}</p>
        </div>
      </div>

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

        {/* Category pie chart */}
        {categoryData.length > 0 && (
          <PieWithLegend data={categoryData} title="הוצאות לפי קטגוריה" icon={Tag} />
        )}

        {/* Destination pie chart */}
        {destinationData.length > 0 && (
          <PieWithLegend data={destinationData} title="הוצאות לפי יעד" icon={PieIcon} />
        )}

        {/* Payment method pie chart */}
        {paymentData.length > 1 && (
          <PieWithLegend data={paymentData} title="חלוקה לפי אמצעי תשלום" icon={CreditCard} />
        )}

        {/* Category bar chart */}
        {categoryData.length > 1 && (
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">השוואת קטגוריות (₪)</p>
            <ResponsiveContainer width="100%" height={Math.max(180, categoryData.length * 35)}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  formatter={(v: number) => [`₪${v.toLocaleString()}`, '']}
                  contentStyle={{ direction: 'rtl', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
