import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Save, Mail, IdCard, Pencil } from 'lucide-react';

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

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : '?';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="הפרופיל שלי" className="w-9 h-9">
          <User className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden" dir="rtl">
        {/* Hero header */}
        <div className="bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500 px-6 pt-8 pb-12 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5" />
              הפרופיל שלי
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Avatar overlapping header */}
        <div className="flex justify-center -mt-8 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-card border-4 border-background shadow-lg flex items-center justify-center">
            <span className="text-xl font-bold text-primary">{initials}</span>
          </div>
        </div>

        {profile && (
          <div className="px-6 pb-6 pt-3 space-y-5">
            {/* Read-only info cards */}
            <div className="rounded-xl border bg-muted/30 divide-y divide-border/50">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">אימייל</p>
                  <p className="text-sm font-medium truncate">{profile.email || user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IdCard className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">שם משתמש</p>
                  <p className="text-sm font-medium truncate">{profile.username}</p>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">פרטים לעריכה</span>
              </div>
              <div>
                <Label htmlFor="full_name" className="text-xs">שם מלא</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="mt-1.5 h-11"
                />
              </div>
              <div>
                <Label htmlFor="department" className="text-xs">מחלקה / תיאור</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="mt-1.5 h-11"
                />
              </div>
              <div>
                <Label htmlFor="employee_id" className="text-xs">מספר עובד (אופציונלי)</Label>
                <Input
                  id="employee_id"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="mt-1.5 h-11"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading || !form.full_name.trim()}
              className="w-full gap-2 h-12 text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30"
            >
              <Save className="w-4 h-4" />
              {loading ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
