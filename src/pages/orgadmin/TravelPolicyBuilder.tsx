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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <span className="hidden sm:inline">מדיניות נסיעות - {organizationName}</span>
            <span className="sm:hidden">מדיניות נסיעות</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            הגדר את כללי מדיניות הנסיעות של הארגון שלך
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/orgadmin')} className="w-full sm:w-auto">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזרה לדשבורד
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">דשבורד</span>
          </TabsTrigger>
          <TabsTrigger value="grades" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">דרגות</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <Plane className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">קטגוריות</span>
          </TabsTrigger>
          <TabsTrigger value="restrictions" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">הגבלות</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">מותאם</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-3 px-1 sm:px-3">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">תצוגה</span>
          </TabsTrigger>
        </TabsList>

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
    </div>
  );
}
