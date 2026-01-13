# מסמך תיעוד Backend - מערכת ניהול הוצאות ונסיעות עסקיות

## סקירה כללית

מערכת זו בנויה על גבי Lovable Cloud (Supabase) ומספקת פתרון מקיף לניהול הוצאות ונסיעות עסקיות. המערכת כוללת אימות משתמשים, מסד נתונים מאובטח עם Row-Level Security (RLS), אחסון קבצים, ו-Edge Functions לפונקציונליות צד-שרת.

---

## 📊 טבלאות מסד הנתונים

### 1. `profiles` - פרופילי משתמשים
**תיאור:** מאחסן מידע מורחב על משתמשים מעבר לנתוני ההזדהות הבסיסיים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) - מקושר ל-auth.users |
| `username` | text | שם משתמש / אימייל |
| `email` | text | כתובת אימייל |
| `full_name` | text | שם מלא |
| `employee_id` | text | מספר עובד |
| `department` | text | מחלקה |
| `is_manager` | boolean | האם מנהל |
| `manager_id` | uuid | מזהה המנהל הישיר |
| `organization_id` | uuid | מזהה הארגון |
| `grade_id` | uuid | דרגת עובד (לחישוב תקרות) |
| `accounting_manager_email` | text | אימייל מנהל חשבונות |
| `role` | app_role | תפקיד (deprecated) |
| `created_at` | timestamp | תאריך יצירה |

**מדיניות אבטחה (RLS):**
- משתמשים יכולים לראות ולעדכן את הפרופיל שלהם
- מנהלים יכולים לראות פרופילים של עובדים שלהם
- מנהלי חשבונות יכולים לראות ולעדכן כל הפרופילים
- מנהלי ארגון יכולים לראות ולעדכן משתמשים בארגון שלהם
- אדמינים יכולים לראות כל הפרופילים

---

### 2. `user_roles` - תפקידי משתמשים
**תיאור:** מאחסן את התפקידים המוקצים לכל משתמש (תומך בריבוי תפקידים).

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | מזהה המשתמש |
| `role` | app_role | התפקיד |
| `created_at` | timestamp | תאריך הקצאה |

**ערכי app_role אפשריים:**
- `user` - משתמש רגיל / עובד
- `manager` - מנהל
- `accounting_manager` - מנהל חשבונות
- `org_admin` - מנהל ארגון
- `admin` - אדמין מערכת

**מדיניות אבטחה (RLS):**
- משתמשים יכולים לראות את התפקידים שלהם
- משתמשים יכולים להוסיף תפקיד לעצמם בהרשמה
- מנהלי חשבונות ואדמינים יכולים לנהל כל התפקידים
- מנהלי ארגון יכולים לנהל תפקידים למשתמשים בארגון שלהם

---

### 3. `organizations` - ארגונים
**תיאור:** מאחסן מידע על ארגונים במערכת.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `name` | text | שם הארגון |
| `description` | text | תיאור |
| `is_active` | boolean | האם פעיל |
| `accounting_type` | text | סוג הנהלת חשבונות ('internal'/'external') |
| `external_accounting_email` | text | אימייל הנה"ח חיצונית |
| `external_accounting_name` | text | שם הנה"ח חיצונית |
| `created_by` | uuid | מי יצר |
| `created_at` | timestamp | תאריך יצירה |
| `updated_at` | timestamp | תאריך עדכון |

**מדיניות אבטחה (RLS):**
- אדמינים יכולים לנהל כל הארגונים
- מנהלי ארגון יכולים לראות ולעדכן את הארגון שלהם
- משתמשים יכולים לראות את הארגון שלהם

---

