import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Link, Key, Shield, Table2, FileImage, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Column {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string;
}

interface TableData {
  name: string;
  description: string;
  color: string;
  columns: Column[];
  rls: string[];
}

interface Relationship {
  from: string;
  to: string;
  label: string;
}

interface EnumType {
  name: string;
  values: string[];
}

const DatabaseDiagram = () => {
  const navigate = useNavigate();
  const diagramRef = useRef<HTMLDivElement>(null);

  const exportAsPNG = async () => {
    if (!diagramRef.current) return;
    
    const toastId = toast.loading("מייצא כ-PNG...");
    try {
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      const link = document.createElement("a");
      link.download = "database-diagram.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast.dismiss(toastId);
      toast.success("הקובץ יורד בהצלחה!");
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("שגיאה בייצוא הקובץ");
      console.error(error);
    }
  };

  const exportAsPDF = async () => {
    if (!diagramRef.current) return;
    
    const toastId = toast.loading("מייצא כ-PDF...");
    try {
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save("database-diagram.pdf");
      
      toast.dismiss(toastId);
      toast.success("הקובץ יורד בהצלחה!");
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("שגיאה בייצוא הקובץ");
      console.error(error);
    }
  };

  const tables: TableData[] = [
    {
      name: "profiles",
      description: "פרופילי משתמשים",
      color: "bg-blue-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "user_id", type: "UUID", fk: "auth.users" },
        { name: "full_name", type: "TEXT" },
        { name: "email", type: "TEXT" },
        { name: "department", type: "TEXT" },
        { name: "employee_id", type: "TEXT" },
        { name: "is_manager", type: "BOOLEAN" },
        { name: "manager_id", type: "UUID", fk: "profiles" },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "grade_id", type: "UUID", fk: "employee_grades" },
        { name: "role", type: "app_role" },
      ],
      rls: ["צפייה: משתמש יכול לראות את עצמו ואחרים באותו ארגון", "עדכון: רק עצמי"],
    },
    {
      name: "user_roles",
      description: "תפקידי משתמשים",
      color: "bg-purple-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "user_id", type: "UUID", fk: "profiles" },
        { name: "role", type: "app_role" },
      ],
      rls: ["צפייה: כולם", "ניהול: admin/accounting_manager בלבד"],
    },
    {
      name: "organizations",
      description: "ארגונים",
      color: "bg-green-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "name", type: "TEXT" },
        { name: "description", type: "TEXT" },
        { name: "accounting_type", type: "TEXT" },
        { name: "external_accounting_email", type: "TEXT" },
        { name: "is_active", type: "BOOLEAN" },
        { name: "created_by", type: "UUID" },
      ],
      rls: ["צפייה: כולם", "ניהול: admin/org_admin בלבד"],
    },
    {
      name: "reports",
      description: "דוחות הוצאות",
      color: "bg-orange-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "user_id", type: "UUID", fk: "profiles" },
        { name: "trip_destination", type: "TEXT" },
        { name: "trip_purpose", type: "TEXT" },
        { name: "trip_start_date", type: "DATE" },
        { name: "trip_end_date", type: "DATE" },
        { name: "status", type: "expense_status" },
        { name: "total_amount_ils", type: "NUMERIC" },
        { name: "approved_by", type: "UUID", fk: "profiles" },
        { name: "daily_allowance", type: "NUMERIC" },
        { name: "allowance_days", type: "INTEGER" },
      ],
      rls: ["צפייה: בעלים, מנהל, הנהלת חשבונות", "יצירה/עדכון: בעלים בלבד"],
    },
    {
      name: "expenses",
      description: "הוצאות בודדות",
      color: "bg-red-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "report_id", type: "UUID", fk: "reports" },
        { name: "category", type: "expense_category" },
        { name: "amount", type: "NUMERIC" },
        { name: "currency", type: "expense_currency" },
        { name: "amount_in_ils", type: "NUMERIC" },
        { name: "expense_date", type: "DATE" },
        { name: "description", type: "TEXT" },
        { name: "payment_method", type: "payment_method" },
        { name: "approval_status", type: "expense_approval_status" },
        { name: "manager_comment", type: "TEXT" },
      ],
      rls: ["צפייה: דרך הדוח", "ניהול: בעל הדוח בלבד"],
    },
    {
      name: "receipts",
      description: "קבלות מצורפות",
      color: "bg-pink-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "expense_id", type: "UUID", fk: "expenses" },
        { name: "file_url", type: "TEXT" },
        { name: "file_name", type: "TEXT" },
        { name: "file_type", type: "file_type_enum" },
        { name: "file_size", type: "INTEGER" },
      ],
      rls: ["צפייה: דרך ההוצאה", "העלאה: בעל ההוצאה"],
    },
    {
      name: "travel_requests",
      description: "בקשות נסיעה",
      color: "bg-cyan-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "requested_by", type: "UUID", fk: "profiles" },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "destination_country", type: "TEXT" },
        { name: "destination_city", type: "TEXT" },
        { name: "start_date", type: "DATE" },
        { name: "end_date", type: "DATE" },
        { name: "purpose", type: "TEXT" },
        { name: "status", type: "travel_request_status" },
        { name: "estimated_total_ils", type: "NUMERIC" },
        { name: "approved_total_ils", type: "NUMERIC" },
      ],
      rls: ["צפייה: מגיש, מאשרים, הנהלת חשבונות", "ניהול: מגיש בלבד"],
    },
    {
      name: "travel_request_approvals",
      description: "אישורי בקשות נסיעה",
      color: "bg-teal-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "travel_request_id", type: "UUID", fk: "travel_requests" },
        { name: "approver_id", type: "UUID", fk: "profiles" },
        { name: "approval_level", type: "INTEGER" },
        { name: "status", type: "approval_status" },
        { name: "comments", type: "TEXT" },
        { name: "decided_at", type: "TIMESTAMP" },
      ],
      rls: ["צפייה: מאשר ומגיש הבקשה"],
    },
    {
      name: "approved_travels",
      description: "נסיעות מאושרות",
      color: "bg-emerald-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "travel_request_id", type: "UUID", fk: "travel_requests" },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "approval_number", type: "TEXT" },
        { name: "approved_budget", type: "JSONB" },
        { name: "valid_from", type: "DATE" },
        { name: "valid_until", type: "DATE" },
        { name: "is_used", type: "BOOLEAN" },
        { name: "expense_report_id", type: "UUID", fk: "reports" },
      ],
      rls: ["צפייה: חברי הארגון"],
    },
    {
      name: "travel_policy_rules",
      description: "כללי מדיניות נסיעות",
      color: "bg-amber-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "grade_id", type: "UUID", fk: "employee_grades" },
        { name: "category", type: "expense_category" },
        { name: "destination_type", type: "destination_type" },
        { name: "max_amount", type: "NUMERIC" },
        { name: "currency", type: "expense_currency" },
        { name: "per_type", type: "policy_rule_per_type" },
        { name: "is_active", type: "BOOLEAN" },
      ],
      rls: ["צפייה: חברי הארגון", "ניהול: org_admin בלבד"],
    },
    {
      name: "employee_grades",
      description: "דרגות עובדים",
      color: "bg-indigo-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "name", type: "TEXT" },
        { name: "level", type: "INTEGER" },
        { name: "description", type: "TEXT" },
        { name: "is_active", type: "BOOLEAN" },
      ],
      rls: ["צפייה: חברי הארגון", "ניהול: org_admin בלבד"],
    },
    {
      name: "invitation_codes",
      description: "קודי הזמנה",
      color: "bg-violet-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "code", type: "TEXT" },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "role", type: "app_role" },
        { name: "manager_id", type: "UUID", fk: "profiles" },
        { name: "grade_id", type: "UUID", fk: "employee_grades" },
        { name: "expires_at", type: "TIMESTAMP" },
        { name: "is_used", type: "BOOLEAN" },
        { name: "max_uses", type: "INTEGER" },
      ],
      rls: ["צפייה: יוצר הקוד", "יצירה: org_admin בלבד"],
    },
    {
      name: "notifications",
      description: "התראות",
      color: "bg-rose-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "user_id", type: "UUID", fk: "profiles" },
        { name: "type", type: "TEXT" },
        { name: "title", type: "TEXT" },
        { name: "message", type: "TEXT" },
        { name: "is_read", type: "BOOLEAN" },
        { name: "report_id", type: "UUID", fk: "reports" },
        { name: "travel_request_id", type: "UUID", fk: "travel_requests" },
      ],
      rls: ["צפייה/עדכון: בעלים בלבד"],
    },
    {
      name: "approval_chain_configs",
      description: "הגדרות שרשרת אישורים",
      color: "bg-sky-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "organization_id", type: "UUID", fk: "organizations" },
        { name: "name", type: "TEXT" },
        { name: "description", type: "TEXT" },
        { name: "is_default", type: "BOOLEAN" },
        { name: "is_active", type: "BOOLEAN" },
      ],
      rls: ["צפייה: חברי הארגון", "ניהול: org_admin בלבד"],
    },
    {
      name: "approval_chain_levels",
      description: "רמות שרשרת אישורים",
      color: "bg-fuchsia-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "chain_id", type: "UUID", fk: "approval_chain_configs" },
        { name: "level_order", type: "INTEGER" },
        { name: "level_type", type: "approval_level_type" },
        { name: "specific_user_id", type: "UUID", fk: "profiles" },
        { name: "is_required", type: "BOOLEAN" },
        { name: "can_skip_if_approved_amount_under", type: "NUMERIC" },
      ],
      rls: ["דרך שרשרת האישורים"],
    },
    {
      name: "receipt_analysis_logs",
      description: "לוגי ניתוח קבלות AI",
      color: "bg-lime-500",
      columns: [
        { name: "id", type: "UUID", pk: true },
        { name: "user_id", type: "UUID", fk: "profiles" },
        { name: "report_id", type: "UUID", fk: "reports" },
        { name: "expense_id", type: "UUID", fk: "expenses" },
        { name: "extracted_amount", type: "NUMERIC" },
        { name: "extracted_currency", type: "TEXT" },
        { name: "extracted_date", type: "TEXT" },
        { name: "user_corrected_amount", type: "NUMERIC" },
        { name: "raw_ai_response", type: "JSONB" },
      ],
      rls: ["צפייה: בעלים והנהלת חשבונות"],
    },
  ];

  const relationships: Relationship[] = [
    { from: "profiles", to: "organizations", label: "שייך ל" },
    { from: "profiles", to: "profiles", label: "מנהל של" },
    { from: "profiles", to: "employee_grades", label: "דרגה" },
    { from: "reports", to: "profiles", label: "נוצר ע״י" },
    { from: "expenses", to: "reports", label: "שייך ל" },
    { from: "receipts", to: "expenses", label: "מצורף ל" },
    { from: "travel_requests", to: "profiles", label: "מוגש ע״י" },
    { from: "travel_requests", to: "organizations", label: "בארגון" },
    { from: "travel_request_approvals", to: "travel_requests", label: "עבור" },
    { from: "approved_travels", to: "travel_requests", label: "מאשר את" },
    { from: "travel_policy_rules", to: "organizations", label: "בארגון" },
    { from: "travel_policy_rules", to: "employee_grades", label: "לדרגה" },
    { from: "invitation_codes", to: "organizations", label: "בארגון" },
    { from: "notifications", to: "profiles", label: "למשתמש" },
    { from: "approval_chain_configs", to: "organizations", label: "בארגון" },
    { from: "approval_chain_levels", to: "approval_chain_configs", label: "בשרשרת" },
  ];

  const enums: EnumType[] = [
    { name: "app_role", values: ["admin", "manager", "user", "accounting_manager", "org_admin"] },
    { name: "expense_status", values: ["draft", "open", "closed", "pending_approval"] },
    { name: "expense_category", values: ["flights", "accommodation", "food", "transportation", "miscellaneous"] },
    { name: "expense_currency", values: ["USD", "EUR", "ILS", "GBP", "PLN", "...+40"] },
    { name: "travel_request_status", values: ["draft", "pending_approval", "approved", "partially_approved", "rejected", "cancelled"] },
    { name: "approval_status", values: ["pending", "approved", "rejected", "skipped"] },
    { name: "payment_method", values: ["company_card", "out_of_pocket"] },
    { name: "destination_type", values: ["domestic", "international", "all"] },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Export Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Database className="h-10 w-10 text-primary" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">מבנה בסיס הנתונים</h1>
                <p className="text-muted-foreground text-sm">
                  דיאגרמה ויזואלית של כל הטבלאות והקשרים במערכת
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={exportAsPNG} variant="outline" className="gap-2">
              <FileImage className="h-4 w-4" />
              ייצא PNG
            </Button>
            <Button onClick={exportAsPDF} variant="default" className="gap-2">
              <FileText className="h-4 w-4" />
              ייצא PDF
            </Button>
          </div>
        </div>

        {/* Exportable Content */}
        <div ref={diagramRef} className="space-y-8 bg-background p-4">
          {/* Stats */}
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
                <Shield className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <div className="text-2xl font-bold">100%</div>
                <div className="text-sm text-muted-foreground">RLS מופעל</div>
              </CardContent>
            </Card>
          </div>

          {/* Relationships Diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                קשרים בין טבלאות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {relationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm"
                  >
                    <Badge variant="outline" className="font-mono">
                      {rel.from}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-xs text-muted-foreground">{rel.label}</span>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline" className="font-mono">
                      {rel.to}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ENUMs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                טיפוסי ENUM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enums.map((e) => (
                  <div key={e.name} className="p-3 bg-muted rounded-lg">
                    <div className="font-mono font-semibold text-primary mb-2">
                      {e.name}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.values.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => (
              <Card key={table.name} className="overflow-hidden">
                <CardHeader className={`${table.color} text-white py-3`}>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Table2 className="h-5 w-5" />
                    {table.name}
                  </CardTitle>
                  <p className="text-white/80 text-sm">{table.description}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[200px]">
                    <table className="w-full text-sm">
                      <tbody>
                        {table.columns.map((col) => (
                          <tr key={col.name} className="border-b last:border-0">
                            <td className="p-2 font-mono text-xs">
                              {col.pk && <Key className="h-3 w-3 inline ml-1 text-amber-500" />}
                              {col.fk && <Link className="h-3 w-3 inline ml-1 text-blue-500" />}
                              {col.name}
                            </td>
                            <td className="p-2 text-muted-foreground text-xs">
                              {col.type}
                            </td>
                            {col.fk && (
                              <td className="p-2">
                                <Badge variant="outline" className="text-xs">
                                  → {col.fk}
                                </Badge>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                  {table.rls && (
                    <div className="p-3 bg-muted/50 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Shield className="h-3 w-3" />
                        RLS:
                      </div>
                      <div className="space-y-1">
                        {table.rls.map((rule, idx) => (
                          <div key={idx} className="text-xs">
                            • {rule}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Visual ER Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>דיאגרמת ER ויזואלית</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-6 rounded-lg overflow-x-auto">
                <pre className="text-xs md:text-sm font-mono whitespace-pre leading-relaxed" dir="ltr">
{`
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  organizations  │────▶│     profiles     │◀────│  employee_grades│
│                 │     │                  │     │                 │
│ • id (PK)       │     │ • id (PK)        │     │ • id (PK)       │
│ • name          │     │ • full_name      │     │ • name          │
│ • accounting_   │     │ • email          │     │ • level         │
│   type          │     │ • organization_id│     │ • organization_ │
└─────────────────┘     │ • manager_id ────┐     │   id            │
                        │ • grade_id       │     └─────────────────┘
                        └────────┬─────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    reports      │     │ travel_requests │     │  notifications  │
│                 │     │                 │     │                 │
│ • id (PK)       │     │ • id (PK)       │     │ • id (PK)       │
│ • user_id (FK)  │     │ • requested_by  │     │ • user_id (FK)  │
│ • destination   │     │ • destination_  │     │ • title         │
│ • status        │     │   country       │     │ • message       │
│ • total_amount  │     │ • status        │     │ • is_read       │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────────┐
│    expenses     │     │ travel_request_     │
│                 │     │     approvals       │
│ • id (PK)       │     │                     │
│ • report_id(FK) │     │ • id (PK)           │
│ • category      │     │ • travel_request_id │
│ • amount        │     │ • approver_id       │
│ • currency      │     │ • status            │
└────────┬────────┘     └──────────┬──────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐     ┌─────────────────────┐
│    receipts     │     │   approved_travels  │
│                 │     │                     │
│ • id (PK)       │     │ • id (PK)           │
│ • expense_id    │     │ • travel_request_id │
│ • file_url      │     │ • approval_number   │
│ • file_type     │     │ • approved_budget   │
└─────────────────┘     └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ approval_chain_     │────▶│ approval_chain_     │
│ configs             │     │ levels              │
│                     │     │                     │
│ • id (PK)           │     │ • id (PK)           │
│ • organization_id   │     │ • chain_id (FK)     │
│ • name              │     │ • level_order       │
│ • is_default        │     │ • level_type        │
└─────────────────────┘     └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ travel_policy_rules │     │ invitation_codes    │
│                     │     │                     │
│ • id (PK)           │     │ • id (PK)           │
│ • organization_id   │     │ • code              │
│ • grade_id          │     │ • organization_id   │
│ • category          │     │ • role              │
│ • max_amount        │     │ • expires_at        │
└─────────────────────┘     └─────────────────────┘
`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DatabaseDiagram;
