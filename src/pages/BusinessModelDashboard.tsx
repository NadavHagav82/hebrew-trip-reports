import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";
import {
  DollarSign, TrendingUp, Users, Building2, CreditCard,
  ArrowLeft, Calculator, Target, Landmark, PiggyBank
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const COLORS = ["hsl(142, 71%, 45%)", "hsl(217, 91%, 60%)", "hsl(262, 83%, 58%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)"];

const BusinessModelDashboard = () => {
  const navigate = useNavigate();

  // Adjustable parameters
  const [orgsYear1, setOrgsYear1] = useState(10);
  const [avgEmployeesPerOrg, setAvgEmployeesPerOrg] = useState(20);
  const [avgSpendPerTrip, setAvgSpendPerTrip] = useState(3000);
  const [tripsPerYear, setTripsPerYear] = useState(2);
  const [interchangeRate, setInterchangeRate] = useState(1.0);
  const [growthRate, setGrowthRate] = useState(50); // % annual growth

  // Development costs
  const devCost = 50000;
  const monthlyOpex = 2500;

  // Calculate projections
  const projections = useMemo(() => {
    const years = [];
    for (let y = 1; y <= 5; y++) {
      const growthMultiplier = Math.pow(1 + growthRate / 100, y - 1);
      const orgs = Math.round(orgsYear1 * growthMultiplier);
      const employees = orgs * avgEmployeesPerOrg;
      const annualSpend = employees * avgSpendPerTrip * tripsPerYear;
      const revenue = annualSpend * (interchangeRate / 100);
      const annualOpex = monthlyOpex * 12;
      const profit = revenue - annualOpex;
      const cumulativeProfit = years.length > 0
        ? years[years.length - 1].cumulativeProfit + profit
        : profit - devCost;

      years.push({
        year: `שנה ${y}`,
        yearNum: y,
        orgs,
        employees,
        annualSpend,
        revenue: Math.round(revenue),
        opex: annualOpex,
        profit: Math.round(profit),
        cumulativeProfit: Math.round(cumulativeProfit),
        margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      });
    }
    return years;
  }, [orgsYear1, avgEmployeesPerOrg, avgSpendPerTrip, tripsPerYear, interchangeRate, growthRate]);

  // ROI calculation
  const breakEvenYear = projections.findIndex(p => p.cumulativeProfit > 0) + 1;
  const totalRevenue5Y = projections.reduce((sum, p) => sum + p.revenue, 0);
  const totalProfit5Y = projections.reduce((sum, p) => sum + p.profit, 0);
  const roi5Y = Math.round(((totalProfit5Y - devCost) / devCost) * 100);

  // Revenue breakdown data
  const revenueBreakdown = [
    { name: "Visa/MC", value: 0.5, color: COLORS[0] },
    { name: "Stripe", value: 0.5, color: COLORS[1] },
    { name: "אנחנו", value: interchangeRate, color: COLORS[2] },
  ];

  // Monthly revenue projection for year 1
  const monthlyData = useMemo(() => {
    const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    return months.map((m, i) => {
      const monthOrgs = Math.round(orgsYear1 * ((i + 1) / 12));
      const monthEmployees = monthOrgs * avgEmployeesPerOrg;
      const monthSpend = (monthEmployees * avgSpendPerTrip * tripsPerYear) / 12;
      const monthRevenue = monthSpend * (interchangeRate / 100);
      return {
        month: m,
        הכנסה: Math.round(monthRevenue),
        הוצאות: monthlyOpex,
        רווח: Math.round(monthRevenue - monthlyOpex),
      };
    });
  }, [orgsYear1, avgEmployeesPerOrg, avgSpendPerTrip, tripsPerYear, interchangeRate]);

  // Valuation comparison
  const year3Revenue = projections[2]?.revenue || 0;
  const valuationData = [
    { name: "SaaS (×7)", value: year3Revenue * 7, multiplier: 7 },
    { name: "SaaS+Fintech (×12)", value: year3Revenue * 12, multiplier: 12 },
    { name: "Fintech (×20)", value: year3Revenue * 20, multiplier: 20 },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              מודל עסקי — כרטיס דיגיטלי
            </h1>
            <p className="text-muted-foreground mt-1">סימולטור הכנסות אינטראקטיבי</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 ml-2" />
            חזרה
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">הכנסה שנה 5</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                ${projections[4]?.revenue.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">עובדים שנה 5</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {projections[4]?.employees.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs font-medium">ROI 5 שנים</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {roi5Y}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">נקודת איזון</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {breakEvenYear > 0 ? `שנה ${breakEvenYear}` : "5+"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sliders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              פרמטרים מתכווננים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>ארגונים בשנה 1</span>
                  <Badge variant="secondary">{orgsYear1}</Badge>
                </div>
                <Slider value={[orgsYear1]} onValueChange={v => setOrgsYear1(v[0])} min={1} max={50} step={1} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>עובדים ממוצע לארגון</span>
                  <Badge variant="secondary">{avgEmployeesPerOrg}</Badge>
                </div>
                <Slider value={[avgEmployeesPerOrg]} onValueChange={v => setAvgEmployeesPerOrg(v[0])} min={5} max={100} step={5} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>הוצאה ממוצעת לנסיעה ($)</span>
                  <Badge variant="secondary">${avgSpendPerTrip.toLocaleString()}</Badge>
                </div>
                <Slider value={[avgSpendPerTrip]} onValueChange={v => setAvgSpendPerTrip(v[0])} min={1000} max={10000} step={500} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>נסיעות בשנה לעובד</span>
                  <Badge variant="secondary">{tripsPerYear}</Badge>
                </div>
                <Slider value={[tripsPerYear]} onValueChange={v => setTripsPerYear(v[0])} min={1} max={6} step={1} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>אחוז עמלה (Interchange)</span>
                  <Badge variant="secondary">{interchangeRate}%</Badge>
                </div>
                <Slider value={[interchangeRate]} onValueChange={v => setInterchangeRate(v[0])} min={0.5} max={2} step={0.1} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>קצב צמיחה שנתי (%)</span>
                  <Badge variant="secondary">{growthRate}%</Badge>
                </div>
                <Slider value={[growthRate]} onValueChange={v => setGrowthRate(v[0])} min={10} max={200} step={10} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 5 Year Revenue Projection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                תחזית הכנסות ורווח — 5 שנים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projections}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                    contentStyle={{ direction: "rtl", borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="הכנסה" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opex" name="הוצאות" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="רווח" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cumulative Profit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-purple-600" />
                רווח מצטבר (כולל עלות פיתוח)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={projections}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "רווח מצטבר"]}
                    contentStyle={{ direction: "rtl", borderRadius: 8 }}
                  />
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="cumulativeProfit"
                    name="רווח מצטבר"
                    stroke="hsl(262, 83%, 58%)"
                    fill="url(#profitGradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Year 1 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                הכנסות חודשיות — שנה 1
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                    contentStyle={{ direction: "rtl", borderRadius: 8 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="הכנסה" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="הוצאות" stroke="hsl(0, 84%, 60%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="רווח" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Interchange Split */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-600" />
                חלוקת עמלה (~2%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={revenueBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {revenueBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Valuation & Data Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Valuation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-green-600" />
                הערכת שווי חברה (שנה 3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={valuationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "שווי"]}
                    contentStyle={{ direction: "rtl", borderRadius: 8 }}
                  />
                  <Bar dataKey="value" name="שווי חברה" radius={[0, 4, 4, 0]}>
                    {valuationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                הכנסה שנתית שנה 3: ${year3Revenue.toLocaleString()} × מכפיל
              </p>
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                טבלת סיכום — 5 שנים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">שנה</th>
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">ארגונים</th>
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">עובדים</th>
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">הכנסה</th>
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">רווח</th>
                      <th className="py-2 px-2 text-right font-medium text-muted-foreground">מרווח</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((p) => (
                      <tr key={p.yearNum} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{p.year}</td>
                        <td className="py-2 px-2">{p.orgs}</td>
                        <td className="py-2 px-2">{p.employees.toLocaleString()}</td>
                        <td className="py-2 px-2 text-green-600 font-medium">${p.revenue.toLocaleString()}</td>
                        <td className={`py-2 px-2 font-medium ${p.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          ${p.profit.toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={p.margin > 50 ? "default" : "secondary"} className="text-xs">
                            {p.margin}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold">
                      <td className="py-2 px-2" colSpan={3}>סה"כ 5 שנים</td>
                      <td className="py-2 px-2 text-green-600">${totalRevenue5Y.toLocaleString()}</td>
                      <td className="py-2 px-2 text-blue-600">${totalProfit5Y.toLocaleString()}</td>
                      <td className="py-2 px-2">
                        <Badge className="text-xs">ROI {roi5Y}%</Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investment Summary */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">עלות פיתוח</p>
                <p className="text-xl font-bold text-foreground">${devCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">הוצאה חודשית</p>
                <p className="text-xl font-bold text-foreground">${monthlyOpex.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">נקודת איזון</p>
                <p className="text-xl font-bold text-green-600">{breakEvenYear > 0 ? `שנה ${breakEvenYear}` : "5+ שנים"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">הכנסה שנה 5</p>
                <p className="text-xl font-bold text-green-600">${projections[4]?.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">שווי (Fintech ×20)</p>
                <p className="text-xl font-bold text-purple-600">
                  ${(projections[4]?.revenue * 20 / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessModelDashboard;