### 4. `reports` - דוחות הוצאות
**תיאור:** דוח הוצאות מייצג נסיעת עסקים עם כל ההוצאות הקשורות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | בעל הדוח |
| `trip_destination` | text | יעד הנסיעה |
| `trip_purpose` | text | מטרת הנסיעה |
| `trip_start_date` | date | תאריך התחלה |
| `trip_end_date` | date | תאריך סיום |
| `status` | expense_status | סטטוס הדוח |
| `total_amount_ils` | numeric | סכום כולל בש"ח |
| `daily_allowance` | numeric | אש"ל יומי |
| `allowance_days` | integer | מספר ימי אש"ל |
| `notes` | text | הערות |
| `manager_approval_token` | text | טוקן אישור מנהל |
| `manager_general_comment` | text | הערת מנהל כללית |
| `rejection_reason` | text | סיבת דחייה |
| `submitted_at` | timestamp | תאריך הגשה |
| `approved_at` | timestamp | תאריך אישור |
| `approved_by` | uuid | מי אישר |
| `manager_approval_requested_at` | timestamp | מתי נשלח למנהל |
| `reimbursement_paid` | boolean | האם שולם |
| `reimbursement_paid_at` | timestamp | תאריך תשלום |
| `reimbursement_paid_by` | uuid | מי שילם |

**ערכי expense_status אפשריים:**
- `open` - פתוח (טיוטה)
- `pending_approval` - ממתין לאישור מנהל
- `closed` - אושר וסגור

**מדיניות אבטחה (RLS):**
- משתמשים יכולים לנהל את הדוחות שלהם
- מנהלים יכולים לראות ולעדכן דוחות של הצוות שלהם
- מנהלי חשבונות יכולים לראות כל הדוחות
- מנהלי ארגון יכולים לראות דוחות מהארגון שלהם

---

### 5. `expenses` - הוצאות
**תיאור:** הוצאה בודדת בתוך דוח הוצאות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `report_id` | uuid | מזהה הדוח |
| `expense_date` | date | תאריך ההוצאה |
| `category` | expense_category | קטגוריה |
| `description` | text | תיאור |
| `amount` | numeric | סכום |
| `currency` | expense_currency | מטבע |
| `amount_in_ils` | numeric | סכום בש"ח |
| `payment_method` | payment_method | אמצעי תשלום |
| `notes` | text | הערות |
| `approval_status` | expense_approval_status | סטטוס אישור |
| `manager_comment` | text | הערת מנהל |
| `employee_reply` | text | תגובת עובד |
| `employee_reply_at` | timestamp | תאריך תגובה |
| `reviewed_by` | uuid | מי סקר |
| `reviewed_at` | timestamp | תאריך סקירה |

**ערכי expense_category:**
- `flights` - טיסות
- `accommodation` - לינה
- `car_rental` - השכרת רכב
- `fuel` - דלק
- `taxi_uber` - מוניות/אובר
- `public_transport` - תחבורה ציבורית
- `meals` - ארוחות
- `conference_fee` - דמי כנס
- `internet_phone` - אינטרנט/טלפון
- `office_supplies` - ציוד משרדי
- `other` - אחר

**ערכי expense_currency:**
- `ILS`, `USD`, `EUR`, `GBP`, `CHF`, `CAD`, `AUD`, `JPY`, `CNY`, ועוד (50+ מטבעות)

**ערכי payment_method:**
- `out_of_pocket` - מכיס
- `company_card` - כרטיס חברה
- `bank_transfer` - העברה בנקאית

**ערכי expense_approval_status:**
- `pending` - ממתין
- `approved` - אושר
- `rejected` - נדחה

---

### 6. `receipts` - קבלות
**תיאור:** קבלות מצורפות להוצאות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `expense_id` | uuid | מזהה ההוצאה |
| `file_name` | text | שם הקובץ |
| `file_type` | text | סוג הקובץ |
| `file_url` | text | כתובת הקובץ |
| `file_size` | integer | גודל הקובץ |
| `is_ai_analyzed` | boolean | האם נותח ע"י AI |
| `ai_analysis_result` | jsonb | תוצאת ניתוח AI |
| `is_approved` | boolean | האם אושר |
| `uploaded_at` | timestamp | תאריך העלאה |

---

