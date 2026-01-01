import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Plane, Hotel, Utensils, Car, AlertTriangle, CheckCircle, Send, Save, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import TravelRequestAttachments from '@/components/TravelRequestAttachments';

interface PolicyRule {
  id: string;
  category: string;
  max_amount: number | null;
  currency: string;
  destination_type: string;
  per_type: string;
  destination_countries: string[] | null;
}

interface PolicyViolation {
  category: string;
  requestedAmount: number;
  policyLimit: number;
  overageAmount: number;
  overagePercentage: number;
}

interface Approver {
  id: string;
  full_name: string;
  department: string;
}

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

export default function NewTravelRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editRequestId = searchParams.get('edit');
  
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [defaultManagerId, setDefaultManagerId] = useState<string | null>(null);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  
  // Form state
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [purposeDetails, setPurposeDetails] = useState('');
  
  // Cost estimates
  const [estimatedFlights, setEstimatedFlights] = useState<number>(0);
  const [flightsCurrency, setFlightsCurrency] = useState('USD');
  const [accommodationPerNight, setAccommodationPerNight] = useState<number>(0);
  const [accommodationCurrency, setAccommodationCurrency] = useState('USD');
  const [mealsPerDay, setMealsPerDay] = useState<number>(0);
  const [mealsCurrency, setMealsCurrency] = useState('USD');
  const [estimatedTransport, setEstimatedTransport] = useState<number>(0);
  const [transportCurrency, setTransportCurrency] = useState('USD');
  const [estimatedOther, setEstimatedOther] = useState<number>(0);
  const [otherCurrency, setOtherCurrency] = useState('USD');
  
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [violationExplanations, setViolationExplanations] = useState<Record<string, string>>({});
  const [savedRequestId, setSavedRequestId] = useState<string | null>(editRequestId);

  // Calculate nights and days
  const nights = startDate && endDate ? Math.max(0, differenceInDays(new Date(endDate), new Date(startDate))) : 0;
  const days = nights + 1;

  // Calculate totals
  const totalAccommodation = accommodationPerNight * nights;
  const totalMeals = mealsPerDay * days;
  const estimatedTotal = estimatedFlights + totalAccommodation + totalMeals + estimatedTransport + estimatedOther;

  useEffect(() => {
    loadOrganizationAndPolicy();
    loadApprovers();
    if (editRequestId) {
      loadExistingRequest(editRequestId);
    }
  }, [user, editRequestId]);

  useEffect(() => {
    if (policyRules.length > 0) {
      checkPolicyViolations();
    }
  }, [estimatedFlights, accommodationPerNight, mealsPerDay, estimatedTransport, nights, days, policyRules, destinationCountry]);

  const loadOrganizationAndPolicy = async () => {
    if (!user) return;
    
    try {
      // Get user's organization and manager
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, manager_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);
        
        // Set default manager
        if (profile.manager_id) {
          setDefaultManagerId(profile.manager_id);
          setSelectedApproverId(profile.manager_id);
        }
        
        // Load policy rules
        const { data: rules } = await supabase
          .from('travel_policy_rules')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true);
        
        if (rules) {
          setPolicyRules(rules);
        }
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const loadApprovers = async () => {
    if (!user) return;
    
    try {
      // Load all managers in the organization
      const { data: managers } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('is_manager', true)
        .neq('id', user.id);
      
      if (managers) {
        setApprovers(managers);
      }
    } catch (error) {
      console.error('Error loading approvers:', error);
    }
  };

  const loadExistingRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('travel_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        toast.error('הבקשה לא נמצאה');
        return;
      }
      
      // Populate form with existing data
      setDestinationCity(data.destination_city);
      setDestinationCountry(data.destination_country);
      setStartDate(data.start_date);
      setEndDate(data.end_date);
      setPurpose(data.purpose);
      setPurposeDetails(data.purpose_details || '');
      setEstimatedFlights(data.estimated_flights || 0);
      setFlightsCurrency(data.estimated_flights_currency || 'USD');
      setAccommodationPerNight(data.estimated_accommodation_per_night || 0);
      setAccommodationCurrency(data.estimated_accommodation_currency || 'USD');
      setMealsPerDay(data.estimated_meals_per_day || 0);
      setMealsCurrency(data.estimated_meals_currency || 'USD');
      setEstimatedTransport(data.estimated_transport || 0);
      setTransportCurrency(data.estimated_transport_currency || 'USD');
      setEstimatedOther(data.estimated_other || 0);
      setOtherCurrency(data.estimated_other_currency || 'USD');
      setEmployeeNotes(data.employee_notes || '');
    } catch (error) {
      console.error('Error loading existing request:', error);
      toast.error('שגיאה בטעינת הבקשה');
    }
  };

  const checkPolicyViolations = () => {
    const newViolations: PolicyViolation[] = [];
    
    // Check flights
    const flightRule = policyRules.find(r => r.category === 'flights');
    if (flightRule?.max_amount && estimatedFlights > flightRule.max_amount) {
      newViolations.push({
        category: 'flights',
        requestedAmount: estimatedFlights,
        policyLimit: flightRule.max_amount,
        overageAmount: estimatedFlights - flightRule.max_amount,
        overagePercentage: ((estimatedFlights - flightRule.max_amount) / flightRule.max_amount) * 100
      });
    }
    
    // Check accommodation (per night)
    const hotelRule = policyRules.find(r => r.category === 'hotels' || r.category === 'accommodation');
    if (hotelRule?.max_amount && accommodationPerNight > hotelRule.max_amount) {
      newViolations.push({
        category: 'hotels',
        requestedAmount: accommodationPerNight,
        policyLimit: hotelRule.max_amount,
        overageAmount: accommodationPerNight - hotelRule.max_amount,
        overagePercentage: ((accommodationPerNight - hotelRule.max_amount) / hotelRule.max_amount) * 100
      });
    }
    
    // Check meals (per day)
    const mealsRule = policyRules.find(r => r.category === 'meals');
    if (mealsRule?.max_amount && mealsPerDay > mealsRule.max_amount) {
      newViolations.push({
        category: 'meals',
        requestedAmount: mealsPerDay,
        policyLimit: mealsRule.max_amount,
        overageAmount: mealsPerDay - mealsRule.max_amount,
        overagePercentage: ((mealsPerDay - mealsRule.max_amount) / mealsRule.max_amount) * 100
      });
    }
    
    // Check transport (per day)
    const transportRule = policyRules.find(r => r.category === 'transport' || r.category === 'ground_transport');
    const transportPerDay = days > 0 ? estimatedTransport / days : 0;
    if (transportRule?.max_amount && transportRule.per_type === 'per_day' && transportPerDay > transportRule.max_amount) {
      newViolations.push({
        category: 'transport',
        requestedAmount: transportPerDay,
        policyLimit: transportRule.max_amount,
        overageAmount: transportPerDay - transportRule.max_amount,
        overagePercentage: ((transportPerDay - transportRule.max_amount) / transportRule.max_amount) * 100
      });
    }
    
    setViolations(newViolations);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'flights': return <Plane className="h-4 w-4" />;
      case 'hotels': return <Hotel className="h-4 w-4" />;
      case 'meals': return <Utensils className="h-4 w-4" />;
      case 'transport': return <Car className="h-4 w-4" />;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'flights': return 'טיסות';
      case 'hotels': return 'לינה';
      case 'meals': return 'ארוחות';
      case 'transport': return 'תחבורה';
      default: return category;
    }
  };

  // Save as draft only (for attachments auto-upload) – returns requestId or null
  const saveDraftForAttachments = async (): Promise<string | null> => {
    if (!user || !organizationId) {
      toast.error('שגיאה בטעינת נתונים');
      return null;
    }

    if (!destinationCity || !destinationCountry || !startDate || !endDate || !purpose) {
      toast.error('אנא מלא את כל השדות הנדרשים (יעד, תאריכים, מטרה) לפני שמירת טיוטה');
      return null;
    }

    setLoading(true);
    try {
      if (savedRequestId) {
        // Already have an id
        return savedRequestId;
      }

      const { data: request, error: requestError } = await supabase
        .from('travel_requests')
        .insert({
          organization_id: organizationId,
          requested_by: user.id,
          destination_city: destinationCity,
          destination_country: destinationCountry,
          start_date: startDate,
          end_date: endDate,
          purpose: purpose,
          purpose_details: purposeDetails,
          estimated_flights: estimatedFlights,
          estimated_flights_currency: flightsCurrency as any,
          estimated_accommodation_per_night: accommodationPerNight,
          estimated_accommodation_currency: accommodationCurrency as any,
          estimated_meals_per_day: mealsPerDay,
          estimated_meals_currency: mealsCurrency as any,
          estimated_transport: estimatedTransport,
          estimated_transport_currency: transportCurrency as any,
          estimated_other: estimatedOther,
          estimated_other_currency: otherCurrency as any,
          estimated_total_ils: estimatedTotal,
          employee_notes: employeeNotes,
          status: 'draft',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      setSavedRequestId(request.id);
      toast.success('טיוטה נשמרה');
      return request.id;
    } catch (error) {
      console.error('Error saving draft for attachments:', error);
      toast.error('שגיאה בשמירת טיוטה');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (submit: boolean = false) => {
    if (!user || !organizationId) {
      toast.error('שגיאה בטעינת נתונים');
      return;
    }

    if (!destinationCity || !destinationCountry || !startDate || !endDate || !purpose) {
      toast.error('אנא מלא את כל השדות הנדרשים');
      return;
    }

    // Validate approver selection when submitting
    if (submit && !selectedApproverId) {
      toast.error('אנא בחר מאשר לפני שליחת הבקשה');
      return;
    }

    // If there are violations without explanations when submitting
    if (submit && violations.length > 0) {
      const missingExplanations = violations.filter(v => !violationExplanations[v.category]);
      if (missingExplanations.length > 0) {
        toast.error('אנא הוסף הסבר לכל החריגות');
        return;
      }
    }

    setLoading(true);
    try {
      let requestId = editRequestId;
      
      if (editRequestId) {
        // Update existing request
        const { error: updateError } = await supabase
          .from('travel_requests')
          .update({
            destination_city: destinationCity,
            destination_country: destinationCountry,
            start_date: startDate,
            end_date: endDate,
            purpose: purpose,
            purpose_details: purposeDetails,
            estimated_flights: estimatedFlights,
            estimated_flights_currency: flightsCurrency as any,
            estimated_accommodation_per_night: accommodationPerNight,
            estimated_accommodation_currency: accommodationCurrency as any,
            estimated_meals_per_day: mealsPerDay,
            estimated_meals_currency: mealsCurrency as any,
            estimated_transport: estimatedTransport,
            estimated_transport_currency: transportCurrency as any,
            estimated_other: estimatedOther,
            estimated_other_currency: otherCurrency as any,
            estimated_total_ils: estimatedTotal,
            employee_notes: employeeNotes,
            status: submit ? 'pending_approval' : 'draft',
            submitted_at: submit ? new Date().toISOString() : null
          })
          .eq('id', editRequestId);

        if (updateError) throw updateError;

        // Delete existing violations and re-insert
        await supabase
          .from('travel_request_violations')
          .delete()
          .eq('travel_request_id', editRequestId);
      } else {
        // Insert new request
        const { data: request, error: requestError } = await supabase
          .from('travel_requests')
          .insert({
            organization_id: organizationId,
            requested_by: user.id,
            destination_city: destinationCity,
            destination_country: destinationCountry,
            start_date: startDate,
            end_date: endDate,
            purpose: purpose,
            purpose_details: purposeDetails,
            estimated_flights: estimatedFlights,
            estimated_flights_currency: flightsCurrency as any,
            estimated_accommodation_per_night: accommodationPerNight,
            estimated_accommodation_currency: accommodationCurrency as any,
            estimated_meals_per_day: mealsPerDay,
            estimated_meals_currency: mealsCurrency as any,
            estimated_transport: estimatedTransport,
            estimated_transport_currency: transportCurrency as any,
            estimated_other: estimatedOther,
            estimated_other_currency: otherCurrency as any,
            estimated_total_ils: estimatedTotal,
            employee_notes: employeeNotes,
            status: submit ? 'pending_approval' : 'draft',
            submitted_at: submit ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (requestError) throw requestError;
        requestId = request.id;
        setSavedRequestId(request.id);
      }

      // Upload attachments if any
      if (requestId) {
        const uploadFn = (window as any).uploadTravelAttachments;
        if (uploadFn) {
          await uploadFn(requestId);
        }
      }

      // Save violations if any
      if (violations.length > 0 && requestId) {
        const violationRecords = violations.map(v => ({
          travel_request_id: requestId,
          category: v.category as any,
          requested_amount: v.requestedAmount,
          policy_limit: v.policyLimit,
          overage_amount: v.overageAmount,
          overage_percentage: v.overagePercentage,
          employee_explanation: violationExplanations[v.category] || null,
          requires_special_approval: v.overagePercentage > 15
        }));

        await supabase
          .from('travel_request_violations')
          .insert(violationRecords);
      }

      // If submitting, create approval record for selected approver and send notification
      if (submit && requestId && selectedApproverId) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Delete existing pending approvals for this request (for resubmissions)
        if (editRequestId) {
          await supabase
            .from('travel_request_approvals')
            .delete()
            .eq('travel_request_id', requestId)
            .eq('status', 'pending');
        }

        // Insert approval record for selected approver
        await supabase
          .from('travel_request_approvals')
          .insert({
            travel_request_id: requestId,
            approver_id: selectedApproverId,
            approval_level: 1
          });

        // Send email notification to selected approver
        try {
          await supabase.functions.invoke('notify-travel-request', {
            body: {
              travel_request_id: requestId,
              approver_id: selectedApproverId,
              requester_name: userProfile?.full_name || 'עובד',
              destination: `${destinationCity}, ${destinationCountry}`,
              start_date: startDate,
              end_date: endDate,
              purpose: purpose,
              estimated_total: estimatedTotal,
              has_violations: violations.length > 0,
              violation_count: violations.length
            }
          });
        } catch (notifyError) {
          console.error('Error sending notification:', notifyError);
          // Don't fail the request if notification fails
        }
      }

      toast.success(submit ? 'הבקשה נשלחה לאישור' : 'הבקשה נשמרה כטיוטה');
      navigate('/travel-requests');
    } catch (error: any) {
      console.error('Error saving request:', error);
      toast.error('שגיאה בשמירת הבקשה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/travel-requests')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {editRequestId ? 'עריכת בקשה לאישור נסיעה' : 'בקשה לאישור נסיעה'}
            </h1>
            <p className="text-muted-foreground">
              {editRequestId ? 'ערוך את הבקשה ושלח מחדש לאישור' : 'מלא את פרטי הנסיעה המתוכננת'}
            </p>
          </div>
        </div>

        {/* Destination & Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              פרטי הנסיעה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">עיר יעד *</Label>
                <Input
                  id="city"
                  placeholder="לדוגמה: ניו יורק"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">מדינה *</Label>
                <Input
                  id="country"
                  placeholder="לדוגמה: ארה״ב"
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">תאריך יציאה *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">תאריך חזרה *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {nights > 0 && (
              <p className="text-sm text-muted-foreground">
                {nights} לילות, {days} ימים
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="purpose">מטרת הנסיעה *</Label>
              <Input
                id="purpose"
                placeholder="לדוגמה: פגישה עם לקוח"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purposeDetails">פרטים נוספים</Label>
              <Textarea
                id="purposeDetails"
                placeholder="תיאור מפורט של מטרת הנסיעה..."
                value={purposeDetails}
                onChange={(e) => setPurposeDetails(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cost Estimates */}
        <Card>
          <CardHeader>
            <CardTitle>צפי עלויות</CardTitle>
            <CardDescription>הזן את העלויות המשוערות לכל קטגוריה</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Flights */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Plane className="h-4 w-4" />
                טיסות
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={estimatedFlights || ''}
                  onChange={(e) => setEstimatedFlights(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={flightsCurrency} onValueChange={setFlightsCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {policyRules.find(r => r.category === 'flights')?.max_amount && (
                <p className="text-xs text-muted-foreground">
                  מגבלה: עד {policyRules.find(r => r.category === 'flights')?.max_amount} {policyRules.find(r => r.category === 'flights')?.currency}
                </p>
              )}
            </div>

            {/* Accommodation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hotel className="h-4 w-4" />
                לינה (לכל לילה)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={accommodationPerNight || ''}
                  onChange={(e) => setAccommodationPerNight(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={accommodationCurrency} onValueChange={setAccommodationCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {nights > 0 && (
                <p className="text-xs text-muted-foreground">
                  סה"כ: {totalAccommodation} {accommodationCurrency} ({nights} לילות)
                </p>
              )}
            </div>

            {/* Meals */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                ארוחות (לכל יום)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={mealsPerDay || ''}
                  onChange={(e) => setMealsPerDay(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={mealsCurrency} onValueChange={setMealsCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {days > 0 && (
                <p className="text-xs text-muted-foreground">
                  סה"כ: {totalMeals} {mealsCurrency} ({days} ימים)
                </p>
              )}
            </div>

            {/* Transport */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                תחבורה (סה"כ)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={estimatedTransport || ''}
                  onChange={(e) => setEstimatedTransport(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={transportCurrency} onValueChange={setTransportCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Other */}
            <div className="space-y-2">
              <Label>הוצאות אחרות</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={estimatedOther || ''}
                  onChange={(e) => setEstimatedOther(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={otherCurrency} onValueChange={setOtherCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>סה"כ משוער:</span>
                <span>${estimatedTotal.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Violations */}
        {violations.length > 0 && (
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                חריגות מהמדיניות
              </CardTitle>
              <CardDescription>
                נמצאו חריגות מהמדיניות. אנא הוסף הסבר לכל חריגה.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {violations.map((violation) => (
                <Alert key={violation.category} variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium flex items-center gap-2">
                        {getCategoryIcon(violation.category)}
                        {getCategoryLabel(violation.category)}
                      </span>
                      <span className="text-sm">
                        חריגה של {violation.overagePercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm">
                      <p>ביקשת: {violation.requestedAmount} | מותר: {violation.policyLimit}</p>
                      <p>חריגה: {violation.overageAmount}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">הסבר לחריגה *</Label>
                      <Textarea
                        placeholder="הסבר למה נדרש סכום גבוה יותר..."
                        value={violationExplanations[violation.category] || ''}
                        onChange={(e) => setViolationExplanations(prev => ({
                          ...prev,
                          [violation.category]: e.target.value
                        }))}
                        className="bg-background"
                      />
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* No Violations */}
        {policyRules.length > 0 && violations.length === 0 && estimatedTotal > 0 && (
          <Alert className="bg-green-500/10 border-green-500 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              כל הסכומים תואמים את מדיניות הנסיעות של הארגון
            </AlertDescription>
          </Alert>
        )}

        {/* Attachments */}
        <TravelRequestAttachments 
          travelRequestId={savedRequestId} 
          readOnly={false}
          onRequestSaveDraft={saveDraftForAttachments}
        />

        {/* Employee Notes */}
        <Card>
          <CardHeader>
            <CardTitle>הערות נוספות</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="הערות או בקשות מיוחדות..."
              value={employeeNotes}
              onChange={(e) => setEmployeeNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Approver Selection */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              בחירת מאשר
            </CardTitle>
            <CardDescription>
              בחר למי לשלוח את הבקשה לאישור
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approver">מאשר הבקשה *</Label>
              <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                <SelectTrigger id="approver" className={!selectedApproverId ? "border-destructive" : ""}>
                  <SelectValue placeholder="בחר מאשר..." />
                </SelectTrigger>
                <SelectContent>
                  {approvers.map((approver) => (
                    <SelectItem key={approver.id} value={approver.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{approver.full_name}</span>
                        {approver.department && (
                          <span className="text-muted-foreground text-sm">({approver.department})</span>
                        )}
                        {approver.id === defaultManagerId && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            מנהל ישיר
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedApproverId && (
                <p className="text-sm text-destructive">יש לבחור מאשר לפני שליחת הבקשה</p>
              )}
            </div>
            {selectedApproverId && (
              <Alert className="bg-primary/5 border-primary/20">
                <UserCheck className="h-4 w-4" />
                <AlertDescription>
                  הבקשה תישלח ל: <strong>{approvers.find(a => a.id === selectedApproverId)?.full_name}</strong>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={() => navigate('/travel-requests')}>
            ביטול
          </Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={loading}>
            <Save className="h-4 w-4 ml-2" />
            שמור טיוטה
          </Button>
          <Button onClick={() => handleSave(true)} disabled={loading}>
            <Send className="h-4 w-4 ml-2" />
            שלח לאישור
          </Button>
        </div>
      </div>
    </div>
  );
}
