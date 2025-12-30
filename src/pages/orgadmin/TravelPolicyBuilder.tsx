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
  Eye
} from 'lucide-react';
import { EmployeeGradesManager } from '@/components/policy/EmployeeGradesManager';
import { CategoryRulesManager } from '@/components/policy/CategoryRulesManager';
import { RestrictionsManager } from '@/components/policy/RestrictionsManager';
import { CustomRulesManager } from '@/components/policy/CustomRulesManager';
import { PolicyPreview } from '@/components/policy/PolicyPreview';

export default function TravelPolicyBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [activeTab, setActiveTab] = useState('grades');

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
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            מדיניות נסיעות - {organizationName}
          </h1>
          <p className="text-muted-foreground mt-1">
            הגדר את כללי מדיניות הנסיעות של הארגון שלך
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/orgadmin')}>
          <ArrowRight className="w-4 h-4 ml-2" />
          חזרה לדשבורד
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">מערכת מדיניות חכמה</h3>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                הגדר את החוקים והמגבלות לנסיעות עסקיות. המערכת תבדוק אוטומטית כל הוצאה ותתריע על חריגות.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="grades" className="flex flex-col sm:flex-row items-center gap-1 py-3">
            <Users className="w-4 h-4" />
            <span className="text-xs sm:text-sm">דרגות עובדים</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex flex-col sm:flex-row items-center gap-1 py-3">
            <Plane className="w-4 h-4" />
            <span className="text-xs sm:text-sm">חוקי קטגוריות</span>
          </TabsTrigger>
          <TabsTrigger value="restrictions" className="flex flex-col sm:flex-row items-center gap-1 py-3">
            <Ban className="w-4 h-4" />
            <span className="text-xs sm:text-sm">הגבלות</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex flex-col sm:flex-row items-center gap-1 py-3">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs sm:text-sm">חוקים מותאמים</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex flex-col sm:flex-row items-center gap-1 py-3">
            <Eye className="w-4 h-4" />
            <span className="text-xs sm:text-sm">תצוגה מקדימה</span>
          </TabsTrigger>
        </TabsList>

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
