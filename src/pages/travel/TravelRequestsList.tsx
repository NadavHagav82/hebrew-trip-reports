import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Plane, Calendar, MapPin, Clock, Eye, Trash2, ArrowLeft } from 'lucide-react';
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
      // Delete related records first
      await supabase
        .from('notifications')
        .delete()
        .eq('travel_request_id', requestToDelete);
      
      await supabase
        .from('travel_request_approvals')
        .delete()
        .eq('travel_request_id', requestToDelete);
      
      await supabase
        .from('travel_request_violations')
        .delete()
        .eq('travel_request_id', requestToDelete);
      
      await supabase
        .from('travel_request_attachments')
        .delete()
        .eq('travel_request_id', requestToDelete);

      // Now delete the travel request
      const { error } = await supabase
        .from('travel_requests')
        .delete()
        .eq('id', requestToDelete);
      
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">בקשות נסיעה</h1>
              <p className="text-muted-foreground">ניהול בקשות אישור נסיעה עתידיות</p>
            </div>
          </div>
          <Button onClick={() => navigate('/travel-requests/new')}>
            <Plus className="h-4 w-4 ml-2" />
            בקשה חדשה
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">הכל ({requests.length})</TabsTrigger>
            <TabsTrigger value="pending">ממתינות ({requests.filter(r => r.status === 'pending_approval').length})</TabsTrigger>
            <TabsTrigger value="approved">מאושרות ({requests.filter(r => r.status === 'approved' || r.status === 'partially_approved').length})</TabsTrigger>
            <TabsTrigger value="draft">טיוטות ({requests.filter(r => r.status === 'draft').length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">אין בקשות נסיעה</p>
                  <Button className="mt-4" onClick={() => navigate('/travel-requests/new')}>
                    <Plus className="h-4 w-4 ml-2" />
                    צור בקשה חדשה
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <Badge variant={statusConfig[request.status]?.variant || 'outline'}>
                              {statusConfig[request.status]?.label || request.status}
                            </Badge>
                            <h3 className="font-semibold text-lg">
                              {request.destination_city}, {request.destination_country}
                            </h3>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(request.start_date), 'd MMM', { locale: he })} - {format(new Date(request.end_date), 'd MMM yyyy', { locale: he })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {request.nights} לילות
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {request.purpose}
                            </span>
                          </div>

                          <div className="text-sm">
                            <span className="font-medium">תקציב משוער: </span>
                            <span>${request.estimated_total_ils?.toLocaleString()}</span>
                          </div>

                          {request.submitted_at && (
                            <p className="text-xs text-muted-foreground">
                              הוגש: {format(new Date(request.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/travel-requests/${request.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {['draft', 'pending_approval', 'rejected', 'cancelled'].includes(request.status) && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setRequestToDelete(request.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>האם למחוק את הבקשה?</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו לא ניתנת לביטול. הבקשה תימחק לצמיתות.
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
    </div>
  );
}
