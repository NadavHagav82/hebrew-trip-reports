import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ExpenseTemplatesManager from "@/components/ExpenseTemplatesManager";

export default function ExpenseTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAccountingManager, setIsAccountingManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccountingManagerStatus();
  }, [user]);

  const checkAccountingManagerStatus = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "accounting_manager");

      if (!roles || roles.length === 0) {
        toast({
          title: "אין הרשאה",
          description: "רק מנהלי הנהלת חשבונות יכולים לגשת לדף זה",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAccountingManager(true);
    } catch (error) {
      console.error("Error checking accounting manager status:", error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!isAccountingManager) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">תבניות הוצאות</h1>
                <p className="text-sm text-muted-foreground">ניהול תבניות הוצאות מוכרות</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/accounting')}>
              חזרה לדשבורד
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ExpenseTemplatesManager />
      </main>
    </div>
  );
}