### 7. `travel_requests` - בקשות נסיעה
**תיאור:** בקשה לאישור נסיעה עסקית לפני הנסיעה.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `requested_by` | uuid | מגיש הבקשה |
| `destination_city` | text | עיר יעד |
| `destination_country` | text | מדינת יעד |
| `purpose` | text | מטרה |
| `purpose_details` | text | פרטי מטרה |
| `start_date` | date | תאריך התחלה |
| `end_date` | date | תאריך סיום |
| `nights` | integer | מספר לילות |
| `days` | integer | מספר ימים |
| `estimated_flights` | numeric | הערכת טיסות |
| `estimated_flights_currency` | expense_currency | מטבע טיסות |
| `estimated_accommodation_per_night` | numeric | הערכת לינה ללילה |
| `estimated_accommodation_currency` | expense_currency | מטבע לינה |
| `estimated_meals_per_day` | numeric | הערכת ארוחות ליום |
| `estimated_meals_currency` | expense_currency | מטבע ארוחות |
| `estimated_transport` | numeric | הערכת תחבורה |
| `estimated_transport_currency` | expense_currency | מטבע תחבורה |
| `estimated_other` | numeric | הערכת אחר |
| `estimated_other_currency` | expense_currency | מטבע אחר |
| `estimated_total_ils` | numeric | סה"כ משוער בש"ח |
| `status` | travel_request_status | סטטוס |
| `current_approval_level` | integer | רמת אישור נוכחית |
| `approved_flights/accommodation/meals/transport/other` | numeric | סכומים מאושרים |
| `approved_total_ils` | numeric | סה"כ מאושר בש"ח |
| `employee_notes` | text | הערות עובד |
| `submitted_at` | timestamp | תאריך הגשה |
| `final_decision_at` | timestamp | תאריך החלטה סופית |

**ערכי travel_request_status:**
- `draft` - טיוטה
- `pending_approval` - ממתין לאישור
- `approved` - אושר
- `partially_approved` - אושר חלקית
- `rejected` - נדחה
- `cancelled` - בוטל

---

### 8. `travel_request_approvals` - אישורי בקשות נסיעה
**תיאור:** רישום של כל שלב באישור בקשת נסיעה (שרשרת אישורים).

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `travel_request_id` | uuid | מזהה הבקשה |
| `approver_id` | uuid | מזהה המאשר |
| `approval_level` | integer | רמת האישור |
| `status` | approval_status | סטטוס |
| `comments` | text | הערות |
| `approved_flights/accommodation/meals/transport/other` | numeric | סכומים מאושרים |
| `decided_at` | timestamp | תאריך החלטה |

**ערכי approval_status:**
- `pending` - ממתין
- `approved` - אושר
- `rejected` - נדחה
- `skipped` - דולג

---

### 9. `travel_request_violations` - חריגות מדיניות
**תיאור:** רישום חריגות מדיניות בבקשות נסיעה.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `travel_request_id` | uuid | מזהה הבקשה |
| `category` | expense_category | קטגוריה |
| `requested_amount` | numeric | סכום מבוקש |
| `policy_limit` | numeric | מגבלת מדיניות |
| `overage_amount` | numeric | סכום חריגה |
| `overage_percentage` | numeric | אחוז חריגה |
| `employee_explanation` | text | הסבר עובד |
| `requires_special_approval` | boolean | דורש אישור מיוחד |
| `is_resolved` | boolean | האם טופל |
| `resolved_by` | uuid | מי טיפל |
| `resolved_at` | timestamp | תאריך טיפול |

---

### 10. `approved_travels` - נסיעות מאושרות
**תיאור:** נסיעות שאושרו וקיבלו מספר אישור ייחודי.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `travel_request_id` | uuid | מזהה הבקשה |
| `organization_id` | uuid | מזהה הארגון |
| `approval_number` | text | מספר אישור (TR-2024-0001) |
| `approved_budget` | jsonb | תקציב מאושר |
| `valid_from` | date | תקף מתאריך |
| `valid_until` | date | תקף עד תאריך |
| `expense_report_id` | uuid | דוח הוצאות מקושר |
| `is_used` | boolean | האם נוצל |

---

