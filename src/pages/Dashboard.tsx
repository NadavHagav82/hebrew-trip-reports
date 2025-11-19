import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, LogOut, Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  status: 'draft' | 'open' | 'pending' | 'approved' | 'rejected' | 'closed';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    fetchReports();
  }, [user, navigate]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הדוחות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatistics = () => {
    return {
      open: reports.filter(r => r.status === 'open').length,
      pending: reports.filter(r => r.status === 'pending').length,
      closed: reports.filter(r => r.status === 'closed').length,
    };
  };

  const filterReports = (status?: string) => {
    let filtered = reports;
    
    if (status && status !== 'all') {
      if (status === 'drafts') {
        filtered = filtered.filter(r => r.status === 'draft');
      } else if (status === 'history') {
        filtered = filtered.filter(r => r.status === 'approved' || r.status === 'closed');
      } else {
        filtered = filtered.filter(r => r.status === 'open');
      }
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.trip_destination.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const stats = getStatistics();
  const displayedReports = filterReports(activeTab);

  const calculateDaysOpen = (submittedAt: string | null) => {
    if (!submittedAt) return 0;
    const submitted = new Date(submittedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - submitted.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">דוחות נסיעה</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                שלום, {user?.user_metadata?.full_name || user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 ml-2" />
                יציאה
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('open')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">דוחות פתוחים</p>
                  <p className="text-3xl font-bold">{stats.open}</p>
                </div>
                <div className="w-12 h-12 bg-status-open/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🟠</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('all')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">ממתין לאישור</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <div className="w-12 h-12 bg-status-pending/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🔵</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('history')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">דוחות סגורים</p>
                  <p className="text-3xl font-bold">{stats.closed}</p>
                </div>
                <div className="w-12 h-12 bg-status-closed/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🟢</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList>
                  <TabsTrigger value="all">כל הדוחות</TabsTrigger>
                  <TabsTrigger value="open">דוחות פתוחים</TabsTrigger>
                  <TabsTrigger value="drafts">טיוטות</TabsTrigger>
                  <TabsTrigger value="history">היסטוריה</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button onClick={() => navigate('/reports/new')} size="lg">
                <Plus className="w-5 h-5 ml-2" />
                דוח נסיעה חדש
              </Button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="חיפוש לפי יעד, תיאור או מספר דוח..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* Reports Table */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">טוען דוחות...</p>
              </div>
            ) : displayedReports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין דוחות להצגה</p>
                <Button onClick={() => navigate('/reports/new')} className="mt-4">
                  <Plus className="w-4 h-4 ml-2" />
                  צור דוח ראשון
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-right p-4 font-semibold">סטטוס</th>
                      <th className="text-right p-4 font-semibold">יעד</th>
                      <th className="text-right p-4 font-semibold">תאריכים</th>
                      <th className="text-right p-4 font-semibold">סה"כ (₪)</th>
                      <th className="text-right p-4 font-semibold">הוגש</th>
                      <th className="text-right p-4 font-semibold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReports.map((report) => (
                      <tr key={report.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <StatusBadge 
                            status={report.status} 
                            daysOpen={report.status === 'open' ? calculateDaysOpen(report.submitted_at) : undefined}
                          />
                        </td>
                        <td className="p-4 font-medium">{report.trip_destination}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(report.trip_start_date).toLocaleDateString('he-IL')} - {new Date(report.trip_end_date).toLocaleDateString('he-IL')}
                        </td>
                        <td className="p-4 font-semibold">
                          {report.total_amount_ils?.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString('he-IL') : '-'}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/reports/${report.id}`)}
                          >
                            צפייה
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
