import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, XCircle, Plane, Hotel, Utensils, Car, DollarSign } from 'lucide-react';

interface ApprovedBudget {
  flights?: number;
  accommodation_per_night?: number;
  accommodation_total?: number;
  meals_per_day?: number;
  meals_total?: number;
  transport?: number;
  other?: number;
  total?: number;
}

interface BudgetComparisonCardProps {
  reportId: string;
  approvedTravelId?: string;
}

interface CategoryComparison {
  category: string;
  label: string;
  icon: any;
  approved: number;
  actual: number;
  difference: number;
  percentageUsed: number;
}

export function BudgetComparisonCard({ reportId, approvedTravelId }: BudgetComparisonCardProps) {
  const [approvedBudget, setApprovedBudget] = useState<ApprovedBudget | null>(null);
  const [actualExpenses, setActualExpenses] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [approvalNumber, setApprovalNumber] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [reportId, approvedTravelId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Try to find linked approved travel
      let travelId = approvedTravelId;
      
      if (!travelId) {
        // Check if report is linked to approved travel
        const { data: travel } = await supabase
          .from('approved_travels')
          .select('id, approved_budget, approval_number')
          .eq('expense_report_id', reportId)
          .single();
        
        if (travel) {
          travelId = travel.id;
          setApprovedBudget(travel.approved_budget as ApprovedBudget);
          setApprovalNumber(travel.approval_number);
        }
      } else {
        // Load approved travel by ID
        const { data: travel } = await supabase
          .from('approved_travels')
          .select('approved_budget, approval_number')
          .eq('id', travelId)
          .single();
        
        if (travel) {
          setApprovedBudget(travel.approved_budget as ApprovedBudget);
          setApprovalNumber(travel.approval_number);
        }
      }

      // Load actual expenses from report
      const { data: expenses } = await supabase
        .from('expenses')
        .select('category, amount_in_ils')
        .eq('report_id', reportId);

      if (expenses) {
        const totals: Record<string, number> = {};
        expenses.forEach(exp => {
          const cat = exp.category;
          totals[cat] = (totals[cat] || 0) + (exp.amount_in_ils || 0);
        });
        setActualExpenses(totals);
      }
    } catch (error) {
      console.error('Error loading budget comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  if (!approvedBudget) {
    return null; // No approved travel linked
  }

  const comparisons: CategoryComparison[] = [
    {
      category: 'flights',
      label: 'טיסות',
      icon: Plane,
      approved: approvedBudget.flights || 0,
      actual: actualExpenses['flights'] || 0,
      difference: (approvedBudget.flights || 0) - (actualExpenses['flights'] || 0),
      percentageUsed: approvedBudget.flights ? ((actualExpenses['flights'] || 0) / approvedBudget.flights) * 100 : 0
    },
    {
      category: 'hotels',
      label: 'לינה',
      icon: Hotel,
      approved: approvedBudget.accommodation_total || 0,
      actual: actualExpenses['hotels'] || 0,
      difference: (approvedBudget.accommodation_total || 0) - (actualExpenses['hotels'] || 0),
      percentageUsed: approvedBudget.accommodation_total ? ((actualExpenses['hotels'] || 0) / approvedBudget.accommodation_total) * 100 : 0
    },
    {
      category: 'meals',
      label: 'ארוחות',
      icon: Utensils,
      approved: approvedBudget.meals_total || 0,
      actual: actualExpenses['meals'] || 0,
      difference: (approvedBudget.meals_total || 0) - (actualExpenses['meals'] || 0),
      percentageUsed: approvedBudget.meals_total ? ((actualExpenses['meals'] || 0) / approvedBudget.meals_total) * 100 : 0
    },
    {
      category: 'ground_transport',
      label: 'תחבורה',
      icon: Car,
      approved: approvedBudget.transport || 0,
      actual: (actualExpenses['ground_transport'] || 0) + (actualExpenses['car_rental'] || 0) + (actualExpenses['taxi'] || 0),
      difference: (approvedBudget.transport || 0) - ((actualExpenses['ground_transport'] || 0) + (actualExpenses['car_rental'] || 0) + (actualExpenses['taxi'] || 0)),
      percentageUsed: approvedBudget.transport ? (((actualExpenses['ground_transport'] || 0) + (actualExpenses['car_rental'] || 0) + (actualExpenses['taxi'] || 0)) / approvedBudget.transport) * 100 : 0
    }
  ];

  const totalApproved = approvedBudget.total || 0;
  const totalActual = Object.values(actualExpenses).reduce((sum, val) => sum + val, 0);
  const totalDifference = totalApproved - totalActual;
  const totalPercentage = totalApproved > 0 ? (totalActual / totalApproved) * 100 : 0;

  const getStatusIcon = (percentage: number) => {
    if (percentage <= 100) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (percentage <= 115) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage <= 100) return 'bg-green-500';
    if (percentage <= 115) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            השוואת תקציב מאושר להוצאות בפועל
          </span>
          {approvalNumber && (
            <Badge variant="outline" className="font-mono">
              {approvalNumber}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Comparisons */}
        <div className="space-y-4">
          {comparisons.map((comp) => (
            <div key={comp.category} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <comp.icon className="h-4 w-4 text-muted-foreground" />
                  {comp.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    מאושר: ${comp.approved.toLocaleString()}
                  </span>
                  <span className={comp.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                    בפועל: ${comp.actual.toLocaleString()}
                  </span>
                  {getStatusIcon(comp.percentageUsed)}
                </div>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`absolute h-full transition-all duration-500 ${getProgressColor(comp.percentageUsed)}`}
                  style={{ width: `${Math.min(comp.percentageUsed, 100)}%` }}
                />
                {comp.percentageUsed > 100 && (
                  <div 
                    className="absolute h-full bg-red-500/50 right-0"
                    style={{ width: `${Math.min(comp.percentageUsed - 100, 50)}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{comp.percentageUsed.toFixed(0)}% מנוצל</span>
                <span className={comp.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {comp.difference >= 0 ? 'נותר' : 'חריגה'}: ${Math.abs(comp.difference).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Total Comparison */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">סה"כ</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(totalPercentage)}
              <Badge variant={totalDifference >= 0 ? 'default' : 'destructive'}>
                {totalDifference >= 0 ? 'בתקציב' : 'חריגה'}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">מאושר</p>
              <p className="text-xl font-bold text-primary">${totalApproved.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">בפועל</p>
              <p className="text-xl font-bold">${totalActual.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{totalDifference >= 0 ? 'נותר' : 'חריגה'}</p>
              <p className={`text-xl font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(totalDifference).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`absolute h-full transition-all duration-500 ${getProgressColor(totalPercentage)}`}
              style={{ width: `${Math.min(totalPercentage, 100)}%` }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {totalPercentage.toFixed(1)}% מהתקציב נוצל
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