### 11. `travel_request_attachments` - קבצים מצורפים לבקשות נסיעה
**תיאור:** קבצים ומסמכים מצורפים לבקשות נסיעה.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `travel_request_id` | uuid | מזהה הבקשה |
| `uploaded_by` | uuid | מי העלה |
| `file_name` | text | שם הקובץ |
| `file_url` | text | כתובת הקובץ |
| `file_type` | text | סוג הקובץ |
| `file_size` | integer | גודל הקובץ |
| `category` | text | קטגוריה ('general'/'quote'/'invitation') |
| `link_url` | text | קישור חיצוני |
| `notes` | text | הערות |
| `uploaded_at` | timestamp | תאריך העלאה |

---

### 12. `employee_grades` - דרגות עובדים
**תיאור:** הגדרת דרגות עובדים לצורך חישוב תקרות הוצאות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `name` | text | שם הדרגה |
| `level` | integer | רמה (1=נמוך, 5=גבוה) |
| `description` | text | תיאור |
| `is_active` | boolean | האם פעילה |
| `created_by` | uuid | מי יצר |

---

### 13. `travel_policy_rules` - כללי מדיניות נסיעות
**תיאור:** הגדרת תקרות והגבלות לפי קטגוריה, דרגה ויעד.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `category` | expense_category | קטגוריית הוצאה |
| `grade_id` | uuid | דרגת עובד (null = כולם) |
| `max_amount` | numeric | סכום מקסימלי |
| `currency` | expense_currency | מטבע |
| `destination_type` | destination_type | סוג יעד |
| `destination_countries` | text[] | מדינות ספציפיות |
| `per_type` | policy_rule_per_type | לפי מה |
| `notes` | text | הערות |
| `is_active` | boolean | האם פעיל |
| `created_by` | uuid | מי יצר |

**ערכי destination_type:**
- `all` - כל היעדים
- `domestic` - בארץ
- `international` - בחו"ל
- `specific_countries` - מדינות ספציפיות

**ערכי policy_rule_per_type:**
- `per_trip` - לנסיעה
- `per_day` - ליום
- `per_night` - ללילה

---

### 14. `travel_policy_restrictions` - הגבלות מדיניות
**תיאור:** הגבלות וחסימות על סוגי הוצאות מסוימים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `name` | text | שם ההגבלה |
| `description` | text | תיאור |
| `category` | expense_category | קטגוריה (null = כולן) |
| `keywords` | text[] | מילות מפתח |
| `action_type` | policy_action_type | סוג פעולה |
| `is_active` | boolean | האם פעיל |
| `created_by` | uuid | מי יצר |

**ערכי policy_action_type:**
- `block` - חסום
- `warn` - התראה
- `require_approval` - דורש אישור מיוחד

---

### 15. `custom_travel_rules` - כללים מותאמים אישית
**תיאור:** כללים מורכבים עם תנאים מותאמים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `rule_name` | text | שם הכלל |
| `description` | text | תיאור |
| `condition_json` | jsonb | תנאים (JSON) |
| `action_type` | policy_action_type | סוג פעולה |
| `applies_to_grades` | uuid[] | דרגות רלוונטיות |
| `priority` | integer | עדיפות |
| `is_active` | boolean | האם פעיל |
| `created_by` | uuid | מי יצר |

---

### 16. `approval_chain_configs` - הגדרות שרשרת אישורים
**תיאור:** הגדרת שרשראות אישור שונות לארגון.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `name` | text | שם השרשרת |
| `description` | text | תיאור |
| `is_active` | boolean | האם פעילה |
| `is_default` | boolean | האם ברירת מחדל |
| `created_by` | uuid | מי יצר |

---

### 17. `approval_chain_levels` - רמות בשרשרת אישורים
**תיאור:** הגדרת כל רמה בשרשרת האישורים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `chain_id` | uuid | מזהה השרשרת |
| `level_order` | integer | סדר הרמה |
| `level_type` | approval_level_type | סוג הרמה |
| `specific_user_id` | uuid | משתמש ספציפי |
| `is_required` | boolean | האם חובה |
| `can_skip_if_approved_amount_under` | numeric | דילוג אם מתחת לסכום |
| `custom_message` | text | הודעה מותאמת |

