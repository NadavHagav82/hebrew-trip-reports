import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Edit, Eye, FileText, LogOut, Plus, Search, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  status: 'draft' | 'open' | 'closed';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  full_name: string;
  employee_id: string;
  department: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editedProfile, setEditedProfile] = useState({ full_name: '', department: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    fetchReports();
    fetchProfile();
  }, [user, navigate]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הדוחות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setEditedProfile({
        full_name: data.full_name || '',
        department: data.department || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          department: editedProfile.department,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'הפרופיל עודכן בהצלחה',
        description: 'הפרטים שלך נשמרו במערכת',
      });

      setProfile({
        ...profile,
        full_name: editedProfile.full_name,
        department: editedProfile.department,
      });
      setShowProfileDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewEmail('');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'שגיאה בעדכון הפרופיל',
        description: error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל שדות הסיסמה',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמאות החדשות אינן תואמות',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמה חייבת להכיל לפחות 8 תווים',
        variant: 'destructive',
      });
      return;
    }

    setSavingProfile(true);
    try {
      // Step 1: Verify current password by attempting re-authentication
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email!,
        password: currentPassword,
      });

      if (verifyError) {
        toast({
          title: 'שגיאה',
          description: 'הסיסמה הנוכחית שגויה',
          variant: 'destructive',
        });
        return;
      }

      // Step 2: Update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'הסיסמה עודכנה בהצלחה',
        description: 'הסיסמה החדשה שלך נשמרה',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: 'שגיאה בעדכון הסיסמה',
        description: error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!currentPassword || !newEmail) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא סיסמה נוכחית ואימייל חדש',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: 'שגיאה',
        description: 'כתובת האימייל אינה תקינה',
        variant: 'destructive',
      });
      return;
    }

    if (newEmail === user?.email) {
      toast({
        title: 'שגיאה',
        description: 'האימייל החדש זהה לאימייל הנוכחי',
        variant: 'destructive',
      });
      return;
    }

    setSavingProfile(true);
    try {
      // Step 1: Verify current password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email!,
        password: currentPassword,
      });

      if (verifyError) {
        toast({
          title: 'שגיאה',
          description: 'הסיסמה הנוכחית שגויה',
          variant: 'destructive',
        });
        return;
      }

      // Step 2: Update email (Supabase will send verification email automatically)
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast({
        title: 'נשלח אימות אימייל',
        description: 'נשלח מייל אימות לכתובת החדשה. יש ללחוץ על הלינק במייל כדי לאשר את השינוי.',
      });

      setCurrentPassword('');
      setNewEmail('');
    } catch (error) {
      console.error('Error updating email:', error);
      toast({
        title: 'שגיאה בעדכון האימייל',
        description: error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const getStatistics = () => {
    return {
      open: reports.filter(r => r.status === 'open').length,
      draft: reports.filter(r => r.status === 'draft').length,
      closed: reports.filter(r => r.status === 'closed').length,
    };
  };

  const filterReports = (status?: string) => {
    let filtered = reports;
    
    if (status && status !== 'all') {
      if (status === 'drafts') {
        filtered = filtered.filter(r => r.status === 'draft');
      } else if (status === 'closed') {
        filtered = filtered.filter(r => r.status === 'closed');
      } else {
        filtered = filtered.filter(r => r.status === 'open');
      }
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.trip_destination.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const stats = getStatistics();
  const displayedReports = filterReports(activeTab);

  const calculateDaysOpen = (submittedAt: string | null) => {
    if (!submittedAt) return 0;
    const submitted = new Date(submittedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - submitted.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold">דוחות נסיעה</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => navigate('/reports/new')} 
                size="sm"
                className="h-9 gap-1.5 shadow-sm hidden sm:flex"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">דוח חדש</span>
              </Button>
              <Button 
                onClick={() => navigate('/reports/new')} 
                size="icon"
                className="h-9 w-9 sm:hidden"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">
                {profile?.full_name || user?.email}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowProfileDialog(true)}
                className="h-8 w-8 sm:h-9 sm:w-9"
                title="פרופיל"
              >
                <User className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 sm:h-9 gap-1 sm:gap-2">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">יציאה</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] border hover:border-orange-300/50" onClick={() => setActiveTab('open')}>
            <CardContent className="p-3">
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-8 h-8 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <span className="text-lg">🟠</span>
                </div>
                <p className="text-xs text-muted-foreground">פתוחים</p>
                <p className="text-xl font-bold text-orange-600">{stats.open}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] border hover:border-green-300/50" onClick={() => setActiveTab('closed')}>
            <CardContent className="p-3">
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-8 h-8 bg-green-600/10 rounded-full flex items-center justify-center">
                  <span className="text-lg">🟢</span>
                </div>
                <p className="text-xs text-muted-foreground">סגורים</p>
                <p className="text-xl font-bold text-green-600">{stats.closed}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] border hover:border-gray-300/50" onClick={() => setActiveTab('drafts')}>
            <CardContent className="p-3">
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-8 h-8 bg-gray-500/10 rounded-full flex items-center justify-center">
                  <span className="text-lg">🔘</span>
                </div>
                <p className="text-xs text-muted-foreground">טיוטות</p>
                <p className="text-xl font-bold text-gray-600">{stats.draft}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-4 h-auto">
                  <TabsTrigger value="all" className="text-xs sm:text-sm py-2">כל הדוחות</TabsTrigger>
                  <TabsTrigger value="open" className="text-xs sm:text-sm py-2">פתוחים</TabsTrigger>
                  <TabsTrigger value="drafts" className="text-xs sm:text-sm py-2">טיוטות</TabsTrigger>
                  <TabsTrigger value="closed" className="text-xs sm:text-sm py-2">סגורים</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search */}
            <div className="mb-4 sm:mb-6 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="חיפוש לפי יעד..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-12 sm:h-10 text-base"
              />
            </div>

            {/* Reports Table/Cards */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-base">טוען דוחות...</p>
              </div>
            ) : displayedReports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-base mb-4">אין דוחות להצגה</p>
                <Button onClick={() => navigate('/reports/new')} className="h-12">
                  <Plus className="w-4 h-4 ml-2" />
                  צור דוח ראשון
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-right p-4 font-semibold">סטטוס</th>
                        <th className="text-right p-4 font-semibold">יעד</th>
                        <th className="text-right p-4 font-semibold">תאריכים</th>
                        <th className="text-right p-4 font-semibold">סה"כ (₪)</th>
                        <th className="text-right p-4 font-semibold">הוגש</th>
                        <th className="text-right p-4 font-semibold">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedReports.map((report) => (
                        <tr key={report.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-4">
                            <StatusBadge 
                              status={report.status} 
                              daysOpen={report.status === 'open' ? calculateDaysOpen(report.submitted_at) : undefined}
                            />
                          </td>
                          <td className="p-4 font-medium">{report.trip_destination}</td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {new Date(report.trip_start_date).toLocaleDateString('he-IL')} - {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                          </td>
                          <td className="p-4 font-semibold">
                            {report.total_amount_ils?.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString('he-IL') : '-'}
                          </td>
                          <td className="p-4">
                            {report.status === 'draft' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/reports/edit/${report.id}`)}
                              >
                                המשך עריכה
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/reports/${report.id}`)}
                              >
                                צפייה
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {displayedReports.map((report) => (
                    <Card key={report.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">{report.trip_destination}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(report.trip_start_date).toLocaleDateString('he-IL')} - {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                            </p>
                          </div>
                          <StatusBadge 
                            status={report.status} 
                            daysOpen={report.status === 'open' ? calculateDaysOpen(report.submitted_at) : undefined}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between mb-3 pt-3 border-t">
                          <span className="text-sm text-muted-foreground">סה"כ</span>
                          <span className="text-xl font-bold">
                            ₪{report.total_amount_ils?.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {report.submitted_at && (
                          <p className="text-xs text-muted-foreground mb-3">
                            הוגש: {new Date(report.submitted_at).toLocaleDateString('he-IL')}
                          </p>
                        )}

                        <Button
                          className={`w-full h-12 text-base font-semibold shadow-sm hover:shadow-md transition-all ${
                            report.status === 'draft' 
                              ? '' 
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground border-0'
                          }`}
                          variant={report.status === 'draft' ? 'default' : 'default'}
                          onClick={() => navigate(report.status === 'draft' ? `/reports/edit/${report.id}` : `/reports/${report.id}`)}
                        >
                          {report.status === 'draft' ? (
                            <>
                              <Edit className="w-5 h-5 ml-2" />
                              המשך עריכה
                            </>
                          ) : (
                            <>
                              <Eye className="w-5 h-5 ml-2" />
                              צפה בדוח
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">הפרופיל שלי</DialogTitle>
                  <DialogDescription className="text-sm">
                    {profile?.full_name || user?.email}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50">
                <TabsTrigger value="profile" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <User className="w-4 h-4 ml-2" />
                  פרטים אישיים
                </TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <span className="ml-2">🔐</span>
                  אבטחה
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <TabsContent value="profile" className="space-y-5 mt-0 animate-fade-in">
                <div className="bg-gradient-to-br from-muted/30 to-muted/10 p-4 rounded-xl border shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                    <h3 className="font-semibold">פרטי המשתמש</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium flex items-center gap-1.5">
                      <span className="text-muted-foreground">@</span>
                      שם משתמש
                    </Label>
                    <Input 
                      id="username" 
                      value={profile?.username || ''} 
                      disabled 
                      className="bg-background/60 border-dashed"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee_id" className="text-sm font-medium flex items-center gap-1.5">
                      <span className="text-muted-foreground">#</span>
                      מספר עובד
                    </Label>
                    <Input 
                      id="employee_id" 
                      value={profile?.employee_id || ''} 
                      disabled 
                      className="bg-background/60 border-dashed"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-background p-4 rounded-xl border-2 border-primary/20 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Edit className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-primary">פרטים הניתנים לעריכה</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium">שם מלא *</Label>
                    <Input 
                      id="full_name" 
                      value={editedProfile.full_name}
                      onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                      placeholder="הזן שם מלא"
                      className="h-11 shadow-sm border-2 focus:border-primary/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium">מחלקה / חברה *</Label>
                    <Input 
                      id="department" 
                      value={editedProfile.department}
                      onChange={(e) => setEditedProfile({ ...editedProfile, department: e.target.value })}
                      placeholder="הזן שם מחלקה או חברה"
                      className="h-11 shadow-sm border-2 focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowProfileDialog(false)}
                    disabled={savingProfile}
                    className="flex-1 h-11"
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !editedProfile.full_name || !editedProfile.department}
                    className="flex-1 h-11 shadow-md hover:shadow-lg transition-shadow"
                  >
                    {savingProfile ? 'שומר...' : '✓ שמור שינויים'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-5 mt-0 animate-fade-in">
                <div className="bg-gradient-to-br from-orange-50 to-orange-50/30 dark:from-orange-950/20 dark:to-orange-950/5 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-900 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <span className="text-lg">🔑</span>
                    </div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">אימות נדרש</h3>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_password" className="text-sm font-medium">סיסמה נוכחית *</Label>
                    <Input 
                      id="current_password" 
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="הזן סיסמה נוכחית"
                      className="h-11 bg-background shadow-sm"
                    />
                    <p className="text-xs text-muted-foreground">נדרשת לאימות כל שינוי באבטחה</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-blue-950/20 dark:to-blue-950/5 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-xl">📧</span>
                    </div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">שינוי כתובת אימייל</h4>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_email" className="text-sm font-medium">אימייל חדש</Label>
                    <Input 
                      id="new_email" 
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder={user?.email || "הזן כתובת אימייל חדשה"}
                      className="h-11 bg-background shadow-sm"
                    />
                    <div className="bg-blue-100/50 dark:bg-blue-900/20 rounded-lg p-2.5">
                      <p className="text-xs text-blue-900 dark:text-blue-100">
                        📬 האימייל הנוכחי: <span className="font-medium">{user?.email}</span>
                      </p>
                    </div>
                  </div>

                  {(currentPassword && newEmail) && (
                    <Button 
                      onClick={handleChangeEmail}
                      disabled={savingProfile}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                    >
                      {savingProfile ? 'שולח אימות...' : '✉️ שנה אימייל'}
                    </Button>
                  )}
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-50/30 dark:from-purple-950/20 dark:to-purple-950/5 p-5 rounded-xl border-2 border-purple-200 dark:border-purple-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <span className="text-xl">🔒</span>
                    </div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">שינוי סיסמה</h4>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password" className="text-sm font-medium">סיסמה חדשה</Label>
                    <Input 
                      id="new_password" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="לפחות 8 תווים"
                      className="h-11 bg-background shadow-sm"
                    />
                    <PasswordStrengthIndicator password={newPassword} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-sm font-medium">אישור סיסמה</Label>
                    <Input 
                      id="confirm_password" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="הזן שוב את הסיסמה החדשה"
                      className="h-11 bg-background shadow-sm"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-2.5">
                        <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                          <span>✗</span> הסיסמאות אינן תואמות
                        </p>
                      </div>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-2.5">
                        <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
                          <span>✓</span> הסיסמאות תואמות
                        </p>
                      </div>
                    )}
                  </div>

                  {(currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) && (
                    <Button 
                      onClick={handleChangePassword}
                      disabled={savingProfile}
                      className="w-full h-11 bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all"
                    >
                      {savingProfile ? 'מעדכן סיסמה...' : '🔐 עדכן סיסמה'}
                    </Button>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
