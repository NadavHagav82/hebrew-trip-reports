import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Plane, Calendar, Clock, Eye, Trash2, ArrowLeft, MapPin, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TravelRequest {
  id: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  nights: number;
  days: number;
  purpose: string;
  estimated_total_ils: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'טיוטה', variant: 'outline' },
  pending_approval: { label: 'ממתין לאישור', variant: 'secondary' },
  approved: { label: 'אושר', variant: 'default' },
  partially_approved: { label: 'אושר חלקית', variant: 'secondary' },
  rejected: { label: 'נדחה', variant: 'destructive' },
  cancelled: { label: 'בוטל', variant: 'outline' }
};

export default function TravelRequestsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_requests')
        .select('*')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('שגיאה בטעינת הבקשות');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;
    try {
      await supabase.from('notifications').delete().eq('travel_request_id', requestToDelete);
      await supabase.from('travel_request_approvals').delete().eq('travel_request_id', requestToDelete);
      await supabase.from('travel_request_violations').delete().eq('travel_request_id', requestToDelete);
      await supabase.from('travel_request_attachments').delete().eq('travel_request_id', requestToDelete);
      const { error } = await supabase.from('travel_requests').delete().eq('id', requestToDelete);
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== requestToDelete));
      toast.success('הבקשה נמחקה');
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('שגיאה במחיקת הבקשה');
    } finally {
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'pending_approval';
    if (activeTab === 'approved') return r.status === 'approved' || r.status === 'partially_approved';
    if (activeTab === 'draft') return r.status === 'draft';
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending_approval').length;
  const approvedCount = requests.filter(r => r.status === 'approved' || r.status === 'partially_approved').length;
  const draftCount = requests.filter(r => r.status === 'draft').length;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-l from-primary/90 to-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-10 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-2 right-20 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/dashboard')}
                className="text-primary-foreground hover:bg-white/20 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground flex items-center gap-3">
                  <Plane className="h-7 w-7" />
                  בקשות נסיעה
                </h1>
                <p className="text-primary-foreground/80 mt-1 text-sm md:text-base">ניהול בקשות אישור נסיעה עתידיות</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/travel-requests/new')}
              className="bg-white/20 hover:bg-white/30 text-primary-foreground border border-white/30 backdrop-blur-sm"
            >
              <Plus className="h-4 w-4 ml-2" />
              בקשה חדשה
            </Button>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'סה״כ בקשות', value: requests.length, icon: TrendingUp },
              { label: 'ממתינות לאישור', value: pendingCount, icon: Clock },
              { label: 'מאושרות', value: approvedCount, icon: Plane },
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 text-center border border-white/10">
                <stat.icon className="h-5 w-5 text-primary-foreground/70 mx-auto mb-1" />
                <p className="text-2xl font-bold text-primary-foreground">{stat.value}</p>
                <p className="text-xs text-primary-foreground/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">הכל ({requests.length})</TabsTrigger>
            <TabsTrigger value="pending">ממתינות ({pendingCount})</TabsTrigger>
            <TabsTrigger value="approved">מאושרות ({approvedCount})</TabsTrigger>
            <TabsTrigger value="draft">טיוטות ({draftCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card className="border-0 shadow-lg bg-card">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <Plane className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">אין בקשות נסיעה</h3>
                  <p className="text-muted-foreground mb-6 text-sm">צור בקשת נסיעה חדשה כדי להתחיל</p>
                  <Button onClick={() => navigate('/travel-requests/new')} className="shadow-md">
                    <Plus className="h-4 w-4 ml-2" />
                    צור בקשה חדשה
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map((request) => (
                  <Card 
                    key={request.id} 
                    className="border-0 shadow-md hover:shadow-lg transition-all duration-200 bg-card group cursor-pointer"
                    onClick={() => navigate(`/travel-requests/${request.id}`)}
                  >
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Color accent bar */}
                        <div className={`w-1.5 rounded-r-lg shrink-0 ${
                          request.status === 'approved' ? 'bg-primary' :
                          request.status === 'pending_approval' ? 'bg-amber-500' :
                          request.status === 'rejected' ? 'bg-destructive' :
                          request.status === 'partially_approved' ? 'bg-primary/60' :
                          'bg-muted-foreground/30'
                        }`} />
                        
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-bold text-lg text-foreground">
                                  {request.destination_city}, {request.destination_country}
                                </h3>
                                <Badge variant={statusConfig[request.status]?.variant || 'outline'}>
                                  {statusConfig[request.status]?.label || request.status}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4 text-primary/60" />
                                  {format(new Date(request.start_date), 'd MMM', { locale: he })} - {format(new Date(request.end_date), 'd MMM yyyy', { locale: he })}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4 text-primary/60" />
                                  {request.nights} לילות
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="h-4 w-4 text-primary/60" />
                                  {request.purpose}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="bg-accent/40 rounded-lg px-3 py-1.5 inline-block">
                                  <span className="text-xs text-muted-foreground">תקציב משוער: </span>
                                  <span className="font-bold text-foreground">${request.estimated_total_ils?.toLocaleString()}</span>
                                </div>
                                {request.submitted_at && (
                                  <p className="text-xs text-muted-foreground">
                                    הוגש: {format(new Date(request.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="h-9 w-9 rounded-full border-border/60"
                                onClick={() => navigate(`/travel-requests/${request.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="h-9 w-9 rounded-full border-border/60 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setRequestToDelete(request.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את הבקשה?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">פעולה זו לא ניתנת לביטול. הבקשה תימחק לצמיתות.</span>
              {requestToDelete && requests.find(r => r.id === requestToDelete)?.status === 'approved' && (
                <span className="block text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ שים לב: בקשה זו כבר אושרה. מחיקתה תגרום לאובדן האישור לצמיתות!
                </span>
              )}
              {requestToDelete && requests.find(r => r.id === requestToDelete)?.status === 'partially_approved' && (
                <span className="block text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ שים לב: בקשה זו אושרה חלקית. מחיקתה תגרום לאובדן האישור לצמיתות!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
