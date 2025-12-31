import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plane, Hotel, Utensils, Car, Calendar, MapPin, User, AlertTriangle, CheckCircle, XCircle, Clock, Send, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';

interface TravelRequest {
  id: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  nights: number;
  days: number;
  purpose: string;
  purpose_details: string | null;
  estimated_flights: number;
  estimated_flights_currency: string;
  estimated_accommodation_per_night: number;
  estimated_accommodation_currency: string;
  estimated_meals_per_day: number;
  estimated_meals_currency: string;
  estimated_transport: number;
  estimated_transport_currency: string;
  estimated_other: number;
  estimated_other_currency: string;
  estimated_total_ils: number;
  employee_notes: string | null;
  status: string;
  current_approval_level: number;
  approved_flights: number | null;
  approved_accommodation_per_night: number | null;
  approved_meals_per_day: number | null;
  approved_transport: number | null;
  approved_total_ils: number | null;
  created_at: string;
  submitted_at: string | null;
  final_decision_at: string | null;
}

interface Violation {
  id: string;
  category: string;
  requested_amount: number;
  policy_limit: number;
  overage_amount: number;
  overage_percentage: number;
  employee_explanation: string | null;
  is_resolved: boolean;
}

interface Approval {
  id: string;
  approver_id: string;
  approval_level: number;
  status: string;
  comments: string | null;
  decided_at: string | null;
  approver?: {
    full_name: string;
  };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: 'טיוטה', variant: 'outline', icon: Edit },
  pending_approval: { label: 'ממתין לאישור', variant: 'secondary', icon: Clock },
  approved: { label: 'אושר', variant: 'default', icon: CheckCircle },
  partially_approved: { label: 'אושר חלקית', variant: 'secondary', icon: AlertTriangle },
  rejected: { label: 'נדחה', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'בוטל', variant: 'outline', icon: XCircle }
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    flights: 'טיסות',
    hotels: 'לינה',
    meals: 'ארוחות',
    transport: 'תחבורה',
    ground_transport: 'תחבורה',
    other: 'אחר'
  };
  return labels[category] || category;
};

