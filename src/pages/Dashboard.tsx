import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Edit, Eye, FileText, LogOut, Plus, Search, User, FileStack, FolderOpen, FilePen, CheckCircle2, Calculator, BarChart3, Building2 } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
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
  status: 'draft' | 'open' | 'closed' | 'pending_approval';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  manager_approval_requested_at?: string | null;
  manager_approval_token?: string | null;
}

interface Profile {
  id: string;
  username: string;
  full_name: string;
  employee_id: string | null;
  department: string;
  accounting_manager_email?: string | null;
  manager_id?: string | null;
  is_manager?: boolean;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managers, setManagers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [editedProfile, setEditedProfile] = useState({ 
    full_name: '', 
    department: '',
    accounting_manager_email: '',
    manager_id: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isAccountingManager, setIsAccountingManager] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    fetchReports();
    fetchProfile();
    fetchManagers();
    checkAdminStatus();
    checkManagerStatus();
    checkOrgAdminStatus();
    checkAccountingManagerStatus();
  }, [user, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    setIsAdmin(!!data);
  };

  const checkManagerStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'manager' });
    setIsManager(!!data);
  };

  const checkOrgAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'org_admin' });
    setIsOrgAdmin(!!data);
  };

  const checkAccountingManagerStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'accounting_manager' });
    setIsAccountingManager(!!data);
  };

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
        accounting_manager_email: data.accounting_manager_email || '',
        manager_id: data.manager_id || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_manager', true)
        .order('full_name');

      if (error) throw error;
      
      setManagers(data.map(m => ({ 
        id: m.id, 
        full_name: m.full_name, 
        email: m.email 
      })));
    } catch (error) {
      console.error('Error loading managers:', error);
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
          accounting_manager_email: editedProfile.accounting_manager_email || null,
          manager_id: (!profile.is_manager && editedProfile.manager_id) ? editedProfile.manager_id : null,
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
        accounting_manager_email: editedProfile.accounting_manager_email,
        manager_id: editedProfile.manager_id,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-blue-50/30 dark:from-slate-950 dark:via-background dark:to-blue-950/20">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => setShowProfileDialog(true)}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 via-primary to-indigo-600 rounded-xl flex items-center justify-center hover:from-blue-400 hover:via-primary/90 hover:to-indigo-500 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shadow-primary/25 hover:shadow-primary/40"
                title="פרופיל"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-rubik font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                  {profile?.full_name || 'דוחות נסיעה'}
                </h1>
                <p className="text-xs text-muted-foreground">{profile?.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isAccountingManager && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate('/accounting')}
                  className="h-9 w-9 sm:h-10 sm:w-10 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl"
                  title="דשבורד הנהלת חשבונות"
                >
                  <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/analytics')}
                className="h-9 w-9 sm:h-10 sm:w-10 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl"
                title="אנליטיקה"
              >
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </Button>
              {isManager && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/manager/dashboard')}
                    className="h-9 w-9 sm:h-10 sm:w-10 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl"
                    title="דשבורד מנהלים"
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/manager/team')}
                    className="h-9 w-9 sm:h-10 sm:w-10 bg-green-500/10 hover:bg-green-500/20 rounded-xl"
                    title="הצוות שלי"
                  >
                    <FileStack className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/manager/stats')}
                    className="h-9 w-9 sm:h-10 sm:w-10 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl hidden sm:flex"
                    title="סטטיסטיקות"
                  >
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </Button>
                </>
              )}
              {isOrgAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate('/orgadmin')}
                  className="h-9 w-9 sm:h-10 sm:w-10 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl"
                  title="ניהול ארגון"
                >
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </Button>
              )}
              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate('/admin/roles')}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl"
                  title="ניהול משתמשים"
                >
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              )}
              <div className="bg-amber-500/10 hover:bg-amber-500/20 rounded-xl">
                <NotificationBell />
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-9 sm:h-10 gap-1 sm:gap-2 rounded-xl hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">יציאה</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 relative">
        {/* Create New Report Button */}
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/reports/new')} 
            size="lg"
            className="w-full h-16 sm:h-20 text-lg font-bold shadow-xl hover:shadow-2xl transition-all gap-3 bg-gradient-to-r from-blue-500 via-primary to-indigo-600 hover:from-blue-400 hover:via-primary/90 hover:to-indigo-500 relative overflow-hidden group rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center ring-2 ring-white/30 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 relative z-10 backdrop-blur-sm">
              <Plus className="w-7 h-7" />
            </div>
            <span className="relative z-10 text-xl">דוח נסיעה חדש</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.03] border-0 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 overflow-hidden group relative" 
            onClick={() => setActiveTab('open')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-4 sm:p-6 relative">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">פתוחים</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.open}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.03] border-0 bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20 overflow-hidden group relative" 
            onClick={() => setActiveTab('closed')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-4 sm:p-6 relative">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">סגורים</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.closed}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.03] border-0 bg-gradient-to-br from-slate-50 to-gray-50/50 dark:from-slate-950/30 dark:to-gray-950/20 overflow-hidden group relative" 
            onClick={() => setActiveTab('drafts')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 to-gray-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-4 sm:p-6 relative">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-slate-400 to-gray-500 rounded-xl flex items-center justify-center shadow-lg shadow-slate-500/30 group-hover:scale-110 transition-transform">
                  <FilePen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">טיוטות</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-600">{stats.draft}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-4 h-auto bg-muted/30 p-1.5 gap-1.5 rounded-xl">
                  <TabsTrigger 
                    value="all" 
                    className="text-xs sm:text-sm py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-indigo-600 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all flex items-center gap-1.5 justify-center rounded-lg"
                  >
                    <FileStack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>כל הדוחות</span>
                    <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-background/20">
                      {reports.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="open" 
                    className="text-xs sm:text-sm py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all flex items-center gap-1.5 justify-center rounded-lg"
                  >
                    <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>פתוחים</span>
                    <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-background/20">
                      {stats.open}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="closed" 
                    className="text-xs sm:text-sm py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all flex items-center gap-1.5 justify-center rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>סגורים</span>
                    <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-background/20">
                      {stats.closed}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="drafts" 
                    className="text-xs sm:text-sm py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-500 data-[state=active]:to-gray-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all flex items-center gap-1.5 justify-center rounded-lg"
                  >
                    <FilePen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>טיוטות</span>
                    <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-background/20">
                      {stats.draft}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search */}
            <div className="mb-4 sm:mb-6 relative group">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="חיפוש לפי יעד..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-11 h-12 text-base bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
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
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">עריכת פרופיל</DialogTitle>
                <DialogDescription>
                  {profile?.full_name || user?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
              <TabsTrigger value="profile">
                <User className="w-4 h-4 ml-2" />
                פרטים אישיים
              </TabsTrigger>
              <TabsTrigger value="security">
                🔐 אבטחה
              </TabsTrigger>
            </TabsList>
            
            <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
              <TabsContent value="profile" className="space-y-4 mt-0 pr-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>📋</span>
                      פרטי המשתמש
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm">שם משתמש</Label>
                      <Input 
                        id="username" 
                        value={profile?.username || ''} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="employee_id" className="text-sm">מספר עובד</Label>
                      <Input 
                        id="employee_id" 
                        value={profile?.employee_id || ''} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Edit className="w-4 h-4" />
                      ניתן לעריכה
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm">שם מלא *</Label>
                      <Input 
                        id="full_name" 
                        value={editedProfile.full_name}
                        onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                        placeholder="הזן שם מלא"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-sm">מחלקה / חברה *</Label>
                      <Input 
                        id="department" 
                        value={editedProfile.department}
                        onChange={(e) => setEditedProfile({ ...editedProfile, department: e.target.value })}
                        placeholder="הזן שם מחלקה או חברה"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accounting_manager_email" className="text-sm">
                        מייל הנהלת חשבונות
                        <span className="text-xs text-muted-foreground mr-1">(אופציונלי)</span>
                      </Label>
                      <Input 
                        id="accounting_manager_email" 
                        type="email"
                        value={editedProfile.accounting_manager_email}
                        onChange={(e) => setEditedProfile({ ...editedProfile, accounting_manager_email: e.target.value })}
                        placeholder="accounting@company.com"
                        dir="ltr"
                      />
                      <p className="text-xs text-muted-foreground">
                        דוחות מאושרים יישלחו אוטומטית לכתובת זו. עדכונים על דוחות יישלחו למייל הרישום שלך.
                      </p>
                    </div>

                    {!profile?.is_manager && managers.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="manager_id" className="text-sm">
                          מנהל ישיר
                          <span className="text-xs text-muted-foreground mr-1">(נדרש לעובדים)</span>
                        </Label>
                        <Select 
                          value={editedProfile.manager_id} 
                          onValueChange={(value) => setEditedProfile({ ...editedProfile, manager_id: value })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="בחר מנהל מהרשימה" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-[200px]">
                            {managers.map((manager) => (
                              <SelectItem key={manager.id} value={manager.id}>
                                {manager.full_name} ({manager.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          במקרה שהמנהל עזב, ניתן לשנות כאן את המנהל המאשר שלך
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowProfileDialog(false)}
                    disabled={savingProfile}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !editedProfile.full_name || !editedProfile.department}
                    className="flex-1"
                  >
                    {savingProfile ? 'שומר...' : 'שמור שינויים'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      🔑 אימות נדרש
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="current_password" className="text-sm">סיסמה נוכחית *</Label>
                      <Input 
                        id="current_password" 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="הזן סיסמה נוכחית"
                      />
                      <p className="text-xs text-muted-foreground">נדרשת לאימות שינויים</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      📧 שינוי אימייל
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="new_email" className="text-sm">אימייל חדש</Label>
                      <Input 
                        id="new_email" 
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={user?.email || "הזן כתובת אימייל חדשה"}
                      />
                      <p className="text-xs text-muted-foreground">
                        האימייל הנוכחי: {user?.email}
                      </p>
                    </div>

                    {(currentPassword && newEmail) && (
                      <Button 
                        onClick={handleChangeEmail}
                        disabled={savingProfile}
                        className="w-full"
                        variant="secondary"
                      >
                        {savingProfile ? 'שולח אימות...' : 'שנה אימייל'}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      🔒 שינוי סיסמה
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="new_password" className="text-sm">סיסמה חדשה</Label>
                      <Input 
                        id="new_password" 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="לפחות 8 תווים"
                      />
                      <PasswordStrengthIndicator password={newPassword} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="text-sm">אישור סיסמה</Label>
                      <Input 
                        id="confirm_password" 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="הזן שוב את הסיסמה החדשה"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive">
                          ✗ הסיסמאות אינן תואמות
                        </p>
                      )}
                      {confirmPassword && newPassword === confirmPassword && (
                        <p className="text-xs text-green-600">
                          ✓ הסיסמאות תואמות
                        </p>
                      )}
                    </div>

                    {(currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) && (
                      <Button 
                        onClick={handleChangePassword}
                        disabled={savingProfile}
                        className="w-full"
                        variant="secondary"
                      >
                        {savingProfile ? 'מעדכן סיסמה...' : 'עדכן סיסמה'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
