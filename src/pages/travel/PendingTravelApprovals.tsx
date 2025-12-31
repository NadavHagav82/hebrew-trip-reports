import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plane, Hotel, Utensils, Car, Calendar, MapPin, User, AlertTriangle, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';

interface TravelRequest {
  id: string;
  organization_id: string;
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
  estimated_total_ils: number;
  employee_notes: string | null;
  status: string;
  submitted_at: string | null;
  requester?: {
    full_name: string;
    department: string;
  };
}

interface Violation {
  id: string;
  category: string;
  requested_amount: number;
  policy_limit: number;
  overage_amount: number;
  overage_percentage: number;
  employee_explanation: string | null;
}

interface PendingApproval {
  id: string;
  travel_request_id: string;
  approval_level: number;
  request?: TravelRequest;
  violations?: Violation[];
}

export default function PendingTravelApprovals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'approve_with_changes' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Modified amounts for partial approval
  const [modifiedFlights, setModifiedFlights] = useState<number | null>(null);
  const [modifiedAccommodation, setModifiedAccommodation] = useState<number | null>(null);
  const [modifiedMeals, setModifiedMeals] = useState<number | null>(null);
  const [modifiedTransport, setModifiedTransport] = useState<number | null>(null);

  useEffect(() => {
    loadPendingApprovals();
  }, [user]);

  const loadPendingApprovals = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get pending approvals for this user
      const { data: approvals, error: approvalsError } = await supabase
        .from('travel_request_approvals')
        .select('id, travel_request_id, approval_level')
        .eq('approver_id', user.id)
        .eq('status', 'pending');
      
      if (approvalsError) throw approvalsError;
      
      if (!approvals || approvals.length === 0) {
        setPendingApprovals([]);
        setLoading(false);
        return;
      }

      // Get request details for each approval
      const requestIds = approvals.map(a => a.travel_request_id);
      
      const { data: requests } = await supabase
        .from('travel_requests')
        .select('*')
        .in('id', requestIds);
      
      // Get requester profiles
      if (requests) {
        const requesterIds = requests.map(r => r.requested_by);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, department')
          .in('id', requesterIds);

        // Get violations for each request
        const { data: violations } = await supabase
          .from('travel_request_violations')
          .select('*')
          .in('travel_request_id', requestIds);

        const enrichedApprovals = approvals.map(approval => {
          const request = requests.find(r => r.id === approval.travel_request_id);
          const requester = request ? profiles?.find(p => p.id === request.requested_by) : null;
          const requestViolations = violations?.filter(v => v.travel_request_id === approval.travel_request_id) || [];
          
          return {
            ...approval,
            request: request ? {
              ...request,
              requester
            } : undefined,
            violations: requestViolations
          };
        });

        setPendingApprovals(enrichedApprovals);
      }
    } catch (error) {
      console.error('Error loading pending approvals:', error);
      toast.error('שגיאה בטעינת הבקשות');
    } finally {
      setLoading(false);
    }
  };

  const openApprovalDialog = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setDecision('approve');
    setComments('');
    setModifiedFlights(null);
    setModifiedAccommodation(null);
    setModifiedMeals(null);
    setModifiedTransport(null);
    setDialogOpen(true);
  };

  const handleApprovalDecision = async () => {
    if (!selectedApproval || !user) return;
    
    setSubmitting(true);
    try {
      const request = selectedApproval.request;
      if (!request) throw new Error('Request not found');

      // Update approval record
      const approvalUpdate: any = {
        status: decision === 'reject' ? 'rejected' : 'approved',
        comments: comments || null,
        decided_at: new Date().toISOString()
      };

      if (decision === 'approve_with_changes') {
        approvalUpdate.approved_flights = modifiedFlights ?? request.estimated_flights;
        approvalUpdate.approved_accommodation_per_night = modifiedAccommodation ?? request.estimated_accommodation_per_night;
        approvalUpdate.approved_meals_per_day = modifiedMeals ?? request.estimated_meals_per_day;
        approvalUpdate.approved_transport = modifiedTransport ?? request.estimated_transport;
      }

      const { error: approvalError } = await supabase
        .from('travel_request_approvals')
        .update(approvalUpdate)
        .eq('id', selectedApproval.id);

      if (approvalError) throw approvalError;

      // Update request status
      let newStatus = request.status;
      let requestUpdate: any = {};

      if (decision === 'reject') {
        newStatus = 'rejected';
      } else {
        // Check if there are violations requiring additional approval levels
        const hasSignificantViolations = selectedApproval.violations?.some(v => v.overage_percentage > 30);
        
        if (hasSignificantViolations && selectedApproval.approval_level < 3) {
          // Need additional approval - keep as pending
          // TODO: Add next level approver
          newStatus = 'pending_approval';
        } else {
          // Final approval
          newStatus = decision === 'approve_with_changes' ? 'partially_approved' : 'approved';
          
          // Set approved amounts
          requestUpdate = {
            approved_flights: decision === 'approve' ? request.estimated_flights : (modifiedFlights ?? request.estimated_flights),
            approved_accommodation_per_night: decision === 'approve' ? request.estimated_accommodation_per_night : (modifiedAccommodation ?? request.estimated_accommodation_per_night),
            approved_meals_per_day: decision === 'approve' ? request.estimated_meals_per_day : (modifiedMeals ?? request.estimated_meals_per_day),
            approved_transport: decision === 'approve' ? request.estimated_transport : (modifiedTransport ?? request.estimated_transport),
            final_decision_at: new Date().toISOString()
          };

          // Calculate approved total
          const approvedTotal = 
            (requestUpdate.approved_flights || 0) + 
            ((requestUpdate.approved_accommodation_per_night || 0) * request.nights) +
            ((requestUpdate.approved_meals_per_day || 0) * request.days) +
            (requestUpdate.approved_transport || 0) +
            (request.estimated_other || 0);
          
          requestUpdate.approved_total_ils = approvedTotal;

          // Create approved travel document
          const { data: approvalNumber } = await supabase.rpc('generate_travel_approval_number');
          
          await supabase
            .from('approved_travels')
            .insert({
              travel_request_id: request.id,
              organization_id: request.organization_id,
              approval_number: approvalNumber,
              approved_budget: {
                flights: requestUpdate.approved_flights,
                accommodation_per_night: requestUpdate.approved_accommodation_per_night,
                accommodation_total: requestUpdate.approved_accommodation_per_night * request.nights,
                meals_per_day: requestUpdate.approved_meals_per_day,
                meals_total: requestUpdate.approved_meals_per_day * request.days,
                transport: requestUpdate.approved_transport,
                other: request.estimated_other,
                total: approvedTotal
              },
              valid_from: request.start_date,
              valid_until: request.end_date
            });
        }
      }

      requestUpdate.status = newStatus;
      
      const { error: requestError } = await supabase
        .from('travel_requests')
        .update(requestUpdate)
        .eq('id', request.id);

      if (requestError) throw requestError;

      // Send notification to employee
      try {
        const { data: requestedByProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', (selectedApproval.request as any).requested_by)
          .maybeSingle();
        
        if (requestedByProfile) {
          const notificationTitle = decision === 'reject' 
            ? 'בקשת הנסיעה נדחתה' 
            : decision === 'approve_with_changes' 
              ? 'בקשת הנסיעה אושרה עם שינויים'
              : 'בקשת הנסיעה אושרה';
          
          const notificationMessage = `בקשת הנסיעה שלך ל-${request.destination_city}, ${request.destination_country} ${decision === 'reject' ? 'נדחתה' : 'אושרה'}${comments ? `. הערה: ${comments}` : ''}`;
          
          await supabase
            .from('notifications')
            .insert({
              user_id: requestedByProfile.id,
              title: notificationTitle,
              message: notificationMessage,
              type: decision === 'reject' ? 'travel_rejected' : 'travel_approved'
            });
        }
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
        // Don't fail the approval if notification fails
      }

      toast.success(
        decision === 'reject' ? 'הבקשה נדחתה' :
        decision === 'approve_with_changes' ? 'הבקשה אושרה עם שינויים' :
        'הבקשה אושרה'
      );

      setDialogOpen(false);
      loadPendingApprovals();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('שגיאה בעיבוד ההחלטה');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      flights: 'טיסות',
      hotels: 'לינה',
      meals: 'ארוחות',
      transport: 'תחבורה'
    };
    return labels[category] || category;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">בקשות נסיעה ממתינות לאישור</h1>
            <p className="text-muted-foreground">בקשות שמחכות להחלטתך</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : pendingApprovals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">אין בקשות ממתינות לאישורך</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingApprovals.map((approval) => {
              const request = approval.request;
              if (!request) return null;

              const totalAccommodation = request.estimated_accommodation_per_night * request.nights;
              const totalMeals = request.estimated_meals_per_day * request.days;
              const hasViolations = approval.violations && approval.violations.length > 0;

              return (
                <Card key={approval.id} className={`hover:shadow-md transition-shadow ${hasViolations ? 'border-warning' : ''}`}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              {request.destination_city}, {request.destination_country}
                            </h3>
                            {hasViolations && (
                              <Badge variant="outline" className="text-warning border-warning">
                                <AlertTriangle className="h-3 w-3 ml-1" />
                                {approval.violations?.length} חריגות
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{request.requester?.full_name}</span>
                            {request.requester?.department && (
                              <>
                                <span>•</span>
                                <span>{request.requester.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button onClick={() => openApprovalDialog(approval)}>
                          <FileText className="h-4 w-4 ml-2" />
                          עבור לאישור
                        </Button>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">תאריכים</p>
                          <p className="font-medium">
                            {format(new Date(request.start_date), 'd MMM', { locale: he })} - {format(new Date(request.end_date), 'd MMM', { locale: he })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">משך</p>
                          <p className="font-medium">{request.nights} לילות</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">מטרה</p>
                          <p className="font-medium">{request.purpose}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">תקציב מבוקש</p>
                          <p className="font-medium">${request.estimated_total_ils?.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Violations Preview */}
                      {hasViolations && (
                        <div className="bg-warning/10 p-3 rounded-lg">
                          <p className="text-sm font-medium text-warning mb-2">חריגות מהמדיניות:</p>
                          <div className="flex flex-wrap gap-2">
                            {approval.violations?.map((v) => (
                              <Badge key={v.id} variant="outline" className="text-xs">
                                {getCategoryLabel(v.category)}: +{v.overage_percentage.toFixed(0)}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Approval Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                אישור בקשת נסיעה
              </DialogTitle>
              <DialogDescription>
                {selectedApproval?.request?.destination_city}, {selectedApproval?.request?.destination_country}
              </DialogDescription>
            </DialogHeader>

            {selectedApproval?.request && (
              <div className="space-y-6">
                {/* Request Summary */}
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedApproval.request.requester?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(selectedApproval.request.start_date), 'd MMM', { locale: he })} - {format(new Date(selectedApproval.request.end_date), 'd MMM yyyy', { locale: he })}
                      ({selectedApproval.request.nights} לילות)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedApproval.request.purpose}</span>
                  </div>
                </div>

                {/* Budget Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">תקציב מבוקש:</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="flex items-center gap-2"><Plane className="h-4 w-4" /> טיסות</span>
                      <span className="font-medium">${selectedApproval.request.estimated_flights}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="flex items-center gap-2"><Hotel className="h-4 w-4" /> לינה</span>
                      <span className="font-medium">${selectedApproval.request.estimated_accommodation_per_night * selectedApproval.request.nights}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="flex items-center gap-2"><Utensils className="h-4 w-4" /> ארוחות</span>
                      <span className="font-medium">${selectedApproval.request.estimated_meals_per_day * selectedApproval.request.days}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="flex items-center gap-2"><Car className="h-4 w-4" /> תחבורה</span>
                      <span className="font-medium">${selectedApproval.request.estimated_transport}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded font-medium">
                    <span>סה"כ</span>
                    <span>${selectedApproval.request.estimated_total_ils?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Violations */}
                {selectedApproval.violations && selectedApproval.violations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-warning flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      חריגות מהמדיניות
                    </h4>
                    {selectedApproval.violations.map((violation) => (
                      <div key={violation.id} className="p-3 bg-warning/10 rounded-lg text-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{getCategoryLabel(violation.category)}</span>
                          <Badge variant="outline" className="text-warning">
                            +{violation.overage_percentage.toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          ביקש: ${violation.requested_amount} | מותר: ${violation.policy_limit}
                        </p>
                        {violation.employee_explanation && (
                          <div className="bg-background p-2 rounded">
                            <p className="text-xs text-muted-foreground">הסבר העובד:</p>
                            <p>{violation.employee_explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Employee Notes */}
                {selectedApproval.request.employee_notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium">הערות העובד:</h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {selectedApproval.request.employee_notes}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Decision */}
                <div className="space-y-4">
                  <h4 className="font-medium">החלטה:</h4>
                  <RadioGroup value={decision} onValueChange={(v: any) => setDecision(v)}>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="approve" id="approve" />
                      <Label htmlFor="approve" className="flex items-center gap-2 cursor-pointer">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        אשר הכל
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="approve_with_changes" id="approve_with_changes" />
                      <Label htmlFor="approve_with_changes" className="flex items-center gap-2 cursor-pointer">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        אשר עם שינויים
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="reject" id="reject" />
                      <Label htmlFor="reject" className="flex items-center gap-2 cursor-pointer">
                        <XCircle className="h-4 w-4 text-destructive" />
                        דחה
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Modified Amounts (if approve with changes) */}
                {decision === 'approve_with_changes' && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">סכומים מאושרים:</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>טיסות</Label>
                        <Input
                          type="number"
                          placeholder={String(selectedApproval.request.estimated_flights)}
                          value={modifiedFlights ?? ''}
                          onChange={(e) => setModifiedFlights(e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>לינה (ללילה)</Label>
                        <Input
                          type="number"
                          placeholder={String(selectedApproval.request.estimated_accommodation_per_night)}
                          value={modifiedAccommodation ?? ''}
                          onChange={(e) => setModifiedAccommodation(e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ארוחות (ליום)</Label>
                        <Input
                          type="number"
                          placeholder={String(selectedApproval.request.estimated_meals_per_day)}
                          value={modifiedMeals ?? ''}
                          onChange={(e) => setModifiedMeals(e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>תחבורה</Label>
                        <Input
                          type="number"
                          placeholder={String(selectedApproval.request.estimated_transport)}
                          value={modifiedTransport ?? ''}
                          onChange={(e) => setModifiedTransport(e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-2">
                  <Label>הערות למבקש</Label>
                  <Textarea
                    placeholder="הוסף הערות או הסבר להחלטה..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                onClick={handleApprovalDecision}
                disabled={submitting}
                variant={decision === 'reject' ? 'destructive' : 'default'}
              >
                {submitting ? 'מעבד...' :
                 decision === 'reject' ? 'דחה בקשה' :
                 decision === 'approve_with_changes' ? 'אשר עם שינויים' :
                 'אשר בקשה'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
