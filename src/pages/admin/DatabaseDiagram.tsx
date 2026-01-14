import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Link, Key, Shield, Table2, FileImage, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DatabaseDiagram = () => {
  const navigate = useNavigate();

  const exportAsText = () => {
    const content = `
מבנה בסיס הנתונים - מערכת דוחות נסיעה
==========================================

טבלאות ראשיות:
--------------
1. profiles - פרופילי משתמשים
2. user_roles - תפקידי משתמשים  
3. organizations - ארגונים
4. reports - דוחות הוצאות
5. expenses - הוצאות בודדות
6. receipts - קבלות מצורפות
7. travel_requests - בקשות נסיעה
8. travel_request_approvals - אישורי בקשות
9. approved_travels - נסיעות מאושרות
10. travel_policy_rules - כללי מדיניות
11. employee_grades - דרגות עובדים
12. invitation_codes - קודי הזמנה
13. notifications - התראות
14. approval_chain_configs - שרשראות אישורים
15. approval_chain_levels - רמות אישור
16. receipt_analysis_logs - לוגי AI

קשרים מרכזיים:
--------------
profiles -> organizations (שייך ל)
profiles -> profiles (מנהל של)
reports -> profiles (נוצר ע״י)
expenses -> reports (שייך ל)
receipts -> expenses (מצורף ל)
travel_requests -> profiles (מוגש ע״י)
travel_requests -> organizations (בארגון)
travel_policy_rules -> organizations (בארגון)
travel_policy_rules -> employee_grades (לדרגה)
    `;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "database-diagram.txt";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ יורד בהצלחה!");
  };

  const tables = [
    { name: "profiles", description: "פרופילי משתמשים", color: "bg-blue-500", count: 8 },
    { name: "user_roles", description: "תפקידי משתמשים", color: "bg-purple-500", count: 3 },
    { name: "organizations", description: "ארגונים", color: "bg-green-500", count: 7 },
    { name: "reports", description: "דוחות הוצאות", color: "bg-orange-500", count: 12 },
    { name: "expenses", description: "הוצאות בודדות", color: "bg-red-500", count: 10 },
    { name: "receipts", description: "קבלות מצורפות", color: "bg-pink-500", count: 6 },
    { name: "travel_requests", description: "בקשות נסיעה", color: "bg-cyan-500", count: 15 },
    { name: "travel_request_approvals", description: "אישורי בקשות", color: "bg-teal-500", count: 7 },
    { name: "approved_travels", description: "נסיעות מאושרות", color: "bg-emerald-500", count: 8 },
    { name: "travel_policy_rules", description: "כללי מדיניות", color: "bg-amber-500", count: 9 },
    { name: "employee_grades", description: "דרגות עובדים", color: "bg-indigo-500", count: 6 },
    { name: "invitation_codes", description: "קודי הזמנה", color: "bg-violet-500", count: 8 },
    { name: "notifications", description: "התראות", color: "bg-rose-500", count: 7 },
    { name: "approval_chain_configs", description: "שרשראות אישורים", color: "bg-sky-500", count: 6 },
    { name: "approval_chain_levels", description: "רמות אישור", color: "bg-fuchsia-500", count: 7 },
    { name: "receipt_analysis_logs", description: "לוגי AI", color: "bg-lime-500", count: 9 },
  ];

  const relationships = [
    { from: "profiles", to: "organizations", label: "שייך ל" },
    { from: "profiles", to: "profiles", label: "מנהל של" },
    { from: "reports", to: "profiles", label: "נוצר ע״י" },
    { from: "expenses", to: "reports", label: "שייך ל" },
    { from: "receipts", to: "expenses", label: "מצורף ל" },
    { from: "travel_requests", to: "profiles", label: "מוגש ע״י" },
    { from: "travel_requests", to: "organizations", label: "בארגון" },
    { from: "travel_policy_rules", to: "employee_grades", label: "לדרגה" },
  ];

  const enums = [
    { name: "app_role", values: ["admin", "manager", "user", "accounting_manager", "org_admin"] },
    { name: "expense_status", values: ["draft", "open", "closed", "pending_approval"] },
    { name: "expense_category", values: ["flights", "accommodation", "food", "transportation", "miscellaneous"] },
    { name: "travel_request_status", values: ["draft", "pending_approval", "approved", "rejected", "cancelled"] },
    { name: "approval_status", values: ["pending", "approved", "rejected", "skipped"] },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Database className="h-10 w-10 text-primary" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">מבנה בסיס הנתונים</h1>
                <p className="text-muted-foreground text-sm">דיאגרמה של כל הטבלאות והקשרים</p>
              </div>
            </div>
          </div>
          
          <Button onClick={exportAsText} variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            ייצא כטקסט
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Table2 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{tables.length}</div>
              <div className="text-sm text-muted-foreground">טבלאות</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Link className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold">{relationships.length}</div>
              <div className="text-sm text-muted-foreground">קשרים</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Key className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold">{enums.length}</div>
              <div className="text-sm text-muted-foreground">ENUMs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold">100%</div>
              <div className="text-sm text-muted-foreground">RLS מוגן</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              טבלאות במערכת
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {tables.map((table) => (
                <div key={table.name} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${table.color}`} />
                    <span className="font-mono text-sm font-medium">{table.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{table.description}</p>
                  <Badge variant="secondary" className="mt-2 text-xs">{table.count} עמודות</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              קשרים בין טבלאות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {relationships.map((rel, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <Badge variant="outline">{rel.from}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline">{rel.to}</Badge>
                  <span className="text-muted-foreground text-xs">({rel.label})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              סוגי ENUM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enums.map((enumType) => (
                <div key={enumType.name} className="border rounded-lg p-3">
                  <div className="font-mono text-sm font-medium mb-2">{enumType.name}</div>
                  <div className="flex flex-wrap gap-1">
                    {enumType.values.map((val) => (
                      <Badge key={val} variant="secondary" className="text-xs">{val}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatabaseDiagram;