**ערכי approval_level_type:**
- `direct_manager` - מנהל ישיר
- `department_head` - ראש מחלקה
- `org_admin` - מנהל ארגון
- `accounting_manager` - מנהל חשבונות
- `specific_user` - משתמש ספציפי

---

### 18. `grade_chain_assignments` - הקצאת שרשראות לדרגות
**תיאור:** קישור בין דרגות עובדים לשרשראות אישורים לפי סכומים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `grade_id` | uuid | דרגת עובד |
| `chain_id` | uuid | שרשרת אישורים |
| `min_amount` | numeric | סכום מינימלי |
| `max_amount` | numeric | סכום מקסימלי |

---

### 19. `invitation_codes` - קודי הזמנה
**תיאור:** קודים להזמנת משתמשים חדשים לארגון.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `code` | text | קוד ההזמנה |
| `role` | app_role | תפקיד שיוקצה |
| `manager_id` | uuid | מנהל שיוקצה |
| `grade_id` | uuid | דרגה שתוקצה |
| `max_uses` | integer | מקסימום שימושים |
| `use_count` | integer | מספר שימושים |
| `is_used` | boolean | האם נוצל |
| `used_by` | uuid | מי השתמש |
| `used_at` | timestamp | תאריך שימוש |
| `expires_at` | timestamp | תאריך תפוגה |
| `notes` | text | הערות |
| `created_by` | uuid | מי יצר |

---

### 20. `bootstrap_tokens` - טוקנים ראשוניים
**תיאור:** טוקנים ליצירת מנהל חשבונות ראשון במערכת.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `token` | text | הטוקן |
| `is_used` | boolean | האם נוצל |
| `used_by` | uuid | מי השתמש |
| `used_at` | timestamp | תאריך שימוש |
| `expires_at` | timestamp | תאריך תפוגה |
| `notes` | text | הערות |

---

### 21. `notifications` - התראות
**תיאור:** התראות למשתמשים על אירועים במערכת.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | למי ההתראה |
| `type` | text | סוג ההתראה |
| `title` | text | כותרת |
| `message` | text | הודעה |
| `report_id` | uuid | דוח קשור |
| `travel_request_id` | uuid | בקשת נסיעה קשורה |
| `is_read` | boolean | האם נקראה |
| `created_at` | timestamp | תאריך יצירה |

---

### 22. `report_history` - היסטוריית דוחות
**תיאור:** רישום פעולות על דוחות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `report_id` | uuid | מזהה הדוח |
| `action` | report_history_action | הפעולה |
| `performed_by` | uuid | מי ביצע |
| `notes` | text | הערות |
| `timestamp` | timestamp | תאריך ביצוע |

**ערכי report_history_action:**
- `created` - נוצר
- `submitted` - הוגש
- `approved` - אושר
- `rejected` - נדחה
- `returned` - הוחזר לתיקון
- `updated` - עודכן
- `sent_to_accounting` - נשלח להנהלת חשבונות
- `reimbursement_paid` - שולם

---

### 23. `accounting_comments` - הערות הנהלת חשבונות
**תיאור:** הערות מהנהלת חשבונות על דוחות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `report_id` | uuid | מזהה הדוח |
| `comment_text` | text | טקסט ההערה |
| `is_resolved` | boolean | האם טופל |
| `resolved_at` | timestamp | תאריך טיפול |
| `created_by` | uuid | מי כתב |
| `created_at` | timestamp | תאריך יצירה |

---

### 24. `accounting_send_history` - היסטוריית שליחה להנה"ח
**תיאור:** רישום שליחות דוחות להנהלת חשבונות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `report_id` | uuid | מזהה הדוח |
| `sent_by` | uuid | מי שלח |
| `sent_to_email` | text | לאיזה אימייל |
| `sent_to_name` | text | לאיזה שם |
| `sent_to_user_id` | uuid | למי (אם משתמש רשום) |
| `send_method` | text | שיטת שליחה |
| `sent_at` | timestamp | תאריך שליחה |

---

