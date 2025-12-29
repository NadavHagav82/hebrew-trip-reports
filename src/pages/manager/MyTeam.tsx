import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Eye, Loader2, ArrowRight, FileText, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TeamMember {
  id: string;
  full_name: string;
  username: string;
  employee_id: string;
  department: string;
}

interface TeamReport {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  status: string;
  total_amount_ils: number;
  submitted_at: string;
  profiles: {
    full_name: string;
    employee_id: string;
  };
}

export default function MyTeam() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamReports, setTeamReports] = useState<TeamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadTeamData();
  }, [user]);

  const loadTeamData = async () => {
    try {
      // Load team members
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, full_name, username, employee_id, department')
        .eq('manager_id', user?.id)
        .order('full_name');

      if (membersError) throw membersError;
      setTeamMembers(members || []);

      // Load team reports
      if (members && members.length > 0) {
        const memberIds = members.map(m => m.id);
        const { data: reports, error: reportsError } = await supabase
          .from('reports')
          .select(`
            *,
            profiles!reports_user_id_fkey (
              full_name,
              employee_id
            )
          `)
          .in('user_id', memberIds)
          .order('submitted_at', { ascending: false });

        if (reportsError) throw reportsError;
        setTeamReports(reports || []);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון נתוני צוות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'draft': { label: 'טיוטה', variant: 'secondary' },
      'open': { label: 'פתוח', variant: 'default' },
      'pending_approval': { label: 'ממתין לאישור', variant: 'outline' },
      'closed': { label: 'אושר', variant: 'default' },
    };
    const { label, variant } = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getReportStats = () => {
    const pending = teamReports.filter(r => r.status === 'pending_approval').length;
    const approved = teamReports.filter(r => r.status === 'closed').length;
    const total = teamReports.length;
    return { pending, approved, total };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = getReportStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-b border-blue-100 dark:border-blue-900/30 sticky top-0 z-10 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-primary to-indigo-600" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">הצוות שלי</h1>
                <p className="text-sm text-muted-foreground mt-0.5">עובדים ודוחות הצוות</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/manager/stats')}
                className="h-10 px-4 border-2 border-blue-200 dark:border-blue-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all"
              >
                <BarChart3 className="w-4 h-4 ml-1.5 text-blue-600" />
                <span className="hidden sm:inline">סטטיסטיקות</span>
                <span className="sm:hidden">סטט'</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/')}
                className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <span className="hidden sm:inline">חזרה לדשבורד</span>
                <span className="sm:hidden">חזרה</span>
                <ArrowRight className="w-4 h-4 mr-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-card overflow-hidden relative group hover:shadow-xl transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">עובדים בצוות</p>
                  <p className="text-3xl font-black text-blue-600 mt-1">{teamMembers.length}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-card overflow-hidden relative group hover:shadow-xl transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">סה"כ דוחות</p>
                  <p className="text-3xl font-black text-purple-600 mt-1">{stats.total}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card overflow-hidden relative group hover:shadow-xl transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ממתינים לאישור</p>
                  <p className="text-3xl font-black text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Loader2 className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card overflow-hidden relative group hover:shadow-xl transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">דוחות מאושרים</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{stats.approved}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-2xl text-white">✓</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">עובדי הצוות</TabsTrigger>
            <TabsTrigger value="reports">דוחות הצוות</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>עובדי הצוות</CardTitle>
                <CardDescription>
                  רשימת העובדים שאתה מנהל הישיר שלהם
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין עובדים בצוות</h3>
                    <p className="text-muted-foreground">
                      עדיין לא הוגדרת כמנהל ישיר של עובדים במערכת
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שם מלא</TableHead>
                          <TableHead>אימייל</TableHead>
                          <TableHead>מס' עובד</TableHead>
                          <TableHead>מחלקה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.full_name}</TableCell>
                            <TableCell>{member.username}</TableCell>
                            <TableCell>{member.employee_id || '-'}</TableCell>
                            <TableCell>{member.department}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>דוחות הצוות</CardTitle>
                <CardDescription>
                  כל הדוחות שהוגשו על ידי עובדי הצוות שלך
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamReports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין דוחות</h3>
                    <p className="text-muted-foreground">
                      עדיין לא הוגשו דוחות על ידי עובדי הצוות
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>עובד</TableHead>
                          <TableHead>יעד</TableHead>
                          <TableHead>תאריכי נסיעה</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>סכום</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{report.profiles.full_name}</div>
                                {report.profiles.employee_id && (
                                  <div className="text-sm text-muted-foreground">
                                    מס' {report.profiles.employee_id}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{report.trip_destination}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(report.trip_start_date).toLocaleDateString('he-IL')}
                                {' - '}
                                {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(report.status)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-semibold">
                                ₪{(report.total_amount_ils || 0).toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/reports/${report.id}`)}
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                צפייה
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
