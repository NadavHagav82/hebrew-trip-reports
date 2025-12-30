import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  ArrowRight,
  Shield,
  Users,
  Plane,
  Ban,
  Sparkles,
  Eye,
  LayoutDashboard
} from 'lucide-react';
import { EmployeeGradesManager } from '@/components/policy/EmployeeGradesManager';
import { CategoryRulesManager } from '@/components/policy/CategoryRulesManager';
import { RestrictionsManager } from '@/components/policy/RestrictionsManager';
import { CustomRulesManager } from '@/components/policy/CustomRulesManager';
import { PolicyPreview } from '@/components/policy/PolicyPreview';
import { PolicyDashboard } from '@/components/policy/PolicyDashboard';

export default function TravelPolicyBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    checkOrgAdminStatus();
  }, [user]);

  const checkOrgAdminStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'org_admin' as any
      });

      if (!data) {
        toast({
          title: 'אין הרשאה',
          description: 'רק מנהלי ארגון יכולים לגשת לדף זה',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsOrgAdmin(true);
      await loadOrgData();
    } catch (error) {
      console.error('Error checking org admin status:', error);
      navigate('/');
    }
  };

  const loadOrgData = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;

      if (!profileData?.organization_id) {
        toast({
          title: 'שגיאה',
          description: 'לא נמצא ארגון עבור המשתמש',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setOrganizationId(profileData.organization_id);

      const { data: orgData, error: orgError }: any = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', profileData.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganizationName(orgData.name);
    } catch (error: any) {
      console.error('Error loading org data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני הארגון',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgAdmin || !organizationId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
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
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">מדיניות נסיעות - {organizationName}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">הגדר את כללי מדיניות הנסיעות של הארגון שלך</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/orgadmin')}
              className="h-10 px-4 border-2 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
            >
              <span className="hidden sm:inline">חזרה לדשבורד</span>
              <span className="sm:hidden">חזרה</span>
              <ArrowRight className="w-4 h-4 mr-1.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-200/40 dark:border-slate-700/40 p-1.5 shadow-sm">
            <TabsList className="grid w-full grid-cols-6 h-auto bg-transparent gap-0.5">
              <TabsTrigger 
                value="dashboard" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-blue-600 data-[state=active]:dark:text-blue-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200/60 data-[state=active]:dark:border-blue-700/60 transition-all duration-200"
              >
                <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-blue-600 dark:group-data-[state=active]:text-blue-400" />
                <span className="text-[10px] sm:text-xs font-medium">דשבורד</span>
              </TabsTrigger>
              <TabsTrigger 
                value="grades" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-violet-600 data-[state=active]:dark:text-violet-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-violet-200/60 data-[state=active]:dark:border-violet-700/60 transition-all duration-200"
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-violet-600 dark:group-data-[state=active]:text-violet-400" />
                <span className="text-[10px] sm:text-xs font-medium">דרגות</span>
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-sky-600 data-[state=active]:dark:text-sky-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-sky-200/60 data-[state=active]:dark:border-sky-700/60 transition-all duration-200"
              >
                <Plane className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-sky-600 dark:group-data-[state=active]:text-sky-400" />
                <span className="text-[10px] sm:text-xs font-medium">קטגוריות</span>
              </TabsTrigger>
              <TabsTrigger 
                value="restrictions" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-rose-600 data-[state=active]:dark:text-rose-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-rose-200/60 data-[state=active]:dark:border-rose-700/60 transition-all duration-200"
              >
                <Ban className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-rose-600 dark:group-data-[state=active]:text-rose-400" />
                <span className="text-[10px] sm:text-xs font-medium">הגבלות</span>
              </TabsTrigger>
              <TabsTrigger 
                value="custom" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-amber-600 data-[state=active]:dark:text-amber-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-amber-200/60 data-[state=active]:dark:border-amber-700/60 transition-all duration-200"
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-amber-600 dark:group-data-[state=active]:text-amber-400" />
                <span className="text-[10px] sm:text-xs font-medium">מותאם</span>
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                className="group flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-emerald-600 data-[state=active]:dark:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-200/60 data-[state=active]:dark:border-emerald-700/60 transition-all duration-200"
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 group-data-[state=active]:text-emerald-600 dark:group-data-[state=active]:text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-medium">תצוגה</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            <PolicyDashboard 
              organizationId={organizationId} 
              organizationName={organizationName}
              onNavigateToTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="grades">
            <EmployeeGradesManager organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryRulesManager organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="restrictions">
            <RestrictionsManager organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="custom">
            <CustomRulesManager organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="preview">
            <PolicyPreview organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
