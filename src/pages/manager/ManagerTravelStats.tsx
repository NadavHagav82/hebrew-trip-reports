import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Plane, Clock, CheckCircle, XCircle, AlertTriangle, Users, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface TravelRequest {
  id: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  estimated_total_ils: number;
  approved_total_ils: number | null;
  status: string;
  submitted_at: string | null;
  requested_by: string;
  requester?: {
    full_name: string;
    department: string;
  };
}

interface TeamMember {
  id: string;
  full_name: string;
  department: string;
}

export default function ManagerTravelStats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Stats
  const [monthlyStats, setMonthlyStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  
  const [budgetStats, setBudgetStats] = useState({
    totalRequested: 0,
    totalApproved: 0,
    savings: 0
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get team members
      const { data: team, error: teamError } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('manager_id', user.id);
      
      if (teamError) throw teamError;
      setTeamMembers(team || []);

      if (!team || team.length === 0) {
        setLoading(false);
        return;
      }

      const teamIds = team.map(m => m.id);

      // Get travel requests for team
      const { data: requests, error: requestsError } = await supabase
        .from('travel_requests')
        .select('*')
        .in('requested_by', teamIds)
        .order('created_at', { ascending: false });
      
      if (requestsError) throw requestsError;

      // Enrich with requester info
      const enrichedRequests = requests?.map(req => ({
        ...req,
        requester: team.find(m => m.id === req.requested_by)
      })) || [];

      setTravelRequests(enrichedRequests);

      // Calculate monthly stats
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      const monthlyRequests = enrichedRequests.filter(r => 
        r.submitted_at && isWithinInterval(new Date(r.submitted_at), { start: monthStart, end: monthEnd })
      );

      setMonthlyStats({
        pending: monthlyRequests.filter(r => r.status === 'pending_approval').length,
        approved: monthlyRequests.filter(r => ['approved', 'partially_approved'].includes(r.status)).length,
        rejected: monthlyRequests.filter(r => r.status === 'rejected').length,
        total: monthlyRequests.length
      });

      // Calculate budget stats (all time)
      const approvedRequests = enrichedRequests.filter(r => 
        ['approved', 'partially_approved'].includes(r.status)
      );

      const totalRequested = approvedRequests.reduce((sum, r) => sum + (r.estimated_total_ils || 0), 0);
      const totalApproved = approvedRequests.reduce((sum, r) => sum + (r.approved_total_ils || r.estimated_total_ils || 0), 0);

      setBudgetStats({
        totalRequested,
        totalApproved,
        savings: totalRequested - totalApproved
      });

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const statusChartData = [
    { name: 'ממתינות', value: travelRequests.filter(r => r.status === 'pending_approval').length, color: '#F59E0B' },
    { name: 'מאושרות', value: travelRequests.filter(r => ['approved', 'partially_approved'].includes(r.status)).length, color: '#22C55E' },
    { name: 'נדחו', value: travelRequests.filter(r => r.status === 'rejected').length, color: '#EF4444' },
    { name: 'טיוטות', value: travelRequests.filter(r => r.status === 'draft').length, color: '#94A3B8' },
  ].filter(d => d.value > 0);

  // Group by employee
  const employeeStats = teamMembers.map(member => {
    const memberRequests = travelRequests.filter(r => r.requested_by === member.id);
    return {
      name: member.full_name.split(' ')[0],
      fullName: member.full_name,
      pending: memberRequests.filter(r => r.status === 'pending_approval').length,
      approved: memberRequests.filter(r => ['approved', 'partially_approved'].includes(r.status)).length,
      rejected: memberRequests.filter(r => r.status === 'rejected').length,
      total: memberRequests.length
    };
  }).filter(e => e.total > 0);

  // Recent pending requests
  const pendingRequests = travelRequests
    .filter(r => r.status === 'pending_approval')
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">סטטיסטיקות בקשות נסיעה - הצוות</h1>
              <p className="text-muted-foreground">מעקב אחר בקשות נסיעה של חברי הצוות</p>
            </div>
          </div>
          <Button onClick={() => navigate('/travel-requests/pending')}>
            <Clock className="h-4 w-4 ml-2" />
            בקשות ממתינות לאישור
          </Button>
        </div>

        {/* Monthly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ממתינות החודש</p>
                  <p className="text-3xl font-bold text-amber-600">{monthlyStats.pending}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">אושרו החודש</p>
                  <p className="text-3xl font-bold text-green-600">{monthlyStats.approved}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נדחו החודש</p>
                  <p className="text-3xl font-bold text-red-600">{monthlyStats.rejected}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ החודש</p>
                  <p className="text-3xl font-bold text-blue-600">{monthlyStats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Plane className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              סיכום תקציב (כל הזמנים)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">סה"כ מבוקש</p>
                <p className="text-2xl font-bold">${budgetStats.totalRequested.toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">סה"כ מאושר</p>
                <p className="text-2xl font-bold text-green-600">${budgetStats.totalApproved.toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">חיסכון</p>
                <p className="text-2xl font-bold text-blue-600">${budgetStats.savings.toLocaleString()}</p>
                {budgetStats.totalRequested > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ({((budgetStats.savings / budgetStats.totalRequested) * 100).toFixed(1)}%)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>התפלגות סטטוסים</CardTitle>
              <CardDescription>כל הבקשות</CardDescription>
            </CardHeader>
            <CardContent>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  אין נתונים להצגה
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requests by Employee */}
          <Card>
            <CardHeader>
              <CardTitle>בקשות לפי עובד</CardTitle>
              <CardDescription>התפלגות בקשות בצוות</CardDescription>
            </CardHeader>
            <CardContent>
              {employeeStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={employeeStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => {
                        const labels: Record<string, string> = {
                          pending: 'ממתינות',
                          approved: 'מאושרות',
                          rejected: 'נדחו'
                        };
                        return [value, labels[name as string] || name];
                      }}
                    />
                    <Bar dataKey="pending" stackId="a" fill="#F59E0B" name="pending" />
                    <Bar dataKey="approved" stackId="a" fill="#22C55E" name="approved" />
                    <Bar dataKey="rejected" stackId="a" fill="#EF4444" name="rejected" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  אין נתונים להצגה
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                בקשות ממתינות לאישור
              </CardTitle>
              <CardDescription>בקשות שמחכות להחלטתך</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
                        <Plane className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">{request.requester?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.destination_city}, {request.destination_country} • 
                          {format(new Date(request.start_date), ' d MMM', { locale: he })} - 
                          {format(new Date(request.end_date), ' d MMM', { locale: he })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">${request.estimated_total_ils?.toLocaleString()}</span>
                      <Button 
                        size="sm"
                        onClick={() => navigate('/travel-requests/pending')}
                      >
                        עבור לאישור
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              סטטוס הצוות
            </CardTitle>
            <CardDescription>{teamMembers.length} חברי צוות</CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => {
                  const memberRequests = travelRequests.filter(r => r.requested_by === member.id);
                  const pending = memberRequests.filter(r => r.status === 'pending_approval').length;
                  const approved = memberRequests.filter(r => ['approved', 'partially_approved'].includes(r.status)).length;
                  
                  return (
                    <div key={member.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.full_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.department}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {pending > 0 && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            {pending} ממתינות
                          </Badge>
                        )}
                        {approved > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            {approved} מאושרות
                          </Badge>
                        )}
                        {memberRequests.length === 0 && (
                          <span className="text-xs text-muted-foreground">אין בקשות</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>אין חברי צוות תחתיך</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
