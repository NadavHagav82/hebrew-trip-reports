import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Smartphone, Monitor, Globe, Calendar, ArrowLeftRight, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

interface AnalysisLog {
  id: string;
  created_at: string;
  extracted_date: string | null;
  user_corrected_date: string | null;
  user_swapped_day_month: boolean | null;
  extracted_amount: number | null;
  user_corrected_amount: number | null;
  extracted_currency: string | null;
  user_corrected_currency: string | null;
  device_info: string | null;
  trip_destination: string | null;
}

interface Stats {
  totalAnalyses: number;
  dateAccuracy: number;
  swapRate: number;
  amountAccuracy: number;
  currencyAccuracy: number;
  byDevice: { device: string; total: number; accurate: number; accuracy: number }[];
  byDestination: { destination: string; total: number; accurate: number; accuracy: number }[];
  trend: { date: string; accuracy: number; total: number }[];
}

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AIAccuracyAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    checkAccess();
  }, [user]);

  useEffect(() => {
    if (hasAccess) {
      loadStats();
    }
  }, [hasAccess, period]);

  const checkAccess = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    // Check if user is accounting_manager or admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const allowedRoles = ['admin', 'accounting_manager'];
    const hasRole = roles?.some(r => allowedRoles.includes(r.role));
    
    setHasAccess(hasRole || false);
    setLoading(false);
  };

  const loadStats = async () => {
    setLoading(true);
    
    const days = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), days));
    
    const { data: logs, error } = await supabase
      .from('receipt_analysis_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error || !logs) {
      console.error('Error loading logs:', error);
      setLoading(false);
      return;
    }

    // Calculate stats
    const totalAnalyses = logs.length;
    
    // Date accuracy: logs with extracted_date where user didn't correct
    const logsWithDate = logs.filter(l => l.extracted_date);
    const dateCorrected = logsWithDate.filter(l => l.user_corrected_date);
    const dateAccuracy = logsWithDate.length > 0 
      ? ((logsWithDate.length - dateCorrected.length) / logsWithDate.length) * 100 
      : 0;

    // Swap rate
    const swapped = logs.filter(l => l.user_swapped_day_month === true);
    const swapRate = logsWithDate.length > 0 
      ? (swapped.length / logsWithDate.length) * 100 
      : 0;

    // Amount accuracy
    const logsWithAmount = logs.filter(l => l.extracted_amount !== null);
    const amountCorrected = logsWithAmount.filter(l => l.user_corrected_amount !== null);
    const amountAccuracy = logsWithAmount.length > 0 
      ? ((logsWithAmount.length - amountCorrected.length) / logsWithAmount.length) * 100 
      : 0;

    // Currency accuracy
    const logsWithCurrency = logs.filter(l => l.extracted_currency);
    const currencyCorrected = logsWithCurrency.filter(l => l.user_corrected_currency);
    const currencyAccuracy = logsWithCurrency.length > 0 
      ? ((logsWithCurrency.length - currencyCorrected.length) / logsWithCurrency.length) * 100 
      : 0;

    // By device
    const deviceMap = new Map<string, { total: number; accurate: number }>();
    logs.forEach(log => {
      const device = log.device_info?.includes('Mobile') ? 'נייד' : 'מחשב';
      const current = deviceMap.get(device) || { total: 0, accurate: 0 };
      current.total++;
      if (log.extracted_date && !log.user_corrected_date && !log.user_swapped_day_month) {
        current.accurate++;
      }
      deviceMap.set(device, current);
    });
    const byDevice = Array.from(deviceMap.entries()).map(([device, data]) => ({
      device,
      total: data.total,
      accurate: data.accurate,
      accuracy: data.total > 0 ? (data.accurate / data.total) * 100 : 0
    }));

    // By destination
    const destMap = new Map<string, { total: number; accurate: number }>();
    logs.forEach(log => {
      const dest = log.trip_destination || 'לא ידוע';
      const current = destMap.get(dest) || { total: 0, accurate: 0 };
      current.total++;
      if (log.extracted_date && !log.user_corrected_date && !log.user_swapped_day_month) {
        current.accurate++;
      }
      destMap.set(dest, current);
    });
    const byDestination = Array.from(destMap.entries())
      .map(([destination, data]) => ({
        destination,
        total: data.total,
        accurate: data.accurate,
        accuracy: data.total > 0 ? (data.accurate / data.total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Trend over time (group by day)
    const trendMap = new Map<string, { total: number; accurate: number }>();
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      const current = trendMap.get(date) || { total: 0, accurate: 0 };
      current.total++;
      if (log.extracted_date && !log.user_corrected_date && !log.user_swapped_day_month) {
        current.accurate++;
      }
      trendMap.set(date, current);
    });
    const trend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date: format(new Date(date), 'dd/MM', { locale: he }),
        accuracy: data.total > 0 ? (data.accurate / data.total) * 100 : 0,
        total: data.total
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setStats({
      totalAnalyses,
      dateAccuracy,
      swapRate,
      amountAccuracy,
      currencyAccuracy,
      byDevice,
      byDestination,
      trend
    });
    
    setLoading(false);
  };

  const getTrendIcon = (current: number, threshold = 80) => {
    if (current >= threshold) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current >= threshold - 20) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">טוען נתונים...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">אין הרשאה</h2>
            <p className="text-muted-foreground mb-4">אין לך הרשאה לצפות בדף זה</p>
            <Button onClick={() => navigate('/')}>
              חזרה לדף הבית
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/accounting')}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  אנליטיקס דיוק AI
                </h1>
                <p className="text-muted-foreground text-sm">ניתוח דיוק חילוץ נתונים מקבלות</p>
              </div>
            </div>
            
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 ימים אחרונים</SelectItem>
                <SelectItem value="30">30 ימים אחרונים</SelectItem>
                <SelectItem value="90">90 ימים אחרונים</SelectItem>
                <SelectItem value="365">שנה אחרונה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">סה"כ ניתוחים</div>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mt-1">{stats?.totalAnalyses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">דיוק תאריכים</div>
                {getTrendIcon(stats?.dateAccuracy || 0)}
              </div>
              <div className="text-2xl font-bold mt-1">{(stats?.dateAccuracy || 0).toFixed(1)}%</div>
              <Progress value={stats?.dateAccuracy || 0} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">החלפות יום/חודש</div>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mt-1">{(stats?.swapRate || 0).toFixed(1)}%</div>
              <Progress value={stats?.swapRate || 0} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">דיוק סכומים</div>
                {getTrendIcon(stats?.amountAccuracy || 0)}
              </div>
              <div className="text-2xl font-bold mt-1">{(stats?.amountAccuracy || 0).toFixed(1)}%</div>
              <Progress value={stats?.amountAccuracy || 0} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">דיוק מטבע</div>
                {getTrendIcon(stats?.currencyAccuracy || 0)}
              </div>
              <div className="text-2xl font-bold mt-1">{(stats?.currencyAccuracy || 0).toFixed(1)}%</div>
              <Progress value={stats?.currencyAccuracy || 0} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">מגמת דיוק לאורך זמן</CardTitle>
              <CardDescription>אחוז דיוק תאריכים לפי יום</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.trend && stats.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'דיוק']}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary) / 0.2)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  אין מספיק נתונים להצגת גרף
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Device */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">דיוק לפי מכשיר</CardTitle>
              <CardDescription>השוואה בין מחשב לנייד</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.byDevice && stats.byDevice.length > 0 ? (
                <div className="space-y-4">
                  {stats.byDevice.map((item, index) => (
                    <div key={item.device} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.device === 'נייד' ? (
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{item.device}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">{item.accuracy.toFixed(1)}%</span>
                          <span className="text-muted-foreground mr-2">({item.total} ניתוחים)</span>
                        </div>
                      </div>
                      <Progress value={item.accuracy} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  אין מספיק נתונים
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* By Destination */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              דיוק לפי יעד נסיעה
            </CardTitle>
            <CardDescription>10 היעדים המובילים לפי כמות ניתוחים</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.byDestination && stats.byDestination.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byDestination} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="destination" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                      name === 'accuracy' ? 'דיוק' : 'ניתוחים'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="accuracy" name="דיוק %" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין מספיק נתונים להצגת גרף
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights */}
        {stats && stats.totalAnalyses > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">תובנות ומסקנות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.dateAccuracy < 80 && (
                  <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <div className="font-medium">דיוק תאריכים נמוך</div>
                      <div className="text-sm text-muted-foreground">
                        שקול לשפר את הפרומפט או להוסיף לוגיקה לזיהוי פורמט תאריך
                      </div>
                    </div>
                  </div>
                )}
                
                {stats.swapRate > 10 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg">
                    <ArrowLeftRight className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <div className="font-medium">שיעור החלפות יום/חודש גבוה</div>
                      <div className="text-sm text-muted-foreground">
                        יש בעיה עם פורמט תאריכים - שקול להוסיף זיהוי מדינה
                      </div>
                    </div>
                  </div>
                )}

                {stats.dateAccuracy >= 90 && (
                  <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">דיוק תאריכים מצוין!</div>
                      <div className="text-sm text-muted-foreground">
                        ה-AI מזהה תאריכים בצורה טובה מאוד
                      </div>
                    </div>
                  </div>
                )}

                {stats.byDevice.find(d => d.device === 'נייד')?.accuracy && 
                 stats.byDevice.find(d => d.device === 'מחשב')?.accuracy &&
                 Math.abs(
                   (stats.byDevice.find(d => d.device === 'נייד')?.accuracy || 0) - 
                   (stats.byDevice.find(d => d.device === 'מחשב')?.accuracy || 0)
                 ) > 15 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg">
                    <Smartphone className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="font-medium">פער בין מכשירים</div>
                      <div className="text-sm text-muted-foreground">
                        יש הבדל משמעותי בדיוק בין מחשב לנייד - בדוק איכות תמונות
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
