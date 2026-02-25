import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Save, Mail, Building2, IdCard } from 'lucide-react';

interface Profile {
  full_name: string;
  department: string;
  email: string | null;
  employee_id: string | null;
  username: string;
}

export function IndependentProfileDialog({ onUpdate }: { onUpdate?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: '', department: '', employee_id: '' });

  useEffect(() => {
    if (open && user) {
      supabase.from('profiles')
        .select('full_name, department, email, employee_id, username')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
            setForm({
              full_name: data.full_name || '',
              department: data.department || '',
              employee_id: data.employee_id || '',
            });
          }
        });
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user || !form.full_name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      department: form.department.trim(),
      employee_id: form.employee_id.trim() || null,
    }).eq('id', user.id);
    setLoading(false);

    if (error) {
      toast({ title: 'שגיאה בעדכון הפרופיל', variant: 'destructive' });
    } else {
      toast({ title: 'הפרופיל עודכן בהצלחה' });
      onUpdate?.();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="הפרופיל שלי" className="w-9 h-9">
          <User className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            הפרופיל שלי
          </DialogTitle>
        </DialogHeader>

        {profile && (
          <div className="space-y-4 mt-2">
            {/* Read-only info */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">אימייל:</span>
                <span className="font-medium">{profile.email || user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <IdCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">שם משתמש:</span>
                <span className="font-medium">{profile.username}</span>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="full_name">שם מלא</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="department">מחלקה / תיאור</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="employee_id">מספר עובד (אופציונלי)</Label>
                <Input
                  id="employee_id"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={loading || !form.full_name.trim()} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {loading ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
