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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">הצוות שלי</h1>
                <p className="text-sm text-muted-foreground">עובדים ודוחות הצוות</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate('/manager/stats')}>
                <BarChart3 className="w-4 h-4 ml-1" />
                <span className="hidden sm:inline">סטטיסטיקות</span>
                <span className="sm:hidden">סטט'</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <span className="hidden sm:inline">חזרה לדשבורד</span>
                <span className="sm:hidden">חזרה</span>
                <ArrowRight className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">עובדים בצוות</p>
                  <p className="text-3xl font-bold text-blue-600">{teamMembers.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ דוחות</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ממתינים לאישור</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">דוחות מאושרים</p>
                  <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✓</span>
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
