import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Eye, Loader2, ArrowRight, FileText, BarChart3, UserPlus, Copy, Ticket, Calendar, Hash } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

interface InvitationCode {
  id: string;
  code: string;
  expires_at: string;
  is_used: boolean;
  use_count: number;
  max_uses: number;
  notes: string | null;
  created_at: string;
}

export default function MyTeam() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamReports, setTeamReports] = useState<TeamReport[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodeNotes, setNewCodeNotes] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1);
  const [newCodeExpiryDays, setNewCodeExpiryDays] = useState(7);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadTeamData();
    loadInvitationCodes();
  }, [user]);

  const loadInvitationCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('manager_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitationCodes(data || []);
    } catch (error) {
      console.error('Error loading invitation codes:', error);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createInvitationCode = async () => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      // Get manager's organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.organization_id) {
        throw new Error('לא נמצא ארגון למנהל');
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + newCodeExpiryDays);

      const { error } = await supabase
        .from('invitation_codes')
        .insert({
          code: generateCode(),
          organization_id: profile.organization_id,
          manager_id: user.id,
          created_by: user.id,
          expires_at: expiryDate.toISOString(),
          max_uses: newCodeMaxUses,
          notes: newCodeNotes || null,
          role: 'user',
        });

      if (error) throw error;

      toast({
        title: 'קוד הזמנה נוצר',
        description: 'קוד ההזמנה נוצר בהצלחה',
      });

      setIsCreateDialogOpen(false);
      setNewCodeNotes('');
      setNewCodeMaxUses(1);
      setNewCodeExpiryDays(7);
      loadInvitationCodes();
    } catch (error: any) {
      console.error('Error creating invitation code:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן ליצור קוד הזמנה',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'הקוד הועתק',
      description: 'קוד ההזמנה הועתק ללוח',
    });
  };

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
      <header className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-b border-blue-100 dark:border-blue-900/30 fixed top-0 inset-x-0 z-50 overflow-hidden">
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

      <main className="container mx-auto px-4 pt-32 pb-8">
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">עובדי הצוות</TabsTrigger>
            <TabsTrigger value="reports">דוחות הצוות</TabsTrigger>
            <TabsTrigger value="invitations">קודי הזמנה</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 via-primary to-indigo-500" />
              <CardHeader className="bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 border-b border-blue-100/50 dark:border-blue-900/30">
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  עובדי הצוות
                </CardTitle>
                <CardDescription className="text-primary/80">
                  רשימת העובדים שאתה מנהל הישיר שלהם
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין עובדים בצוות</h3>
                    <p className="text-muted-foreground">
                      עדיין לא הוגדרת כמנהל ישיר של עובדים במערכת
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile view - cards */}
                    <div className="md:hidden p-4 space-y-3">
                      {teamMembers.map((member) => (
                        <div 
                          key={member.id}
                          className="bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {member.full_name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-foreground">{member.full_name}</h4>
                                <p className="text-sm text-muted-foreground">{member.username}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                              מס' {member.employee_id || '-'}
                            </Badge>
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {member.department}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop view - table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30 border-b border-blue-100 dark:border-blue-900/30 hover:bg-slate-50 dark:hover:bg-slate-900">
                            <TableHead className="text-primary font-bold">שם מלא</TableHead>
                            <TableHead className="text-primary font-bold">אימייל</TableHead>
                            <TableHead className="text-primary font-bold">מס' עובד</TableHead>
                            <TableHead className="text-primary font-bold">מחלקה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((member, index) => (
                            <TableRow 
                              key={member.id}
                              className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-slate-50/50 dark:bg-slate-900/30'}`}
                            >
                              <TableCell className="font-semibold text-foreground">{member.full_name}</TableCell>
                              <TableCell className="text-muted-foreground">{member.username}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                  {member.employee_id || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {member.department}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-400 via-primary to-indigo-500" />
              <CardHeader className="bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20 border-b border-purple-100/50 dark:border-purple-900/30">
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  דוחות הצוות
                </CardTitle>
                <CardDescription className="text-primary/80">
                  כל הדוחות שהוגשו על ידי עובדי הצוות שלך
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {teamReports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין דוחות</h3>
                    <p className="text-muted-foreground">
                      עדיין לא הוגשו דוחות על ידי עובדי הצוות
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile view - cards */}
                    <div className="md:hidden p-4 space-y-3">
                      {teamReports.map((report) => (
                        <div 
                          key={report.id}
                          className="bg-gradient-to-br from-white to-purple-50/30 dark:from-slate-900 dark:to-purple-950/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {report.profiles.full_name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-foreground">{report.profiles.full_name}</h4>
                                <p className="text-sm text-muted-foreground">{report.trip_destination}</p>
                              </div>
                            </div>
                            {getStatusBadge(report.status)}
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                            <span>
                              {new Date(report.trip_start_date).toLocaleDateString('he-IL')} - {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                            </span>
                            <Badge variant="secondary" className="font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                              ₪{(report.total_amount_ils || 0).toLocaleString()}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/reports/${report.id}`)}
                            className="w-full"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            צפייה בדוח
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Desktop view - table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-slate-50 to-purple-50/50 dark:from-slate-900 dark:to-purple-950/30 border-b border-purple-100 dark:border-purple-900/30 hover:bg-slate-50 dark:hover:bg-slate-900">
                            <TableHead className="text-primary font-bold">עובד</TableHead>
                            <TableHead className="text-primary font-bold">יעד</TableHead>
                            <TableHead className="text-primary font-bold">תאריכי נסיעה</TableHead>
                            <TableHead className="text-primary font-bold">סטטוס</TableHead>
                            <TableHead className="text-primary font-bold">סכום</TableHead>
                            <TableHead className="text-primary font-bold">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamReports.map((report, index) => (
                            <TableRow 
                              key={report.id}
                              className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-purple-50/50 dark:hover:bg-purple-950/20 ${index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-slate-50/50 dark:bg-slate-900/30'}`}
                            >
                              <TableCell>
                                <div>
                                  <div className="font-semibold text-foreground">{report.profiles.full_name}</div>
                                  {report.profiles.employee_id && (
                                    <div className="text-xs text-muted-foreground">
                                      מס' {report.profiles.employee_id}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-foreground">{report.trip_destination}</TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(report.trip_start_date).toLocaleDateString('he-IL')}
                                  {' - '}
                                  {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(report.status)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                  ₪{(report.total_amount_ils || 0).toLocaleString()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/reports/${report.id}`)}
                                  className="hover:bg-primary/10 hover:text-primary"
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
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500" />
              <CardHeader className="bg-gradient-to-br from-teal-50/50 to-transparent dark:from-teal-950/20 border-b border-teal-100/50 dark:border-teal-900/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-foreground flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-teal-600" />
                      קודי הזמנה
                    </CardTitle>
                    <CardDescription className="text-primary/80">
                      צור קודי הזמנה לעובדים חדשים שיצטרפו לצוות שלך
                    </CardDescription>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white shadow-lg rounded-xl h-11 px-5">
                        <UserPlus className="w-4 h-4 ml-2" />
                        צור קוד הזמנה
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md" dir="rtl">
                      <DialogHeader>
                        <DialogTitle>יצירת קוד הזמנה חדש</DialogTitle>
                        <DialogDescription>
                          צור קוד הזמנה עבור עובד חדש שיצטרף לצוות שלך
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxUses">מספר שימושים מקסימלי</Label>
                          <Input
                            id="maxUses"
                            type="number"
                            min={1}
                            max={100}
                            value={newCodeMaxUses}
                            onChange={(e) => setNewCodeMaxUses(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expiryDays">תוקף (ימים)</Label>
                          <Input
                            id="expiryDays"
                            type="number"
                            min={1}
                            max={365}
                            value={newCodeExpiryDays}
                            onChange={(e) => setNewCodeExpiryDays(parseInt(e.target.value) || 7)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">הערות (אופציונלי)</Label>
                          <Input
                            id="notes"
                            placeholder="לדוגמה: הזמנה למחלקת פיתוח"
                            value={newCodeNotes}
                            onChange={(e) => setNewCodeNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          ביטול
                        </Button>
                        <Button onClick={createInvitationCode} disabled={isCreating}>
                          {isCreating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                          צור קוד
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {invitationCodes.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין קודי הזמנה</h3>
                    <p className="text-muted-foreground mb-4">
                      צור קוד הזמנה כדי להזמין עובדים חדשים לצוות שלך
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile view - cards */}
                    <div className="md:hidden p-4 space-y-3">
                      {invitationCodes.map((code) => {
                        const isExpired = new Date(code.expires_at) < new Date();
                        const isFullyUsed = code.use_count >= code.max_uses;
                        return (
                          <div 
                            key={code.id}
                            className="bg-gradient-to-br from-white to-teal-50/30 dark:from-slate-900 dark:to-teal-950/20 rounded-xl p-4 border border-teal-100 dark:border-teal-900/30 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <code className="font-mono font-bold text-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                                {code.code}
                              </code>
                              {isExpired ? (
                                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                  פג תוקף
                                </Badge>
                              ) : isFullyUsed ? (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  נוצל במלואו
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  פעיל
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(code.expires_at).toLocaleDateString('he-IL')}
                              </div>
                              <div className="flex items-center gap-1">
                                <Hash className="w-4 h-4" />
                                <span className={code.use_count >= code.max_uses ? 'text-red-600' : ''}>
                                  {code.use_count} / {code.max_uses}
                                </span>
                              </div>
                            </div>
                            {code.notes && (
                              <p className="text-sm text-muted-foreground mb-3">{code.notes}</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyCode(code.code)}
                              className="w-full"
                              disabled={isExpired || isFullyUsed}
                            >
                              <Copy className="w-4 h-4 ml-1" />
                              העתק קוד
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop view - table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-slate-50 to-teal-50/50 dark:from-slate-900 dark:to-teal-950/30 border-b border-teal-100 dark:border-teal-900/30 hover:bg-slate-50 dark:hover:bg-slate-900">
                            <TableHead className="text-primary font-bold">קוד</TableHead>
                            <TableHead className="text-primary font-bold">תוקף</TableHead>
                            <TableHead className="text-primary font-bold">שימושים</TableHead>
                            <TableHead className="text-primary font-bold">סטטוס</TableHead>
                            <TableHead className="text-primary font-bold">הערות</TableHead>
                            <TableHead className="text-primary font-bold">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invitationCodes.map((code, index) => {
                            const isExpired = new Date(code.expires_at) < new Date();
                            const isFullyUsed = code.use_count >= code.max_uses;
                            return (
                              <TableRow 
                                key={code.id}
                                className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-teal-50/50 dark:hover:bg-teal-950/20 ${index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-slate-50/50 dark:bg-slate-900/30'}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono font-bold text-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                      {code.code}
                                    </code>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(code.expires_at).toLocaleDateString('he-IL')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Hash className="w-4 h-4 text-muted-foreground" />
                                    <span className={code.use_count >= code.max_uses ? 'text-red-600' : ''}>
                                      {code.use_count} / {code.max_uses}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isExpired ? (
                                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                      פג תוקף
                                    </Badge>
                                  ) : isFullyUsed ? (
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      נוצל במלואו
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                      פעיל
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {code.notes || '-'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyCode(code.code)}
                                    className="hover:bg-primary/10 hover:text-primary"
                                    disabled={isExpired || isFullyUsed}
                                  >
                                    <Copy className="w-4 h-4 ml-1" />
                                    העתק
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
