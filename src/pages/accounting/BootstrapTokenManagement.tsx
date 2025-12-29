import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Loader2, ArrowRight, Copy, Check, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BootstrapToken {
  id: string;
  token: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  notes: string | null;
  user_profile?: {
    full_name: string;
    email: string;
    username: string;
    department: string;
  } | null;
}

export default function BootstrapTokenManagement() {
  const [tokens, setTokens] = useState<BootstrapToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newTokenData, setNewTokenData] = useState({
    notes: '',
    expiryDays: '7'
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadTokens();
  }, [user]);

  const loadTokens = async () => {
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('bootstrap_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      // For each used token, fetch user profile
      const tokensWithProfiles = await Promise.all(
        (tokensData || []).map(async (token) => {
          if (token.used_by) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email, username, department')
              .eq('id', token.used_by)
              .single();

            return {
              ...token,
              user_profile: profileData
            };
          }
          return token;
        })
      );

      setTokens(tokensWithProfiles);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון קודי הזמנה",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Token is now generated server-side for security

  const handleCreateToken = async () => {
    if (!newTokenData.expiryDays || parseInt(newTokenData.expiryDays) < 1) {
      toast({
        title: "שגיאה",
        description: "יש להזין מספר ימים תקין",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-token', {
        body: {
          action: 'create',
          notes: newTokenData.notes.trim() || null,
          expiryDays: parseInt(newTokenData.expiryDays),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Show the plain token to the user (only time it's visible)
      toast({
        title: "קוד נוצר בהצלחה!",
        description: `הקוד: ${data.token} - העתק אותו עכשיו כי הוא לא יוצג שוב!`,
        duration: 15000,
      });

      // Copy to clipboard automatically
      navigator.clipboard.writeText(data.token);
      setCopiedToken(data.token);

      // Reset form and reload
      setNewTokenData({ notes: '', expiryDays: '7' });
      setDialogOpen(false);
      loadTokens();

    } catch (error) {
      console.error('Error creating token:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור קוד חדש",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    toast({
      title: "הועתק ללוח",
      description: "הקוד הועתק בהצלחה",
    });
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (token: BootstrapToken) => {
    if (token.is_used) {
      return <Badge variant="secondary">נוצל</Badge>;
    }
    
    const isExpired = new Date(token.expires_at) < new Date();
    if (isExpired) {
      return <Badge variant="destructive">פג תוקף</Badge>;
    }
    
    return <Badge className="bg-green-500 hover:bg-green-600">פעיל</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">ניהול קודי הזמנה</h1>
                <p className="text-sm text-muted-foreground">קודי הקמה למנהלי חשבונות</p>
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
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ קודים</p>
                  <p className="text-3xl font-bold">{tokens.length}</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">קודים פעילים</p>
                  <p className="text-3xl font-bold text-green-600">
                    {tokens.filter(t => !t.is_used && new Date(t.expires_at) > new Date()).length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">קודים מנוצלים</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {tokens.filter(t => t.is_used).length}
                  </p>
                </div>
                <User className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">פג תוקף</p>
                  <p className="text-3xl font-bold text-red-600">
                    {tokens.filter(t => !t.is_used && new Date(t.expires_at) < new Date()).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Token Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>יצירת קוד חדש</CardTitle>
            <CardDescription>
              צור קוד הקמה חדש למנהל חשבונות נוסף
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 ml-2" />
                  צור קוד חדש
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>יצירת קוד הקמה חדש</DialogTitle>
                  <DialogDescription>
                    הקוד ייווצר אוטומטית ויישלח למנהל החשבונות החדש
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDays">תוקף בימים *</Label>
                    <Input
                      id="expiryDays"
                      type="number"
                      min="1"
                      max="365"
                      value={newTokenData.expiryDays}
                      onChange={(e) => setNewTokenData(prev => ({ ...prev, expiryDays: e.target.value }))}
                      placeholder="7"
                    />
                    <p className="text-xs text-muted-foreground">
                      כמה ימים הקוד יהיה תקף (ברירת מחדל: 7 ימים)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">הערות (אופציונלי)</Label>
                    <Textarea
                      id="notes"
                      value={newTokenData.notes}
                      onChange={(e) => setNewTokenData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="למשל: קוד למנהל חשבונות חדש במחלקת כספים"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button onClick={handleCreateToken} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        יוצר קוד...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 ml-2" />
                        צור קוד
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Tokens Table */}
        <Card>
          <CardHeader>
            <CardTitle>לוג קודי הזמנה</CardTitle>
            <CardDescription>
              היסטוריה מלאה של כל קודי ההקמה במערכת
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין קודי הזמנה</h3>
                <p className="text-muted-foreground mb-4">
                  עדיין לא נוצרו קודי הזמנה במערכת
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  צור את הקוד הראשון
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מזהה קוד</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תאריך יצירה</TableHead>
                      <TableHead>תוקף עד</TableHead>
                      <TableHead>נוצל על ידי</TableHead>
                      <TableHead>תאריך שימוש</TableHead>
                      <TableHead>הערות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell>
                          <div className="font-mono text-sm font-semibold text-muted-foreground">
                            {/* Token is hashed - show partial hash for reference */}
                            {token.token.substring(0, 8)}...{token.token.substring(token.token.length - 8)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            (מוצפן - הטוקן המקורי הוצג בזמן היצירה בלבד)
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(token)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(token.created_at), 'dd/MM/yyyy', { locale: he })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(token.created_at), 'HH:mm', { locale: he })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(token.expires_at), 'dd/MM/yyyy', { locale: he })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {token.user_profile ? (
                            <div>
                              <div className="font-medium">{token.user_profile.full_name}</div>
                              <div className="text-xs text-muted-foreground">{token.user_profile.email}</div>
                              <div className="text-xs text-muted-foreground">{token.user_profile.department}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {token.used_at ? (
                            <div className="text-sm">
                              {format(new Date(token.used_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate">
                            {token.notes || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}