### 25. `manager_comment_attachments` - קבצים מצורפים להערות מנהל
**תיאור:** קבצים שמנהלים מצרפים להערות על הוצאות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `expense_id` | uuid | מזהה ההוצאה |
| `file_name` | text | שם הקובץ |
| `file_url` | text | כתובת הקובץ |
| `file_type` | text | סוג הקובץ |
| `file_size` | integer | גודל הקובץ |
| `uploaded_by` | uuid | מי העלה |
| `uploaded_at` | timestamp | תאריך העלאה |

---

### 26. `expense_templates` - תבניות הוצאות
**תיאור:** תבניות מוכנות להוספת הוצאות נפוצות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `template_name` | text | שם התבנית |
| `description` | text | תיאור |
| `category` | expense_category | קטגוריה |
| `amount` | numeric | סכום |
| `currency` | expense_currency | מטבע |
| `country` | text | מדינה |
| `notes` | text | הערות |
| `is_active` | boolean | האם פעילה |
| `created_by` | uuid | מי יצר |

---

### 27. `expense_alerts` - התראות הוצאות
**תיאור:** הגדרות התראות למשתמשים על הוצאות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | מזהה המשתמש |
| `alert_type` | text | סוג ההתראה |
| `threshold_amount` | numeric | סף סכום |
| `is_active` | boolean | האם פעילה |

---

### 28. `report_preferences` - העדפות דוחות
**תיאור:** העדפות סינון שמורות למשתמשים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | מזהה המשתמש |
| `name` | text | שם ההעדפה |
| `filters` | jsonb | הסינונים (JSON) |

---

### 29. `report_comments` - הערות על דוחות
**תיאור:** הערות כלליות על דוחות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `report_id` | uuid | מזהה הדוח |
| `user_id` | uuid | מי כתב |
| `comment_text` | text | טקסט ההערה |
| `created_at` | timestamp | תאריך יצירה |

---

### 30. `recipient_lists` - רשימות נמענים
**תיאור:** רשימות אימיילים שמורות לשליחת דוחות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | מזהה המשתמש |
| `list_name` | text | שם הרשימה |
| `recipient_emails` | text[] | כתובות אימייל |
| `is_default` | boolean | האם ברירת מחדל |

---

### 31. `policy_audit_log` - לוג ביקורת מדיניות
**תיאור:** רישום שינויים במדיניות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `organization_id` | uuid | מזהה הארגון |
| `user_id` | uuid | מי ביצע |
| `action` | text | הפעולה |
| `entity_type` | text | סוג הישות |
| `entity_id` | uuid | מזהה הישות |
| `entity_name` | text | שם הישות |
| `old_values` | jsonb | ערכים ישנים |
| `new_values` | jsonb | ערכים חדשים |
| `created_at` | timestamp | תאריך ביצוע |

---

### 32. `receipt_analysis_logs` - לוג ניתוח קבלות
**תיאור:** רישום ניתוחי AI של קבלות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה ייחודי (PK) |
| `user_id` | uuid | מזהה המשתמש |
| `receipt_id` | uuid | מזהה הקבלה |
| `analysis_result` | jsonb | תוצאת הניתוח |
| `confidence_score` | numeric | ציון ביטחון |
| `success` | boolean | האם הצליח |
| `error_message` | text | הודעת שגיאה |
| `processing_time_ms` | integer | זמן עיבוד (מילישניות) |
| `created_at` | timestamp | תאריך ניתוח |

---

### View: `profiles_limited` - תצוגה מוגבלת של פרופילים
**תיאור:** תצוגה עם שדות מוגבלים של פרופילים - לשימוש כשצריך רק מידע בסיסי.

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | uuid | מזהה המשתמש |
| `full_name` | text | שם מלא |
| `username` | text | שם משתמש |
| `department` | text | מחלקה |
| `is_manager` | boolean | האם מנהל |
| `manager_id` | uuid | מזהה המנהל |
| `organization_id` | uuid | מזהה הארגון |

---

## ⚙️ פונקציות מסד נתונים

### פונקציות בדיקת הרשאות