export default function TravelRequestDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingApprover, setPendingApprover] = useState<{ id: string; full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  const loadRequest = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Load request
      const { data: requestData, error: requestError } = await supabase
        .from('travel_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (requestError) throw requestError;
      setRequest(requestData);

      // Load violations
      const { data: violationsData } = await supabase
        .from('travel_request_violations')
        .select('*')
        .eq('travel_request_id', id);
      
      setViolations(violationsData || []);

      // Load approvals with approver info
      const { data: approvalsData } = await supabase
        .from('travel_request_approvals')
        .select('*')
        .eq('travel_request_id', id)
        .order('approval_level', { ascending: true });
      
      if (approvalsData && approvalsData.length > 0) {
        // Fetch approver names
        const approverIds = approvalsData.map(a => a.approver_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', approverIds);
        
        const approvalsWithNames = approvalsData.map(a => ({
          ...a,
          approver: profiles?.find(p => p.id === a.approver_id)
        }));
        
        setApprovals(approvalsWithNames);
        
        // Set pending approver for display
        const pendingApproval = approvalsData.find(a => a.status === 'pending');
        if (pendingApproval && profiles) {
          const approver = profiles.find(p => p.id === pendingApproval.approver_id);
          if (approver) {
            setPendingApprover(approver);
          }
        }
      } else if (requestData.status === 'draft') {
        // For draft requests, show who will be the approver (the user's manager)
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('manager_id')
          .eq('id', user?.id)
          .maybeSingle();
        
        if (userProfile?.manager_id) {
          const { data: managerProfile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', userProfile.manager_id)
            .maybeSingle();
          
          if (managerProfile) {
            setPendingApprover(managerProfile);
          }
        }
      }
    } catch (error) {
      console.error('Error loading request:', error);
      toast.error('שגיאה בטעינת הבקשה');
      navigate('/travel-requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!request || !user) return;

    // Check if violations have explanations
    const violationsWithoutExplanation = violations.filter(v => !v.employee_explanation);
    if (violationsWithoutExplanation.length > 0) {
      toast.error('אנא הוסף הסבר לכל החריגות לפני שליחה');
      return;
    }

    setSubmitting(true);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('travel_requests')
        .update({
          status: 'pending_approval',
          submitted_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Create approval record for manager
      const { data: profile } = await supabase
        .from('profiles')
        .select('manager_id')
        .eq('id', user.id)
        .single();

      if (profile?.manager_id) {
        await supabase
          .from('travel_request_approvals')
          .insert({
            travel_request_id: request.id,
            approver_id: profile.manager_id,
            approval_level: 1
          });
      }

      // Get manager name for toast
      if (profile?.manager_id) {
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', profile.manager_id)
          .single();
        
        toast.success(`הבקשה נשלחה לאישור ${managerProfile?.full_name || 'המנהל'}`);
      } else {
        toast.success('הבקשה נשלחה לאישור');
      }
      loadRequest();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('שגיאה בשליחת הבקשה');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">הבקשה לא נמצאה</p>
      </div>
    );
  }

  const StatusIcon = statusConfig[request.status]?.icon || Clock;
  const totalAccommodation = request.estimated_accommodation_per_night * request.nights;
  const totalMeals = request.estimated_meals_per_day * request.days;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/travel-requests')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                {request.destination_city}, {request.destination_country}
                <Badge variant={statusConfig[request.status]?.variant || 'outline'}>
                  <StatusIcon className="h-3 w-3 ml-1" />
                  {statusConfig[request.status]?.label || request.status}
                </Badge>
              </h1>
              <p className="text-muted-foreground">{request.purpose}</p>
            </div>
          </div>
          
          {request.status === 'draft' && (
            <Button onClick={handleSubmit} disabled={submitting}>
              <Send className="h-4 w-4 ml-2" />
              שלח לאישור
            </Button>
          )}
        </div>

        {/* Pending Approver Info */}
        {pendingApprover && (request.status === 'draft' || request.status === 'pending_approval') && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {request.status === 'draft' ? 'הבקשה תישלח לאישור של:' : 'ממתין לאישור מ:'}
                  </p>
                  <p className="font-medium text-foreground">{pendingApprover.full_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              פרטי הנסיעה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">יעד</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {request.destination_city}, {request.destination_country}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">תאריכים</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(request.start_date), 'd MMM', { locale: he })} - {format(new Date(request.end_date), 'd MMM yyyy', { locale: he })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">משך</p>
                <p className="font-medium">{request.nights} לילות, {request.days} ימים</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">נוצר</p>
                <p className="font-medium">{format(new Date(request.created_at), 'dd/MM/yyyy', { locale: he })}</p>
              </div>
            </div>

            {request.purpose_details && (
              <div>
                <p className="text-sm text-muted-foreground">פרטים נוספים</p>
                <p className="text-sm">{request.purpose_details}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader>
            <CardTitle>תקציב מבוקש</CardTitle>
            <CardDescription>פירוט העלויות המשוערות</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Flights */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Plane className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">טיסות</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{request.estimated_flights} {request.estimated_flights_currency}</p>
                  {request.approved_flights !== null && (
                    <p className="text-sm text-green-600">מאושר: {request.approved_flights}</p>
                  )}
                </div>
              </div>
              <Separator />

              {/* Accommodation */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Hotel className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">לינה</p>
                    <p className="text-sm text-muted-foreground">
                      {request.estimated_accommodation_per_night} × {request.nights} לילות
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{totalAccommodation} {request.estimated_accommodation_currency}</p>
                  {request.approved_accommodation_per_night !== null && (
                    <p className="text-sm text-green-600">
                      מאושר: {request.approved_accommodation_per_night * request.nights}
                    </p>
                  )}
                </div>
              </div>
              <Separator />

              {/* Meals */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Utensils className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">ארוחות</p>
                    <p className="text-sm text-muted-foreground">
                      {request.estimated_meals_per_day} × {request.days} ימים
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{totalMeals} {request.estimated_meals_currency}</p>
                  {request.approved_meals_per_day !== null && (
                    <p className="text-sm text-green-600">
                      מאושר: {request.approved_meals_per_day * request.days}
                    </p>
                  )}
                </div>
              </div>
              <Separator />

              {/* Transport */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">תחבורה</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{request.estimated_transport} {request.estimated_transport_currency}</p>
                  {request.approved_transport !== null && (
                    <p className="text-sm text-green-600">מאושר: {request.approved_transport}</p>
                  )}
                </div>
              </div>

              {request.estimated_other > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">הוצאות אחרות</p>
                    </div>
                    <p className="font-medium">{request.estimated_other} {request.estimated_other_currency}</p>
                  </div>
                </>
              )}

              {/* Total */}
              <Separator />
              <div className="flex items-center justify-between py-2 text-lg font-semibold">
                <span>סה"כ</span>
                <div className="text-right">
                  <span>${request.estimated_total_ils?.toLocaleString()}</span>
                  {request.approved_total_ils !== null && (
                    <p className="text-sm font-normal text-green-600">
                      מאושר: ${request.approved_total_ils?.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Violations */}
        {violations.length > 0 && (
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                חריגות מהמדיניות ({violations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {violations.map((violation) => (
                <div key={violation.id} className="p-4 bg-warning/10 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{getCategoryLabel(violation.category)}</span>
                    <Badge variant="outline" className="text-warning border-warning">
                      +{violation.overage_percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>ביקשת: {violation.requested_amount} | מותר: {violation.policy_limit}</p>
                    <p>חריגה: {violation.overage_amount}</p>
                  </div>
                  {violation.employee_explanation && (
                    <div className="text-sm bg-background p-2 rounded">
                      <p className="font-medium text-xs text-muted-foreground mb-1">הסבר:</p>
                      <p>{violation.employee_explanation}</p>
                    </div>
                  )}
                  {violation.is_resolved && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 ml-1" />
                      טופל
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Approval Timeline */}
        {approvals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                שרשרת אישורים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approvals.map((approval, index) => (
                  <div key={approval.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        approval.status === 'approved' ? 'bg-green-100 text-green-600' :
                        approval.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {approval.status === 'approved' ? <CheckCircle className="h-4 w-4" /> :
                         approval.status === 'rejected' ? <XCircle className="h-4 w-4" /> :
                         <Clock className="h-4 w-4" />}
                      </div>
                      {index < approvals.length - 1 && (
                        <div className="w-0.5 h-8 bg-muted mt-2" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{approval.approver?.full_name || 'מאשר'}</p>
                        <Badge variant="outline" className="text-xs">
                          רמה {approval.approval_level}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {approval.status === 'pending' ? 'ממתין לאישור' :
                         approval.status === 'approved' ? 'אישר' :
                         approval.status === 'rejected' ? 'דחה' : approval.status}
                      </p>
                      {approval.decided_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(approval.decided_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </p>
                      )}
                      {approval.comments && (
                        <p className="text-sm mt-2 p-2 bg-muted rounded">{approval.comments}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Notes */}
        {request.employee_notes && (
          <Card>
            <CardHeader>
              <CardTitle>הערות העובד</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{request.employee_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
