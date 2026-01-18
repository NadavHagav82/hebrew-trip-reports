# 📚 תיעוד טכני מלא - מערכת ניהול הוצאות ונסיעות עסקיות

## 📋 תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [מבנה הפרויקט](#מבנה-הפרויקט)
4. [טכנולוגיות](#טכנולוגיות)
5. [מסד הנתונים](#מסד-הנתונים)
6. [Edge Functions](#edge-functions)
7. [אבטחה](#אבטחה)
8. [קומפוננטות UI](#קומפוננטות-ui)
9. [דפים וניתוב](#דפים-וניתוב)
10. [Hooks מותאמים](#hooks-מותאמים)
11. [Context](#context)
12. [Utilities](#utilities)

---

## 🌐 סקירה כללית

מערכת מקיפה לניהול הוצאות נסיעות עסקיות הכוללת:
- ניהול דוחות הוצאות עם זיהוי קבלות חכם (AI)
- אישור בקשות נסיעה עם שרשרת אישורים מותאמת
- מעקב תקציבים ומדיניות נסיעות
- ניהול ארגונים מרובים
- מערכת התראות בזמן אמת
- תמיכה ב-50+ מטבעות עם שערי חליפין חיים

### כתובות
- **Preview**: https://id-preview--cbf206ae-1e12-4d52-975f-ab71d613283f.lovable.app
- **Production**: https://hebrew-trip-reports.lovable.app

---

## 🏗️ ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │    Pages    │ │ Components  │ │   Hooks     │ │  Contexts   ││
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘│
│         │               │               │               │        │
│         └───────────────┴───────────────┴───────────────┘        │
│                                 │                                 │
│                    ┌────────────▼────────────┐                   │
│                    │   Supabase Client SDK   │                   │
│                    └────────────┬────────────┘                   │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Lovable Cloud        │
                    │       (Supabase)          │
                    │  ┌─────────────────────┐  │
                    │  │   Authentication    │  │
                    │  ├─────────────────────┤  │
                    │  │   PostgreSQL DB     │  │
                    │  │   (32+ Tables)      │  │
                    │  ├─────────────────────┤  │
                    │  │   Edge Functions    │  │
                    │  │   (19 Functions)    │  │
                    │  ├─────────────────────┤  │
                    │  │      Storage        │  │
                    │  │   (3 Buckets)       │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    External Services      │
                    │  ┌─────────────────────┐  │
                    │  │   Resend (Email)    │  │
                    │  ├─────────────────────┤  │
                    │  │  Lovable AI Gateway │  │
                    │  │  (Receipt Analysis) │  │
                    │  ├─────────────────────┤  │
                    │  │ Bank of Israel API  │  │
                    │  │ (Exchange Rates)    │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

---

## 📁 מבנה הפרויקט

```
project/
├── public/                          # קבצים סטטיים
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── components/                  # קומפוננטות
│   │   ├── ui/                      # Shadcn UI Components (40+)
│   │   │   ├── accordion.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (35+ more)
│   │   │
│   │   ├── policy/                  # Policy Management Components
│   │   │   ├── ApprovalChainManager.tsx
│   │   │   ├── CategoryRulesManager.tsx
│   │   │   ├── CustomRulesManager.tsx
│   │   │   ├── EmployeeGradesManager.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── PolicyAuditLog.tsx
│   │   │   ├── PolicyDashboard.tsx
│   │   │   ├── PolicyImportDialog.tsx
│   │   │   ├── PolicyPreview.tsx
│   │   │   └── RestrictionsManager.tsx
│   │   │
│   │   ├── AccountingComments.tsx   # תגובות הנה"ח
│   │   ├── AccountingSendHistory.tsx # היסטוריית שליחות
│   │   ├── AddExpenseByAccounting.tsx # הוספת הוצאה ע"י הנה"ח
│   │   ├── AppErrorBoundary.tsx     # Error Boundary
│   │   ├── BudgetComparisonCard.tsx # השוואת תקציב
│   │   ├── DuplicateExpenseDetector.tsx # זיהוי כפילויות
│   │   ├── ExpenseTemplatesManager.tsx # ניהול תבניות
│   │   ├── InstallBanner.tsx        # באנר התקנת PWA
│   │   ├── ManagerAttachmentUpload.tsx # העלאת קבצים
│   │   ├── ManagerExpenseReview.tsx # סקירת הוצאות
│   │   ├── NavLink.tsx              # קישור ניווט
│   │   ├── NotificationBell.tsx     # פעמון התראות
│   │   ├── PasswordStrengthIndicator.tsx # חוזק סיסמה
│   │   ├── ReportHistory.tsx        # היסטוריית דוח
│   │   ├── RequireAuth.tsx          # הגנת דפים
│   │   ├── SendToAccountingDialog.tsx # שליחה להנה"ח
│   │   ├── StatusBadge.tsx          # תג סטטוס
│   │   └── TravelRequestAttachments.tsx # קבצים מצורפים
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx          # Context אימות
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx           # זיהוי מובייל
│   │   ├── use-toast.ts             # Toast notifications
│   │   ├── usePolicyAuditLog.ts     # לוג מדיניות
│   │   └── useScrollAnimation.ts    # אנימציות גלילה
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts            # Supabase Client (auto-generated)
│   │       └── types.ts             # TypeScript Types (auto-generated)
│   │
│   ├── lib/
│   │   └── utils.ts                 # Utility functions
│   │
│   ├── pages/                       # דפים
│   │   ├── auth/                    # אימות (7 דפים)
│   │   │   ├── Login.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── ResetPassword.tsx
│   │   │   ├── RegisterSelection.tsx
│   │   │   ├── RegisterEmployee.tsx
│   │   │   ├── RegisterManager.tsx
│   │   │   ├── RegisterBootstrap.tsx
│   │   │   ├── RegisterIndependent.tsx
│   │   │   └── RegisterWithCode.tsx
│   │   │
│   │   ├── accounting/              # הנהלת חשבונות (8 דפים)
│   │   │   ├── AccountingHome.tsx
│   │   │   ├── AccountingDashboard.tsx
│   │   │   ├── AccountingStats.tsx
│   │   │   ├── AIAccuracyAnalytics.tsx
│   │   │   ├── BootstrapTokenManagement.tsx
│   │   │   ├── ExpenseTemplates.tsx
│   │   │   ├── ManageUsers.tsx
│   │   │   ├── OrganizationalAnalytics.tsx
│   │   │   └── ReimbursementSummary.tsx
│   │   │
│   │   ├── admin/                   # אדמין (6 דפים)
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── DatabaseDiagram.tsx
│   │   │   ├── ManageOrganizations.tsx
│   │   │   ├── ManageRoles.tsx
│   │   │   ├── ManageUsersRoles.tsx
│   │   │   ├── OrgAdminUsers.tsx
│   │   │   └── OrganizationDashboard.tsx
│   │   │
│   │   ├── analytics/               # אנליטיקות
│   │   │   └── ExpenseAnalytics.tsx
│   │   │
│   │   ├── manager/                 # מנהל (6 דפים)
│   │   │   ├── ManagerDashboard.tsx
│   │   │   ├── ManagerStats.tsx
│   │   │   ├── ManagerPersonalStats.tsx
│   │   │   ├── ManagerTravelStats.tsx
│   │   │   ├── MyTeam.tsx
│   │   │   └── AdvancedReports.tsx
│   │   │
│   │   ├── orgadmin/                # מנהל ארגון (5 דפים)
│   │   │   ├── OrgAdminDashboard.tsx
│   │   │   ├── InvitationCodesManagement.tsx
│   │   │   ├── OrgUsersManagement.tsx
│   │   │   ├── OrgAnalytics.tsx
│   │   │   └── TravelPolicyBuilder.tsx
│   │   │
│   │   ├── policy/                  # מדיניות
│   │   │   └── MyTravelPolicy.tsx
│   │   │
│   │   ├── reports/                 # דוחות (2 דפים)
│   │   │   ├── NewReport.tsx
│   │   │   └── ViewReport.tsx
│   │   │
│   │   ├── travel/                  # נסיעות (6 דפים)
│   │   │   ├── TravelRequestsList.tsx
│   │   │   ├── NewTravelRequest.tsx
│   │   │   ├── TravelRequestDetails.tsx
│   │   │   ├── PendingTravelApprovals.tsx
│   │   │   ├── ApprovedTravels.tsx
│   │   │   └── MyApprovalHistory.tsx
│   │   │
│   │   ├── AboutSystem.tsx          # אודות
│   │   ├── ApproveReport.tsx        # אישור דוח
│   │   ├── Dashboard.tsx            # דשבורד ראשי
│   │   ├── InstallApp.tsx           # התקנת אפליקציה
│   │   └── NotFound.tsx             # 404
│   │
│   ├── pdf/
│   │   └── ReportPdf.tsx            # יצירת PDF
│   │
│   ├── utils/
│   │   ├── imageDataUrl.ts          # המרת תמונות
│   │   └── pdfToImage.ts            # המרת PDF
│   │
│   ├── App.tsx                      # אפליקציה ראשית
│   ├── App.css                      # סגנונות
│   ├── index.css                    # Tailwind CSS
│   ├── main.tsx                     # Entry point
│   └── vite-env.d.ts                # Type declarations
│
├── supabase/
│   ├── config.toml                  # Supabase config
│   └── functions/                   # Edge Functions (19)
│       ├── analyze-receipt/         # ניתוח קבלות AI
│       ├── approve-report/          # אישור דוח
│       ├── bootstrap-token/         # טוקן הקמה
│       ├── create-user/             # יצירת משתמש
│       ├── extract-policy-text/     # חילוץ מדיניות
│       ├── get-exchange-rates/      # שערי חליפין
│       ├── notify-accounting-comment/
│       ├── notify-approval-skipped/
│       ├── notify-employee-review/
│       ├── notify-manager-new-employee/
│       ├── notify-missing-grades/
│       ├── notify-travel-decision/
│       ├── notify-travel-request/
│       ├── request-add-employee/
│       ├── request-report-approval/
│       ├── reset-user-password/
│       ├── send-accounting-report/
│       ├── send-invitation-email/
│       └── send-report-email/
│
├── BACKEND_DOCUMENTATION.md         # תיעוד Backend
├── SYSTEM_FEATURES_DOCUMENT.md      # מסמך פיצ'רים
├── USER_GUIDE.md                    # מדריך למשתמש
├── README.md                        # Readme
├── index.html                       # HTML
├── vite.config.ts                   # Vite config
├── tailwind.config.ts               # Tailwind config
├── tsconfig.json                    # TypeScript config
├── eslint.config.js                 # ESLint config
└── package.json                     # Dependencies
```

---

## 🛠️ טכנולוגיות

### Frontend
| טכנולוגיה | גרסה | תיאור |
|-----------|-------|--------|
| React | ^18.3.1 | UI Framework |
| Vite | Latest | Build Tool |
| TypeScript | Latest | Type Safety |
| Tailwind CSS | Latest | Styling |
| Shadcn/UI | Latest | Component Library |
| React Router | ^6.30.1 | Routing |
| TanStack Query | ^5.83.0 | Data Fetching |
| React Hook Form | ^7.61.1 | Form Management |
| Zod | ^3.25.76 | Validation |
| Recharts | ^2.15.4 | Charts |
| Lucide React | ^0.462.0 | Icons |
| date-fns | ^3.6.0 | Date utilities |

### Backend
| טכנולוגיה | תיאור |
|-----------|--------|
| Lovable Cloud (Supabase) | Backend as a Service |
| PostgreSQL | Database |
| Edge Functions (Deno) | Serverless Functions |
| Supabase Auth | Authentication |
| Supabase Storage | File Storage |
| Supabase Realtime | Real-time subscriptions |

### External APIs
| שירות | שימוש |
|--------|--------|
| Resend | Email sending |
| Lovable AI Gateway | Receipt analysis |
| Bank of Israel API | Exchange rates |

### Dependencies מלאות
```json
{
  "@hookform/resolvers": "^3.10.0",
  "@radix-ui/react-*": "Multiple UI primitives",
  "@react-pdf/renderer": "^4.3.1",
  "@supabase/supabase-js": "^2.83.0",
  "@tanstack/react-query": "^5.83.0",
  "buffer": "^6.0.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^3.6.0",
  "embla-carousel-react": "^8.6.0",
  "file-saver": "^2.0.5",
  "html2canvas": "^1.4.1",
  "input-otp": "^1.4.2",
  "jspdf-autotable": "^5.0.2",
  "lucide-react": "^0.462.0",
  "mammoth": "^1.11.0",
  "next-themes": "^0.3.0",
  "pdfjs-dist": "^5.4.394",
  "react": "^18.3.1",
  "react-day-picker": "^8.10.1",
  "react-dom": "^18.3.1",
  "react-hook-form": "^7.61.1",
  "react-resizable-panels": "^2.1.9",
  "react-router-dom": "^6.30.1",
  "recharts": "^2.15.4",
  "sonner": "^1.7.4",
  "tailwind-merge": "^2.6.0",
  "tailwindcss-animate": "^1.0.7",
  "vaul": "^0.9.9",
  "vite-plugin-pwa": "^1.2.0",
  "xlsx": "^0.18.5",
  "zod": "^3.25.76"
}
```

---

## 💾 מסד הנתונים

### סכמה מלאה - 32+ טבלאות

#### 1. `profiles` - פרופילי משתמשים
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  username TEXT NOT NULL,
  email TEXT,
  full_name TEXT NOT NULL,
  employee_id TEXT,
  department TEXT NOT NULL,
  is_manager BOOLEAN DEFAULT FALSE,
  manager_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  grade_id UUID REFERENCES employee_grades(id),
  accounting_manager_email TEXT,
  role app_role,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `user_roles` - תפקידי משתמשים
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: app_role
-- 'admin', 'manager', 'user', 'accounting_manager', 'org_admin'
```

#### 3. `organizations` - ארגונים
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  accounting_type TEXT, -- 'internal' | 'external'
  external_accounting_email TEXT,
  external_accounting_name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. `reports` - דוחות הוצאות
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  trip_destination TEXT NOT NULL,
  trip_purpose TEXT NOT NULL,
  trip_start_date DATE NOT NULL,
  trip_end_date DATE NOT NULL,
  status expense_status DEFAULT 'open',
  total_amount_ils NUMERIC,
  daily_allowance NUMERIC,
  allowance_days INTEGER,
  notes TEXT,
  manager_approval_token TEXT,
  manager_general_comment TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  manager_approval_requested_at TIMESTAMPTZ,
  reimbursement_paid BOOLEAN DEFAULT FALSE,
  reimbursement_paid_at TIMESTAMPTZ,
  reimbursement_paid_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: expense_status
-- 'open', 'pending_approval', 'closed'
```

#### 5. `expenses` - הוצאות
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency expense_currency NOT NULL,
  amount_in_ils NUMERIC NOT NULL,
  payment_method payment_method DEFAULT 'out_of_pocket',
  notes TEXT,
  approval_status expense_approval_status DEFAULT 'pending',
  manager_comment TEXT,
  employee_reply TEXT,
  employee_reply_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: expense_category
-- 'flights', 'accommodation', 'food', 'transportation', 'miscellaneous'

-- ENUM: expense_currency (50+ currencies)
-- 'USD', 'EUR', 'ILS', 'GBP', 'CHF', 'JPY', 'CNY', etc.

-- ENUM: payment_method
-- 'out_of_pocket', 'company_card', 'bank_transfer'

-- ENUM: expense_approval_status
-- 'pending', 'approved', 'rejected'
```

#### 6. `receipts` - קבלות
```sql
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type file_type_enum NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. `travel_requests` - בקשות נסיעה
```sql
CREATE TABLE travel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  requested_by UUID NOT NULL,
  destination_city TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  purpose TEXT NOT NULL,
  purpose_details TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INTEGER,
  days INTEGER,
  estimated_flights NUMERIC,
  estimated_flights_currency expense_currency,
  estimated_accommodation_per_night NUMERIC,
  estimated_accommodation_currency expense_currency,
  estimated_meals_per_day NUMERIC,
  estimated_meals_currency expense_currency,
  estimated_transport NUMERIC,
  estimated_transport_currency expense_currency,
  estimated_other NUMERIC,
  estimated_other_currency expense_currency,
  estimated_total_ils NUMERIC,
  status travel_request_status DEFAULT 'draft',
  current_approval_level INTEGER,
  approved_flights NUMERIC,
  approved_accommodation_per_night NUMERIC,
  approved_meals_per_day NUMERIC,
  approved_transport NUMERIC,
  approved_other NUMERIC,
  approved_total_ils NUMERIC,
  employee_notes TEXT,
  submitted_at TIMESTAMPTZ,
  final_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: travel_request_status
-- 'draft', 'pending_approval', 'approved', 'partially_approved', 'rejected', 'cancelled'
```

#### 8. `travel_request_approvals` - אישורי בקשות נסיעה
```sql
CREATE TABLE travel_request_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
  approver_id UUID NOT NULL,
  approval_level INTEGER DEFAULT 1,
  status approval_status DEFAULT 'pending',
  comments TEXT,
  approved_flights NUMERIC,
  approved_accommodation_per_night NUMERIC,
  approved_meals_per_day NUMERIC,
  approved_transport NUMERIC,
  approved_other NUMERIC,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: approval_status
-- 'pending', 'approved', 'rejected', 'skipped'
```

#### 9. `travel_request_violations` - חריגות מדיניות
```sql
CREATE TABLE travel_request_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
  category expense_category NOT NULL,
  requested_amount NUMERIC NOT NULL,
  policy_limit NUMERIC NOT NULL,
  overage_amount NUMERIC NOT NULL,
  overage_percentage NUMERIC NOT NULL,
  employee_explanation TEXT,
  requires_special_approval BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 10. `approved_travels` - נסיעות מאושרות
```sql
CREATE TABLE approved_travels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_request_id UUID NOT NULL UNIQUE REFERENCES travel_requests(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  approval_number TEXT NOT NULL, -- e.g., 'TR-2024-0001'
  approved_budget JSONB DEFAULT '{}',
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  expense_report_id UUID REFERENCES reports(id),
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 11. `travel_request_attachments` - קבצים מצורפים
```sql
CREATE TABLE travel_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  category TEXT DEFAULT 'general', -- 'general', 'quote', 'invitation'
  link_url TEXT,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 12. `employee_grades` - דרגות עובדים
```sql
CREATE TABLE employee_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  level INTEGER NOT NULL, -- 1=lowest, 5=highest
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 13. `travel_policy_rules` - כללי מדיניות נסיעות
```sql
CREATE TABLE travel_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  category expense_category NOT NULL,
  grade_id UUID REFERENCES employee_grades(id), -- NULL = applies to all
  max_amount NUMERIC,
  currency expense_currency DEFAULT 'USD',
  destination_type destination_type DEFAULT 'all',
  destination_countries TEXT[],
  per_type policy_rule_per_type DEFAULT 'per_trip',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: destination_type
-- 'domestic', 'international', 'all'

-- ENUM: policy_rule_per_type
-- 'per_trip', 'per_day', 'per_night'
```

#### 14. `travel_policy_restrictions` - הגבלות מדיניות
```sql
CREATE TABLE travel_policy_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  category expense_category, -- NULL = all categories
  keywords TEXT[],
  action_type policy_action_type DEFAULT 'warn',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: policy_action_type
-- 'block', 'warn', 'require_approval'
```

#### 15. `custom_travel_rules` - כללים מותאמים
```sql
CREATE TABLE custom_travel_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  rule_name TEXT NOT NULL,
  description TEXT,
  condition_json JSONB DEFAULT '{}',
  action_type policy_action_type DEFAULT 'warn',
  applies_to_grades TEXT[],
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 16. `approval_chain_configs` - הגדרות שרשרת אישורים
```sql
CREATE TABLE approval_chain_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 17. `approval_chain_levels` - רמות שרשרת אישורים
```sql
CREATE TABLE approval_chain_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES approval_chain_configs(id) ON DELETE CASCADE,
  level_order INTEGER NOT NULL,
  level_type approval_level_type NOT NULL,
  specific_user_id UUID,
  is_required BOOLEAN DEFAULT TRUE,
  can_skip_if_approved_amount_under NUMERIC,
  custom_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: approval_level_type
-- 'direct_manager', 'org_admin', 'accounting_manager', 'specific_user'
```

#### 18. `grade_chain_assignments` - הקצאת שרשראות לדרגות
```sql
CREATE TABLE grade_chain_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  grade_id UUID REFERENCES employee_grades(id),
  chain_id UUID NOT NULL REFERENCES approval_chain_configs(id),
  min_amount NUMERIC,
  max_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 19. `invitation_codes` - קודי הזמנה
```sql
CREATE TABLE invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL UNIQUE,
  role app_role DEFAULT 'user',
  manager_id UUID REFERENCES profiles(id),
  grade_id UUID REFERENCES employee_grades(id),
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 20. `bootstrap_tokens` - טוקנים להקמה ראשונית
```sql
CREATE TABLE bootstrap_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 21. `notifications` - התראות
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  report_id UUID REFERENCES reports(id),
  travel_request_id UUID REFERENCES travel_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 22. `accounting_comments` - תגובות הנהלת חשבונות
```sql
CREATE TABLE accounting_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  comment_text TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 23. `accounting_send_history` - היסטוריית שליחות להנה"ח
```sql
CREATE TABLE accounting_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  sent_by UUID NOT NULL,
  sent_to_user_id UUID,
  sent_to_email TEXT NOT NULL,
  sent_to_name TEXT,
  send_method TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 24. `report_history` - היסטוריית דוחות
```sql
CREATE TABLE report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  performed_by UUID NOT NULL REFERENCES profiles(id),
  action report_action NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ENUM: report_action
-- 'created', 'updated', 'submitted', 'approved', 'rejected', etc.
```

#### 25. `report_comments` - תגובות על דוחות
```sql
CREATE TABLE report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 26. `report_preferences` - העדפות דוחות
```sql
CREATE TABLE report_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 27. `expense_templates` - תבניות הוצאות
```sql
CREATE TABLE expense_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  template_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category expense_category NOT NULL,
  amount NUMERIC,
  currency expense_currency DEFAULT 'ILS',
  country TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 28. `expense_alerts` - התראות הוצאות
```sql
CREATE TABLE expense_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  threshold_amount NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ
);
```

#### 29. `manager_comment_attachments` - קבצים מצורפים להערות מנהל
```sql
CREATE TABLE manager_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 30. `recipient_lists` - רשימות נמענים
```sql
CREATE TABLE recipient_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  list_name TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 31. `policy_audit_log` - לוג שינויי מדיניות
```sql
CREATE TABLE policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 32. `receipt_analysis_logs` - לוגים של ניתוח קבלות AI
```sql
CREATE TABLE receipt_analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  report_id UUID REFERENCES reports(id),
  expense_id UUID REFERENCES expenses(id),
  image_file_name TEXT,
  image_file_size INTEGER,
  extracted_amount NUMERIC,
  extracted_currency TEXT,
  extracted_date TEXT,
  extracted_description TEXT,
  extracted_category TEXT,
  user_corrected_amount NUMERIC,
  user_corrected_currency TEXT,
  user_corrected_date TEXT,
  user_swapped_day_month BOOLEAN,
  raw_ai_response JSONB,
  device_info TEXT,
  trip_destination TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Views

#### `profiles_limited` - תצוגה מוגבלת של פרופילים
```sql
CREATE VIEW profiles_limited AS
SELECT 
  id,
  full_name,
  username,
  department,
  is_manager,
  manager_id,
  organization_id
FROM profiles;
```

### Database Functions

```sql
-- בדיקת תפקיד
CREATE FUNCTION has_role(_role app_role, _user_id uuid) RETURNS boolean;

-- בדיקה אם מנהל של משתמש
CREATE FUNCTION is_manager_of(target_user_id uuid) RETURNS boolean;

-- קבלת מזהה ארגון
CREATE FUNCTION get_user_organization_id(_user_id uuid) RETURNS uuid;

-- קבלת מזהה מנהל
CREATE FUNCTION get_user_manager_id(_user_id uuid) RETURNS uuid;

-- קבלת עובדי צוות
CREATE FUNCTION get_team_user_ids(_manager_id uuid) RETURNS uuid[];

-- יצירת מספר אישור נסיעה
CREATE FUNCTION generate_travel_approval_number() RETURNS text;

-- בדיקה אם מאשר בקשת נסיעה
CREATE FUNCTION is_travel_request_approver(_travel_request_id uuid, _user_id uuid) RETURNS boolean;

-- בדיקה אם אותו ארגון
CREATE FUNCTION same_organization(_a uuid, _b uuid) RETURNS boolean;

-- בדיקה אם קיים מנהל חשבונות
CREATE FUNCTION accounting_manager_exists() RETURNS boolean;
```

### Storage Buckets

| Bucket | תיאור | גישה |
|--------|--------|------|
| `receipts` | קבלות | Private |
| `manager-attachments` | קבצים מנהל | Private |
| `travel-attachments` | קבצי בקשות נסיעה | Private |

---

## ⚡ Edge Functions

### 1. `analyze-receipt` - ניתוח קבלות AI
```typescript
// מקבל: base64 image, tripDestination
// מחזיר: { amount, currency, date, category, description }
// משתמש ב-Lovable AI Gateway
```

### 2. `approve-report` - אישור דוח
```typescript
// מקבל: token, action ('approve'|'reject'), comments
// מעדכן סטטוס דוח
// שולח התראות
```

### 3. `bootstrap-token` - יצירת טוקן הקמה
```typescript
// מקבל: notes, expiresIn
// מחזיר: token string
```

### 4. `create-user` - יצירת משתמש
```typescript
// מקבל: email, fullName, department, role, managerId
// יוצר משתמש ב-auth + profile
// שולח מייל עם סיסמה זמנית
// דורש: accounting_manager role
```

### 5. `extract-policy-text` - חילוץ מדיניות מתמונה
```typescript
// מקבל: imageBase64, fileType
// מחזיר: מערך כללי מדיניות
// משתמש ב-Lovable AI Gateway
```

### 6. `get-exchange-rates` - שערי חליפין
```typescript
// מקבל: (ללא פרמטרים)
// מחזיר: { rates: { USD: number, EUR: number, ... } }
// מקור: Bank of Israel API
// fallback: שערים קבועים
```

### 7. `notify-accounting-comment` - התראה על תגובת הנה"ח
```typescript
// מקבל: reportId, commentText, commentAuthor
// שולח מייל לעובד ולמנהל
```

### 8. `notify-approval-skipped` - התראה על דילוג אישור
```typescript
// מקבל: travelRequestId, skippedLevel, reason
// שולח מייל למגיש הבקשה
```

### 9. `notify-employee-review` - התראה לעובד על סקירה
```typescript
// מקבל: reportId, reviewType
// שולח מייל לעובד
```

### 10. `notify-manager-new-employee` - התראה על עובד חדש
```typescript
// מקבל: employeeName, employeeEmail, managerId
// שולח מייל למנהל
```

### 11. `notify-missing-grades` - התראה על דרגות חסרות
```typescript
// מקבל: organizationId, userIds
// שולח מייל למנהל ארגון
```

### 12. `notify-travel-decision` - התראה על החלטה בנסיעה
```typescript
// מקבל: travelRequestId, decision, comments
// שולח מייל למגיש הבקשה
```

### 13. `notify-travel-request` - התראה על בקשת נסיעה חדשה
```typescript
// מקבל: travelRequestId, approverId
// שולח מייל למאשר
```

### 14. `request-add-employee` - בקשה להוספת עובד
```typescript
// מקבל: managerName, managerEmail, employeeDetails, notes
// שולח מייל למנהל חשבונות
```

### 15. `request-report-approval` - בקשת אישור דוח
```typescript
// מקבל: reportId, managerId
// יוצר טוקן אישור
// שולח מייל למנהל
```

### 16. `reset-user-password` - איפוס סיסמה
```typescript
// מקבל: user_id
// יוצר סיסמה חדשה
// שולח מייל למשתמש
// דורש: accounting_manager role
```

### 17. `send-accounting-report` - שליחת דוח להנה"ח
```typescript
// מקבל: reportId, recipientEmails, pdfBase64
// שולח מייל עם PDF מצורף
```

### 18. `send-invitation-email` - שליחת הזמנה
```typescript
// מקבל: email, invitationCode, organizationName
// שולח מייל הזמנה להרשמה
```

### 19. `send-report-email` - שליחת דוח
```typescript
// מקבל: recipientEmails, reportId, pdfBase64, reportData
// שולח מייל עם PDF מצורף
```

---

## 🔒 אבטחה

### Row-Level Security (RLS) Policies

כל הטבלאות מוגנות ב-RLS. דוגמאות:

#### profiles
```sql
-- Users can read own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Managers can read team profiles
CREATE POLICY "Managers can read team profiles"
  ON profiles FOR SELECT
  USING (is_manager_of(id));

-- Accounting managers can read all
CREATE POLICY "Accounting managers can read all"
  ON profiles FOR SELECT
  USING (has_role('accounting_manager', auth.uid()));
```

#### reports
```sql
-- Users can CRUD own reports
CREATE POLICY "Users can CRUD own reports"
  ON reports FOR ALL
  USING (auth.uid() = user_id);

-- Managers can read team reports
CREATE POLICY "Managers can read team reports"
  ON reports FOR SELECT
  USING (is_manager_of(user_id));
```

### Authentication Flow
1. משתמש נרשם/מתחבר דרך Supabase Auth
2. Trigger יוצר רשומה ב-profiles
3. תפקידים נקבעים ב-user_roles
4. RLS Policies מגבילות גישה לנתונים

---

## 🎨 קומפוננטות UI

### Shadcn/UI Components (40+)
- Accordion, Alert, AlertDialog
- Avatar, Badge, Breadcrumb
- Button, Calendar, Card
- Carousel, Checkbox, Collapsible
- Command, ContextMenu, Dialog
- Drawer, DropdownMenu, Form
- HoverCard, Input, InputOTP
- Label, Menubar, NavigationMenu
- Pagination, Popover, Progress
- RadioGroup, Resizable, ScrollArea
- Select, Separator, Sheet
- Sidebar, Skeleton, Slider
- Sonner, Switch, Table
- Tabs, Textarea, Toast
- Toggle, ToggleGroup, Tooltip

### Custom Components
| Component | תיאור |
|-----------|--------|
| `AccountingComments` | תגובות הנהלת חשבונות |
| `BudgetComparisonCard` | השוואת תקציב |
| `DuplicateExpenseDetector` | זיהוי כפילויות |
| `ExpenseTemplatesManager` | ניהול תבניות |
| `InstallBanner` | באנר התקנת PWA |
| `ManagerExpenseReview` | סקירת הוצאות |
| `NotificationBell` | פעמון התראות |
| `PasswordStrengthIndicator` | מד חוזק סיסמה |
| `RequireAuth` | הגנת דפים |
| `SendToAccountingDialog` | שליחה להנה"ח |
| `StatusBadge` | תג סטטוס צבעוני |

### Policy Components
| Component | תיאור |
|-----------|--------|
| `ApprovalChainManager` | ניהול שרשראות אישור |
| `CategoryRulesManager` | ניהול תקרות קטגוריות |
| `CustomRulesManager` | כללים מותאמים |
| `EmployeeGradesManager` | ניהול דרגות |
| `PolicyAuditLog` | לוג שינויים |
| `PolicyDashboard` | דשבורד מדיניות |
| `PolicyPreview` | תצוגה מקדימה |
| `RestrictionsManager` | ניהול הגבלות |

---

## 🛤️ דפים וניתוב

### Routes מלאות

```typescript
// Public
"/"                           // Dashboard
"/about"                      // About system

// Auth
"/auth/login"                 // Login
"/auth/forgot-password"       // Forgot password
"/auth/reset-password"        // Reset password
"/auth/register"              // Register selection
"/auth/register/employee"     // Employee registration
"/auth/register/manager"      // Manager registration
"/auth/register/code"         // Registration with code
"/auth/register/bootstrap"    // Bootstrap registration
"/auth/register/independent"  // Independent registration

// Reports
"/reports/new"                // New report
"/reports/:id"                // View report
"/approve-report/:token"      // Approve report (external)

// Travel
"/travel-requests"            // Travel requests list
"/travel-requests/new"        // New travel request
"/travel-requests/:id"        // View travel request
"/travel-requests/pending"    // Pending approvals
"/approved-travels"           // Approved travels
"/travel/my-approval-history" // My approval history

// Manager
"/manager/dashboard"          // Manager dashboard
"/manager/team"               // My team
"/manager/stats"              // Team stats
"/manager/personal-stats"     // Personal stats
"/manager/travel-stats"       // Travel stats
"/manager/advanced-reports"   // Advanced reports

// Accounting
"/accounting/home"            // Accounting home
"/accounting/dashboard"       // Dashboard
"/accounting/stats"           // Stats
"/accounting/organizational-analytics" // Org analytics
"/accounting/reimbursements"  // Reimbursements
"/accounting/users"           // Manage users
"/accounting/templates"       // Expense templates
"/accounting/ai-analytics"    // AI analytics
"/accounting/bootstrap-tokens" // Bootstrap tokens

// Org Admin
"/orgadmin"                   // Org admin dashboard
"/orgadmin/invitation-codes"  // Invitation codes
"/orgadmin/users"             // Manage users
"/orgadmin/analytics"         // Analytics
"/orgadmin/travel-policy"     // Travel policy builder

// Admin
"/admin"                      // Admin dashboard
"/admin/roles"                // Manage roles
"/admin/manage-users"         // Manage users
"/admin/organizations"        // Manage organizations
"/admin/org-dashboard"        // Organization dashboard
"/admin/database-diagram"     // Database diagram

// Other
"/policy/my-travel-policy"    // My travel policy
"/analytics"                  // Expense analytics
"/install"                    // Install PWA
```

---

## 🪝 Hooks מותאמים

```typescript
// use-mobile.tsx
export function useIsMobile(): boolean;

// use-toast.ts
export function useToast(): {
  toast: (options: ToastOptions) => void;
  dismiss: (toastId?: string) => void;
  toasts: Toast[];
};

// usePolicyAuditLog.ts
export function usePolicyAuditLog(organizationId: string): {
  logs: AuditLog[];
  isLoading: boolean;
  logAction: (params: LogActionParams) => Promise<void>;
};

// useScrollAnimation.ts
export function useScrollAnimation(): {
  ref: RefObject<HTMLElement>;
  isVisible: boolean;
};
```

---

## 🔧 Context

### AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata: UserMetadata) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isManager: boolean;
  isAccountingManager: boolean;
  isOrgAdmin: boolean;
  isAdmin: boolean;
}

// Usage
const { user, profile, hasRole, signOut } = useAuth();
```

---

## 🧰 Utilities

### lib/utils.ts
```typescript
// Class name merge
export function cn(...inputs: ClassValue[]): string;
```

### utils/imageDataUrl.ts
```typescript
// Convert image to data URL
export async function imageToDataUrl(file: File): Promise<string>;
```

### utils/pdfToImage.ts
```typescript
// Convert PDF to images
export async function pdfToImages(file: File): Promise<string[]>;
```

---

## 📧 Secrets (Environment Variables)

| Secret | תיאור | שימוש |
|--------|--------|-------|
| `SUPABASE_URL` | Supabase URL | Auto-configured |
| `SUPABASE_ANON_KEY` | Supabase Anon Key | Auto-configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | Edge Functions |
| `RESEND_API_KEY` | Resend API Key | Email sending |
| `LOVABLE_API_KEY` | Lovable AI Gateway | AI features |

---

## 📱 PWA Support

האפליקציה תומכת בהתקנה כ-PWA:
- Service Worker
- Manifest
- Offline support (partial)
- Add to home screen
- Push notifications (future)

---

## 📊 סיכום סטטיסטי

| קטגוריה | כמות |
|---------|------|
| טבלאות DB | 32+ |
| Edge Functions | 19 |
| דפים | 45+ |
| קומפוננטות UI | 40+ |
| קומפוננטות מותאמות | 20+ |
| Hooks | 4 |
| Storage Buckets | 3 |
| מטבעות נתמכים | 50+ |
| תפקידי משתמש | 5 |

---

## 🔄 תאריך עדכון אחרון

**18 בינואר 2026**

---

## 📝 הערות נוספות

1. **אבטחה**: כל הטבלאות מוגנות ב-RLS
2. **ביצועים**: שימוש ב-TanStack Query לקאשינג
3. **RTL**: תמיכה מלאה בעברית
4. **Responsive**: עיצוב מותאם לכל המסכים
5. **Accessibility**: שימוש ב-Radix UI Primitives

---

*מסמך זה נוצר אוטומטית ומתעד את כל הקוד והארכיטקטורה של המערכת.*