| פונקציה | תיאור |
|---------|--------|
| `has_role(user_id, role)` | בודק אם למשתמש יש תפקיד מסוים |
| `is_manager_of(target_user_id)` | בודק אם המשתמש הנוכחי הוא מנהל של המשתמש המבוקש |
| `is_user_a_manager(target_user_id)` | בודק אם משתמש הוא מנהל |
| `same_organization(user_a, user_b)` | בודק אם שני משתמשים באותו ארגון |
| `can_view_full_profile(viewer, profile)` | בודק אם יכול לראות פרופיל מלא |
| `can_view_manager_limited_info(viewer, profile)` | בודק אם יכול לראות מידע מוגבל של מנהל |
| `is_travel_request_approver(user_id, request_id)` | בודק אם משתמש הוא מאשר של בקשת נסיעה |
| `accounting_manager_exists()` | בודק אם קיים מנהל חשבונות במערכת |

### פונקציות שליפת מידע

| פונקציה | תיאור |
|---------|--------|
| `get_user_organization_id(user_id)` | מחזיר מזהה ארגון של משתמש |
| `get_org_id_for_policy(user_id)` | מחזיר מזהה ארגון לשימוש ב-RLS |
| `get_user_manager_id(user_id)` | מחזיר מזהה המנהל של משתמש |
| `get_team_user_ids(manager_id)` | מחזיר רשימת מזהי עובדים של מנהל |

### פונקציות עזר

| פונקציה | תיאור |
|---------|--------|
| `generate_travel_approval_number()` | מייצר מספר אישור נסיעה ייחודי (TR-2024-0001) |
| `update_updated_at_column()` | טריגר לעדכון שדה updated_at |
| `update_organizations_updated_at()` | טריגר לעדכון updated_at בארגונים |
| `handle_new_user()` | טריגר ליצירת פרופיל עבור משתמש חדש |
| `handle_user_role_from_invitation()` | טריגר להקצאת תפקיד מקוד הזמנה |
| `assign_grade_from_invitation()` | טריגר להקצאת דרגה מקוד הזמנה |

---

## 📦 Storage Buckets (אחסון קבצים)

| Bucket | ציבורי | תיאור |
|--------|--------|--------|
| `receipts` | לא | קבלות מצורפות להוצאות |
| `manager-attachments` | לא | קבצים מצורפים להערות מנהלים |
| `travel-attachments` | לא | קבצים מצורפים לבקשות נסיעה |

---

## 🔐 Secrets (סודות מוגדרים)

| Secret | תיאור |
|--------|--------|
| `SUPABASE_URL` | כתובת ה-API של Supabase |
| `SUPABASE_ANON_KEY` | מפתח אנונימי |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח שירות (הרשאות מלאות) |
| `SUPABASE_DB_URL` | כתובת חיבור ישיר למסד נתונים |
| `SUPABASE_PUBLISHABLE_KEY` | מפתח פומבי |
| `LOVABLE_API_KEY` | מפתח API ל-Lovable AI |
| `RESEND_API_KEY` | מפתח API לשליחת אימיילים |

---

## 🚀 Edge Functions (פונקציות צד-שרת)

### שליחת אימיילים

| פונקציה | תיאור |
|---------|--------|
| `send-report-email` | שליחת דוח באימייל עם PDF מצורף |
| `send-accounting-report` | שליחת דוח להנהלת חשבונות |
| `send-invitation-email` | שליחת אימייל הזמנה למשתמש חדש |
| `notify-employee-review` | הודעה לעובד על סקירת הדוח |
| `notify-travel-request` | הודעה על בקשת נסיעה חדשה |
| `notify-travel-decision` | הודעה על החלטה בבקשת נסיעה |
| `notify-approval-skipped` | הודעה על דילוג על שלב אישור |
| `notify-accounting-comment` | הודעה על הערה מהנהלת חשבונות |
| `notify-manager-new-employee` | הודעה למנהל על עובד חדש |
| `notify-missing-grades` | הודעה על עובדים ללא דרגה |

### אישורים ואימות

| פונקציה | תיאור |
|---------|--------|
| `request-report-approval` | בקשת אישור דוח מהמנהל |
| `approve-report` | אישור/דחיית דוח ע"י מנהל |
| `bootstrap-token` | אימות טוקן ראשוני |
| `reset-user-password` | איפוס סיסמת משתמש |

