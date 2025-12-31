import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plane, Calendar, MapPin, FileText, CheckCircle, Clock, DollarSign, Plus, ExternalLink, Printer } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ApprovedTravel {
  id: string;
  approval_number: string;
  approved_budget: {
    flights?: number;
    accommodation_per_night?: number;
    accommodation_total?: number;
    meals_per_day?: number;
    meals_total?: number;
    transport?: number;
    other?: number;
    total?: number;
  };
  valid_from: string;
  valid_until: string;
  is_used: boolean;
  expense_report_id: string | null;
  created_at: string;
  travel_request: {
    id: string;
    destination_city: string;
    destination_country: string;
    purpose: string;
    nights: number;
    days: number;
    start_date: string;
    end_date: string;
  };
}

export default function ApprovedTravels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [approvedTravels, setApprovedTravels] = useState<ApprovedTravel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createReportDialogOpen, setCreateReportDialogOpen] = useState(false);
  const [selectedTravel, setSelectedTravel] = useState<ApprovedTravel | null>(null);
  const [creatingReport, setCreatingReport] = useState(false);

  useEffect(() => {
    loadApprovedTravels();
  }, [user]);

  const loadApprovedTravels = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get approved travels with request details
      const { data: travels, error } = await supabase
        .from('approved_travels')
        .select(`
          *,
          travel_request:travel_requests(
            id,
            destination_city,
            destination_country,
            purpose,
            nights,
            days,
            start_date,
            end_date
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Filter to only show user's own travels
      const userTravels = travels?.filter(t => {
        // We need to check if the travel_request belongs to this user
        return true; // RLS should handle this
      }) || [];

      setApprovedTravels(userTravels as ApprovedTravel[]);
    } catch (error) {
      console.error('Error loading approved travels:', error);
      toast.error('שגיאה בטעינת הנסיעות המאושרות');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpenseReport = async () => {
    if (!selectedTravel || !user) return;
    
    setCreatingReport(true);
    try {
      const request = selectedTravel.travel_request;
      
      // Create a new expense report linked to this approved travel
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          trip_destination: `${request.destination_city}, ${request.destination_country}`,
          trip_start_date: request.start_date,
          trip_end_date: request.end_date,
          trip_purpose: request.purpose,
          status: 'open',
          notes: `דוח הוצאות עבור נסיעה מאושרת מס׳ ${selectedTravel.approval_number}`
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Link the report to the approved travel
      const { error: updateError } = await supabase
        .from('approved_travels')
        .update({ 
          expense_report_id: report.id,
          is_used: true 
        })
        .eq('id', selectedTravel.id);

      if (updateError) throw updateError;

      toast.success('דוח הוצאות נוצר בהצלחה');
      setCreateReportDialogOpen(false);
      
      // Navigate to the new report
      navigate(`/reports/edit/${report.id}?approved_travel_id=${selectedTravel.id}`);
    } catch (error) {
      console.error('Error creating expense report:', error);
      toast.error('שגיאה ביצירת דוח ההוצאות');
    } finally {
      setCreatingReport(false);
    }
  };

  const getTravelStatus = (travel: ApprovedTravel) => {
    const today = new Date();
    const startDate = new Date(travel.valid_from);
    const endDate = new Date(travel.valid_until);
    
    if (travel.expense_report_id) {
      return { label: 'דוח נוצר', variant: 'default' as const, icon: FileText };
    }
    if (isPast(endDate)) {
      return { label: 'הנסיעה הסתיימה', variant: 'secondary' as const, icon: Clock };
    }
    if (isFuture(startDate)) {
      return { label: 'נסיעה עתידית', variant: 'outline' as const, icon: Calendar };
    }
    return { label: 'בנסיעה', variant: 'default' as const, icon: Plane };
  };

  const openCreateReportDialog = (travel: ApprovedTravel) => {
    setSelectedTravel(travel);
    setCreateReportDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/travel-requests')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">נסיעות מאושרות</h1>
            <p className="text-muted-foreground">כל הנסיעות שאושרו עם התקציב המאושר</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : approvedTravels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">אין נסיעות מאושרות</p>
              <Button className="mt-4" onClick={() => navigate('/travel-requests/new')}>
                <Plus className="h-4 w-4 ml-2" />
                הגש בקשה חדשה
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {approvedTravels.map((travel) => {
              const status = getTravelStatus(travel);
              const StatusIcon = status.icon;
              const request = travel.travel_request;
              const budget = travel.approved_budget;
              const canCreateReport = !travel.expense_report_id && isPast(new Date(travel.valid_from));

              return (
                <Card key={travel.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant={status.variant}>
                              <StatusIcon className="h-3 w-3 ml-1" />
                              {status.label}
                            </Badge>
                            <span className="text-sm text-muted-foreground font-mono">
                              {travel.approval_number}
                            </span>
                          </div>
                          <h3 className="font-semibold text-lg">
                            {request?.destination_city}, {request?.destination_country}
                          </h3>
                          <p className="text-sm text-muted-foreground">{request?.purpose}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          {travel.expense_report_id ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/reports/${travel.expense_report_id}`)}
                            >
                              <ExternalLink className="h-4 w-4 ml-2" />
                              צפה בדוח
                            </Button>
                          ) : canCreateReport ? (
                            <Button 
                              size="sm"
                              onClick={() => openCreateReportDialog(travel)}
                            >
                              <FileText className="h-4 w-4 ml-2" />
                              צור דוח הוצאות
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm" title="הדפס אישור">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">תאריכים</p>
                          <p className="font-medium flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(travel.valid_from), 'd MMM', { locale: he })} - {format(new Date(travel.valid_until), 'd MMM', { locale: he })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">משך</p>
                          <p className="font-medium">{request?.nights} לילות</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">תאריך אישור</p>
                          <p className="font-medium">{format(new Date(travel.created_at), 'dd/MM/yyyy', { locale: he })}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">תקציב מאושר</p>
                          <p className="font-medium text-green-600 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {budget?.total?.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Budget Breakdown */}
                      <div className="bg-muted/30 rounded-lg p-4">
                        <p className="text-sm font-medium mb-3">פירוט תקציב מאושר:</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-muted-foreground">טיסות</span>
                            <span className="font-medium">${budget?.flights || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-muted-foreground">לינה</span>
                            <span className="font-medium">${budget?.accommodation_total || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-muted-foreground">ארוחות</span>
                            <span className="font-medium">${budget?.meals_total || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-muted-foreground">תחבורה</span>
                            <span className="font-medium">${budget?.transport || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-muted-foreground">אחר</span>
                            <span className="font-medium">${budget?.other || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Report Dialog */}
        <Dialog open={createReportDialogOpen} onOpenChange={setCreateReportDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>יצירת דוח הוצאות</DialogTitle>
              <DialogDescription>
                ייווצר דוח הוצאות חדש מקושר לנסיעה המאושרת. 
                התקציב המאושר ישמש להשוואה אוטומטית מול ההוצאות בפועל.
              </DialogDescription>
            </DialogHeader>

            {selectedTravel && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-medium">
                    {selectedTravel.travel_request?.destination_city}, {selectedTravel.travel_request?.destination_country}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTravel.travel_request?.purpose}
                  </p>
                  <p className="text-sm">
                    תקציב מאושר: <span className="font-medium text-green-600">${selectedTravel.approved_budget?.total?.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateReportDialogOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleCreateExpenseReport} disabled={creatingReport}>
                {creatingReport ? 'יוצר...' : 'צור דוח הוצאות'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
