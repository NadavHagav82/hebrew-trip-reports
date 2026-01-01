import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CheckCircle, XCircle, Clock, MapPin, Calendar, User, History } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ApprovalHistoryItem {
  id: string;
  travel_request_id: string;
  approval_level: number;
  status: string;
  comments: string | null;
  decided_at: string | null;
  created_at: string;
  travel_request?: {
    id: string;
    destination_city: string;
    destination_country: string;
    start_date: string;
    end_date: string;
    purpose: string;
    status: string;
    estimated_total_ils: number;
    requested_by: string;
  };
  requester?: {
    full_name: string;
    department: string;
  };
}

export default function MyApprovalHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadApprovalHistory();
  }, [user]);

  const loadApprovalHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get all approvals by this user (decided ones)
      const { data: approvalData, error: approvalError } = await supabase
        .from('travel_request_approvals')
        .select('*')
        .eq('approver_id', user.id)
        .not('decided_at', 'is', null)
        .order('decided_at', { ascending: false });
      
      if (approvalError) throw approvalError;
      
      if (!approvalData || approvalData.length === 0) {
        setApprovals([]);
        setLoading(false);
        return;
      }

      // Get request details
      const requestIds = approvalData.map(a => a.travel_request_id);
      const { data: requests } = await supabase
        .from('travel_requests')
        .select('*')
        .in('id', requestIds);

      // Get requester profiles
      if (requests) {
        const requesterIds = [...new Set(requests.map(r => r.requested_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, department')
          .in('id', requesterIds);

        const enrichedApprovals = approvalData.map(approval => {
          const request = requests.find(r => r.id === approval.travel_request_id);
          const requester = request ? profiles?.find(p => p.id === request.requested_by) : null;
          return {
            ...approval,
            travel_request: request,
            requester
          };
        });

        setApprovals(enrichedApprovals);
      }
    } catch (error) {
      console.error('Error loading approval history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 ml-1" />אושר</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 ml-1" />נדחה</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 ml-1" />ממתין</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredApprovals = approvals.filter(a => {
    if (activeTab === 'all') return true;
    return a.status === activeTab;
  });

  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>חזרה לדשבורד</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="h-6 w-6" />
              היסטוריית האישורים שלי
            </h1>
            <p className="text-muted-foreground">בקשות נסיעה שטיפלת בהן</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ טופלו</p>
                  <p className="text-3xl font-bold">{approvals.length}</p>
                </div>
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">אושרו</p>
                  <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נדחו</p>
                  <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">הכל ({approvals.length})</TabsTrigger>
            <TabsTrigger value="approved">אושרו ({approvedCount})</TabsTrigger>
            <TabsTrigger value="rejected">נדחו ({rejectedCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredApprovals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">אין היסטוריית אישורים</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredApprovals.map((approval) => {
                  const request = approval.travel_request;
                  if (!request) return null;

                  return (
                    <Card 
                      key={approval.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/travel-requests/${request.id}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">
                                {request.destination_city}, {request.destination_country}
                              </h3>
                              {getStatusBadge(approval.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {approval.requester?.full_name || 'לא ידוע'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(request.start_date), 'd MMM yyyy', { locale: he })}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {request.purpose}
                              </span>
                            </div>
                            {approval.comments && (
                              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                הערה: {approval.comments}
                              </p>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm text-muted-foreground">תאריך החלטה</p>
                            <p className="font-medium">
                              {approval.decided_at 
                                ? format(new Date(approval.decided_at), 'd MMM yyyy HH:mm', { locale: he })
                                : '-'}
                            </p>
                            <p className="text-lg font-bold text-primary mt-2">
                              ₪{request.estimated_total_ils?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