### משתמשים ורישום

| פונקציה | תיאור |
|---------|--------|
| `create-user` | יצירת משתמש חדש (ע"י מנהל חשבונות) |
| `request-add-employee` | בקשה להוספת עובד |

### AI ועזר

| פונקציה | תיאור |
|---------|--------|
| `analyze-receipt` | ניתוח קבלה באמצעות AI |
| `extract-policy-text` | חילוץ כללי מדיניות מתמונה |
| `get-exchange-rates` | קבלת שערי חליפין עדכניים |

---

## 🔒 Row-Level Security (RLS) - עקרונות

המערכת משתמשת ב-RLS נרחב להגנה על הנתונים. העקרונות המרכזיים:

1. **הפרדה לפי משתמש** - כל משתמש יכול לראות רק את הנתונים שלו
2. **היררכיה ארגונית** - מנהלים יכולים לראות את נתוני העובדים שלהם
3. **תפקידים** - תפקידים שונים מקנים הרשאות שונות
4. **ארגון** - הפרדה בין ארגונים שונים
5. **פונקציות עזר** - שימוש בפונקציות כמו `has_role()` ו-`get_team_user_ids()` לבדיקות מורכבות

---

## 📊 ENUMs (ערכים מוגדרים מראש)

### app_role - תפקידי מערכת
```
user, manager, accounting_manager, org_admin, admin
```

### expense_status - סטטוס דוח
```
open, pending_approval, closed
```

### expense_category - קטגוריות הוצאות
```
flights, accommodation, car_rental, fuel, taxi_uber, public_transport,
meals, conference_fee, internet_phone, office_supplies, other
```

### expense_currency - מטבעות (50+)
```
ILS, USD, EUR, GBP, CHF, CAD, AUD, JPY, CNY, INR, ...
```

### payment_method - אמצעי תשלום
```
out_of_pocket, company_card, bank_transfer
```

### expense_approval_status - סטטוס אישור הוצאה
```
pending, approved, rejected
```

### travel_request_status - סטטוס בקשת נסיעה
```
draft, pending_approval, approved, partially_approved, rejected, cancelled
```

### approval_status - סטטוס אישור
```
pending, approved, rejected, skipped
```

### approval_level_type - סוגי רמות אישור
```
direct_manager, department_head, org_admin, accounting_manager, specific_user
```

### destination_type - סוגי יעד
```
all, domestic, international, specific_countries
```

### policy_rule_per_type - לפי מה המדיניות
```
per_trip, per_day, per_night
```

### policy_action_type - סוגי פעולת מדיניות
```
block, warn, require_approval
```

### report_history_action - פעולות היסטוריה
```
created, submitted, approved, rejected, returned, updated, sent_to_accounting, reimbursement_paid
```

---

## 🔄 תרשים יחסים בין טבלאות

```
profiles ─┬── reports ──── expenses ──── receipts
          │           └── report_history
          │           └── report_comments
          │           └── accounting_comments
          │           └── accounting_send_history
          │
          ├── travel_requests ──── travel_request_approvals
          │                   └── travel_request_violations
          │                   └── travel_request_attachments
          │                   └── approved_travels
          │
          ├── user_roles
          │
          └── notifications

organizations ─┬── employee_grades
               ├── travel_policy_rules
               ├── travel_policy_restrictions
               ├── custom_travel_rules
               ├── approval_chain_configs ── approval_chain_levels
               │                         └── grade_chain_assignments
               ├── invitation_codes
               └── policy_audit_log
```

---

## 📝 סיכום

המערכת מספקת:
- ✅ ניהול מלא של משתמשים, תפקידים וארגונים
- ✅ דוחות הוצאות עם תמיכה במולטי-מטבע
- ✅ בקשות נסיעה עם שרשרת אישורים גמישה
- ✅ מדיניות נסיעות מתקדמת עם דרגות עובדים
- ✅ אבטחה מלאה עם RLS
- ✅ אינטגרציית AI לניתוח קבלות
- ✅ מערכת התראות ואימיילים
- ✅ אחסון קבצים מאובטח
