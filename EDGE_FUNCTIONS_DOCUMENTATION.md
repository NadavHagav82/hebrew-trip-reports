# 📡 תיעוד מלא של כל Edge Functions במערכת

> **מסמך זה מתאר את כל 18 הפונקציות הצד-שרת (Edge Functions) שנבנו במערכת,
> מה כל אחת מהן עושה, מה היא מקבלת, מה היא מחזירה, ומתי היא נקראת.**

---

## 🗂️ סקירה כללית – רשימת כל הפונקציות

| # | שם הפונקציה | קטגוריה | מי קורא לה | ייחודיות |
|---|---|---|---|---|
| 1 | `analyze-receipt` | 🤖 AI | Front-end | ניתוח קבלה עם AI |
| 2 | `extract-policy-text` | 🤖 AI | Front-end | חילוץ מדיניות מקובץ PDF |
| 3 | `get-exchange-rates` | 💱 שערי חליפין | Front-end | שערי בנק ישראל |
| 4 | `bootstrap-token` | 🔐 אבטחה | Front-end | יצירת טוקן רישום ראשון |
| 5 | `create-user` | 👤 ניהול משתמשים | Front-end | יצירת משתמש חדש ע"י מנהל |
| 6 | `reset-user-password` | 🔑 ניהול משתמשים | Front-end | איפוס סיסמה |
| 7 | `request-add-employee` | 📧 הודעות | Front-end | בקשת מנהל להוסיף עובד |
| 8 | `send-invitation-email` | 📧 הודעות | Front-end | שליחת הזמנה לרישום |
| 9 | `request-report-approval` | 📧 אישור דוחות | Front-end | בקשת אישור מנהל לדוח |
| 10 | `approve-report` | ✅ אישור דוחות | Front-end | ביצוע אישור/דחייה של דוח |
| 11 | `notify-employee-review` | 📧 הודעות | `approve-report` | הודעה לעובד על תוצאת ביקורת |
| 12 | `send-accounting-report` | 📧 הנהלת חשבונות | `approve-report` | שליחת דוח להנה"ח |
| 13 | `send-report-email` | 📧 דוחות | Front-end | שליחת PDF לכל כתובת |
| 14 | `notify-accounting-comment` | 📧 הודעות | Front-end | הודעה על הערת הנה"ח |
| 15 | `notify-travel-request` | 📧 נסיעות | Front-end | הודעה למאשר על בקשת נסיעה |
| 16 | `notify-travel-decision` | 📧 נסיעות | Front-end | הודעה לעובד על החלטת נסיעה |
| 17 | `notify-approval-skipped` | 📧 נסיעות | Front-end | הודעה על דילוג שלב אישור |
| 18 | `notify-manager-new-employee` | 📧 הודעות | Front-end | הודעה למנהל על עובד חדש |
| 19 | `notify-missing-grades` | 📧 הודעות | Cron / Admin | התראה על עובדים ללא דרגה |

---

## 📋 פירוט מלא לכל פונקציה

---

### 1. 🤖 `analyze-receipt`
**קובץ:** `supabase/functions/analyze-receipt/index.ts`

#### 🎯 מטרה
ניתוח תמונת קבלה/חשבונית בעזרת בינה מלאכותית (Gemini 2.5 Flash) וחילוץ אוטומטי של כל הפרטים הפיננסיים.

#### 📥 קלט (Request Body)
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/...",
  "tripDestination": "פריז, צרפת"
}
```

| שדה | סוג | חובה | תיאור |
|---|---|---|---|
| `imageBase64` | string | ✅ | תמונת הקבלה ב-base64 (JPEG/PNG/WebP/HEIC) עד 10MB |
| `tripDestination` | string | ❌ | יעד הנסיעה – משמש לזיהוי מטבע מקומי |

#### 📤 פלט (Response)
```json
{
  "data": {
    "date": "2025-11-18",
    "amount": 85.50,
    "currency": "EUR",
    "category": "food",
    "description": "ארוחת ערב במסעדה"
  }
}
```

| שדה | תיאור |
|---|---|
| `date` | תאריך הקבלה בפורמט YYYY-MM-DD |
| `amount` | הסכום ללא סימן מטבע |
| `currency` | קוד המטבע (EUR, USD, ILS, ...) |
| `category` | flights / accommodation / food / transportation / miscellaneous |
| `description` | תיאור קצר של הרכישה |

#### 🧠 לוגיקה מיוחדת
- **זיהוי תאריכים:** קיימת לוגיקה מתוחכמת לפתרון עמימות DD/MM vs MM/DD – ישראל ואירופה תמיד DD/MM, רק ארה"ב MM/DD
- **זיהוי מטבע:** מפה של 50+ מדינות לקוד מטבע. מזהה סמלים ($, €, ₪, zł, лв וכו')
- **ברירת מחדל:** אם אין סמל מטבע – לוקח את המטבע המקומי של יעד הנסיעה
- **קטגוריזציה:** על בסיס מילות מפתח מהתמונה (hotel, restaurant, taxi וכו')

#### ⚠️ שגיאות
- `400` – פורמט תמונה לא תקין / קובץ גדול מ-10MB
- `429` – חריגה ממגבלת AI (Rate Limit)
- `402` – חסר קרדיט
- `500` – שגיאה כללית

---

### 2. 🤖 `extract-policy-text`
**קובץ:** `supabase/functions/extract-policy-text/index.ts`
**JWT:** ❌ ללא אימות (פתוח)

#### 🎯 מטרה
קריאת מסמך מדיניות נסיעה (PDF/תמונה) וחילוץ אוטומטי של כל חוקי המדיניות הפיננסיים לפורמט JSON מובנה – לשימוש ב-Policy Builder.

#### 📥 קלט
```json
{
  "imageBase64": "base64string...",
  "fileType": "pdf"
}
```

#### 📤 פלט
```json
{
  "rules": [
    {
      "category": "accommodation",
      "grade": "מנהל",
      "max_amount": 800,
      "currency": "USD",
      "destination_type": "international",
      "per_type": "per_day",
      "notes": "מלון עד 4 כוכבים"
    }
  ]
}
```

| שדה | ערכים אפשריים | תיאור |
|---|---|---|
| `category` | flights, accommodation, food, transportation, miscellaneous | קטגוריית הוצאה |
| `grade` | שם הדרגה / null | הדרגה שאליה חל הכלל |
| `max_amount` | מספר | סכום מקסימלי מותר |
| `currency` | ILS, USD, EUR, ... | מטבע הסכום |
| `destination_type` | domestic, international, all | סוג יעד |
| `per_type` | per_trip, per_day, per_item | תדירות החישוב |
| `notes` | string | הערות נוספות |

#### 🧠 לוגיקה
משתמש ב-Gemini 2.5 Flash עם prompt מפורט שמחפש:
- טבלאות מגבלות הוצאות
- רשימות דיאטנות יומיות
- תקרות תקציב לקטגוריה
- פרקי "מדיניות נסיעות" במסמך

---

### 3. 💱 `get-exchange-rates`
**קובץ:** `supabase/functions/get-exchange-rates/index.ts`

#### 🎯 מטרה
שליפת שערי חליפין עדכניים מ-API של בנק ישראל, לצורך המרת הוצאות מט"ח לשקלים.

#### 📥 קלט
אין body – GET request פשוט

#### 📤 פלט
```json
{
  "success": true,
  "rates": {
    "ILS": 1.0,
    "USD": 3.72,
    "EUR": 3.95,
    "GBP": 4.65,
    "JPY": 0.024,
    ...
  },
  "fallback": false
}
```

#### 🧠 לוגיקה
1. **קריאה ל-API בנק ישראל** – `edge.boi.gov.il/FusionEdgeServer/sdmx-json/v1/...`
2. **מטבעות שבנק ישראל מספק:** USD, EUR, GBP, CHF, JPY, CAD
3. **מטבעות נוספים (50+):** ערכי ברירת מחדל מוגדרים קשיח עבור כל שאר המטבעות
4. **Fallback:** אם ה-API נכשל – מחזיר ערכי ברירת מחדל ומסמן `"fallback": true`

#### 🌍 מטבעות נתמכים
אירופה, אמריקה הלטינית, מזרח רחוק, אפריקה, אוסטרליה, מזרח תיכון – **סה"כ 50+ מטבעות**

---

### 4. 🔐 `bootstrap-token`
**קובץ:** `supabase/functions/bootstrap-token/index.ts`

#### 🎯 מטרה
מנגנון bootstrap לרישום מנהל הנהלת חשבונות הראשון במערכת. מאפשר יצירת, אימות ושימוש בטוקן חד-פעמי מאובטח.

#### 📥 קלט – 3 actions שונים
```json
{ "action": "create", "notes": "טוקן ראשון", "expiryDays": 7 }
{ "action": "validate", "token": "BOOTSTRAP-XXXX-XXXX-XXXX-XXXX" }
{ "action": "use", "token": "BOOTSTRAP-XXXX-XXXX-XXXX-XXXX", "userId": "uuid" }
```

#### 📤 פלט לפי action

**create:**
```json
{
  "success": true,
  "token": "BOOTSTRAP-ABCD-EFGH-IJKL-MNOP",
  "expires_at": "2026-02-25T00:00:00Z",
  "message": "Token created. This is the only time the plain token will be shown."
}
```

**validate:**
```json
{ "valid": true, "tokenId": "uuid" }
```

**use:**
```json
{ "success": true }
```

#### 🔐 אבטחה
- הטוקן נשמר ב-DB **רק כ-SHA-256 hash** – לא הטוקן הגולמי
- הטוקן הגולמי מוצג **פעם אחת בלבד** עם הדפסה
- פורמט: `BOOTSTRAP-XXXX-XXXX-XXXX-XXXX` (Base32 characters)
- פג תוקף ניתן להגדרה (ברירת מחדל 7 ימים)
- action `create` דורש תפקיד `accounting_manager` או `admin`

---

### 5. 👤 `create-user`
**קובץ:** `supabase/functions/create-user/index.ts`

#### 🎯 מטרה
יצירת משתמש חדש במערכת ע"י מנהל הנהלת חשבונות, כולל שליחת פרטי כניסה אוטומטית במייל.

#### 📥 קלט
```json
{
  "email": "employee@company.com",
  "full_name": "ישראל ישראלי",
  "username": "israel",
  "employee_id": "EMP-123",
  "department": "פיתוח",
  "is_manager": false,
  "manager_id": "uuid-of-manager",
  "role": "user"
}
```

| שדה | סוג | תיאור |
|---|---|---|
| `email` | string | כתובת מייל (ייכנס בה לאחר מכן) |
| `full_name` | string | שם מלא |
| `username` | string | שם משתמש ייחודי |
| `employee_id` | string/null | מספר עובד |
| `department` | string | מחלקה |
| `is_manager` | boolean | האם המשתמש הוא מנהל |
| `manager_id` | string/null | UUID של המנהל הישיר |
| `role` | user / manager / accounting_manager | תפקיד במערכת |

#### 📤 פלט
```json
{
  "success": true,
  "user_id": "new-uuid",
  "email": "employee@company.com",
  "message": "משתמש נוצר בהצלחה ופרטי ההתחברות נשלחו במייל"
}
```

#### 🔐 הרשאות
- **רק** מנהל הנהלת חשבונות (`accounting_manager`) יכול לקרוא לפונקציה זו
- מייל נשלח עם **סיסמה זמנית אקראית** – יש להחליפה לאחר כניסה ראשונה

---

### 6. 🔑 `reset-user-password`
**קובץ:** `supabase/functions/reset-user-password/index.ts`

#### 🎯 מטרה
איפוס סיסמת משתמש ע"י מנהל הנהלת חשבונות ושליחת הסיסמה החדשה למשתמש במייל.

#### 📥 קלט
```json
{ "user_id": "uuid-of-user-to-reset" }
```

#### 📤 פלט
```json
{
  "success": true,
  "message": "הסיסמה אופסה בהצלחה והסיסמה החדשה נשלחה במייל למשתמש"
}
```

#### 🔐 הרשאות
- **רק** `accounting_manager` יכול לאפס סיסמאות
- נוצרת סיסמה אקראית 24 תווים
- נשלח מייל בעברית עם הסיסמה החדשה + הזכרה לשנות אותה

---

### 7. 📧 `request-add-employee`
**קובץ:** `supabase/functions/request-add-employee/index.ts`

#### 🎯 מטרה
מנגנון שמאפשר למנהל לבקש מהנהלת חשבונות להוסיף עובד חדש – שולח מייל בקשה לאחראי הנה"ח.

#### 📥 קלט
```json
{
  "managerName": "דני כהן",
  "managerEmail": "danny@company.com",
  "employeeName": "שרה לוי",
  "employeeEmail": "sarah@company.com",
  "department": "שיווק",
  "notes": "עובדת חדשה שהצטרפה השבוע"
}
```

#### 📤 פלט
```json
{
  "success": true,
  "message": "הבקשה נשלחה בהצלחה למנהל הנהלת החשבונות"
}
```

#### 🔄 תהליך
1. שולף את כתובת מייל הנהלת החשבונות מטבלת `profiles`
2. שולח מייל HTML מפורט עם פרטי המנהל המבקש ופרטי העובד הרצוי
3. האחראי בנה"ח מוסיף אותו ידנית דרך ממשק `create-user`

---

### 8. 📧 `send-invitation-email`
**קובץ:** `supabase/functions/send-invitation-email/index.ts`
**JWT:** ✅ נדרש אימות

#### 🎯 מטרה
שליחת אימייל הזמנה לרישום עם קוד הזמנה ייחודי – לעובדים, מנהלים, או אדמינים.

#### 📥 קלט
```json
{
  "recipientEmail": "newuser@company.com",
  "invitationCode": "ABC123-XYZ",
  "organizationName": "חברת טכנולוגיה בע\"מ",
  "role": "user",
  "expiresAt": "2026-02-25T00:00:00Z",
  "registrationUrl": "https://app.lovable.app/register/with-code"
}
```

| שדה | תיאור |
|---|---|
| `recipientEmail` | מייל הנמען |
| `invitationCode` | קוד הזמנה שנוצר ב-DB |
| `organizationName` | שם הארגון |
| `role` | user / manager / org_admin |
| `expiresAt` | מתי פג תוקף הקוד |
| `registrationUrl` | URL עמוד הרשמה |

#### 📤 פלט
```json
{ "success": true, "data": { "id": "resend-email-id" } }
```

#### 🔐 הרשאות
- רק `org_admin`, `accounting_manager`, `admin` יכולים לשלוח הזמנות
- המייל מציג את קוד ההזמנה בגדול + כפתור הרשמה ישיר

---

### 9. 📧 `request-report-approval`
**קובץ:** `supabase/functions/request-report-approval/index.ts`

#### 🎯 מטרה
שליחת בקשת אישור לדוח נסיעה למנהל הישיר של העובד – כולל יצירת Approval Token, עדכון DB, ושליחת מייל.

#### 📥 קלט
```json
{
  "reportId": "uuid",
  "managerEmail": "manager@company.com",
  "managerName": "דני כהן",
  "employeeName": "שרה לוי",
  "reportDetails": {
    "destination": "לונדון",
    "startDate": "2025-03-01",
    "endDate": "2025-03-05",
    "purpose": "כנס בינלאומי",
    "totalAmount": 4500.00
  }
}
```

#### 📤 פלט
```json
{ "success": true, "data": { "id": "resend-email-id" } }
```

#### 🔄 תהליך מפורט
1. **שליפת נתונים** – מושך פרופיל העובד וה-`manager_id` שלו
2. **יצירת טוקן** – `crypto.randomUUID()` – מחרוזת UUID ייחודית
3. **עדכון DB** – מעדכן ב-`reports`:
   - `status` → `pending_approval`
   - `manager_approval_token` → הטוקן
   - `manager_approval_requested_at` → timestamp
4. **יצירת Notification** – מוסיף רשומה ל-`notifications` עבור המנהל (בתוך-האפליקציה)
5. **שליחת מייל** – מייל HTML בעברית למנהל עם כפתור "צפה ואשר דוח"

#### 🔗 URL אישור
```
https://[project].lovable.app/approve-report/{approvalToken}
```

---

### 10. ✅ `approve-report`
**קובץ:** `supabase/functions/approve-report/index.ts`
**JWT:** ✅ נדרש אימות – המנהל חייב להיות מחובר

#### 🎯 מטרה
הפונקציה הקריטית ביותר בתהליך האישור – מקבלת את ביקורת המנהל (אישור/דחייה לכל הוצאה), מעדכנת את כל ה-DB, ומפעילה שרשרת התראות.

#### 📥 קלט
```json
{
  "token": "approval-uuid-token",
  "expenseReviews": [
    { "expenseId": "uuid1", "status": "approved", "comment": "" },
    { "expenseId": "uuid2", "status": "rejected", "comment": "קבלה לא ברורה" }
  ],
  "generalComment": "יש לצרף קבלות מקוריות"
}
```

| שדה | תיאור |
|---|---|
| `token` | טוקן האישור שנשלח למנהל במייל |
| `expenseReviews` | מערך ביקורות – אחת לכל הוצאה |
| `status` | `approved` / `rejected` |
| `comment` | הערת מנהל לאותה הוצאה |
| `generalComment` | הערה כללית על הדוח |

#### 📤 פלט
```json
{
  "success": true,
  "allApproved": true,
  "approvedCount": 5,
  "rejectedCount": 0,
  "message": "הדוח אושר בהצלחה"
}
```

#### 🔄 תהליך מפורט מלא
```
1. אימות JWT המנהל
   ↓
2. אימות שהמנהל הוא אכן המנהל של הדוח (authorization check)
   ↓
3. בדיקה שהדוח ב-status "pending_approval"
   ↓
4. עדכון כל הוצאה: approval_status, manager_comment, reviewed_at
   ↓
5. ספירת approved vs rejected
   ↓
6. עדכון הדוח:
   - אם הכל אושר: status="closed", approved_at=now()
   - אם יש דחיות: status="open", rejection_reason=...
   ↓
7. ניקוי הטוקן (manager_approval_token=null)
   ↓
8. הוספת רשומת היסטוריה ב-report_history
   ↓
9. יצירת Notification לעובד
   ↓
10. קריאה ל-notify-employee-review (מייל לעובד)
   ↓
11. אם הכל אושר: קריאה ל-send-accounting-report (מייל להנה"ח)
```

#### 🔐 אבטחה קריטית
- **בדיקת identity**: המנהל חייב להיות מחובר ולהיות ה-`manager_id` בפרופיל העובד
- אם מנהל אחר מנסה לאשר → `403 Forbidden`
- טוקן נמחק מה-DB לאחר שימוש (לא ניתן לשימוש חוזר)

---

### 11. 📧 `notify-employee-review`
**קובץ:** `supabase/functions/notify-employee-review/index.ts`

#### 🎯 מטרה
שליחת מייל לעובד עם תוצאת ביקורת המנהל – מפורט לכל הוצאה (אושרה / נדחתה + הסבר).

#### 📥 קלט
```json
{
  "employeeEmail": "employee@company.com",
  "employeeName": "שרה לוי",
  "reportId": "uuid",
  "reportDetails": {
    "destination": "לונדון",
    "startDate": "2025-03-01",
    "endDate": "2025-03-05",
    "totalAmount": 4500.00
  },
  "expenseReviews": [ ... ],
  "generalComment": "...",
  "allApproved": false
}
```

#### 📤 פלט
```json
{ "success": true }
```

#### 📬 תוכן המייל
- **כותרת:** "הדוח שלך אושר!" / "הדוח שלך נבדק"
- **סיכום:** כמה הוצאות אושרו וכמה נדחו
- **פרטי הוצאות שנדחו** – עם הערת המנהל לכל אחת
- **הערה כללית** של המנהל
- **כפתור** לצפייה בדוח

---

### 12. 📧 `send-accounting-report`
**קובץ:** `supabase/functions/send-accounting-report/index.ts`

#### 🎯 מטרה
שליחת דוח מאושר להנהלת חשבונות כולל **קובץ PDF מצורף** (אופציונלי).

#### 📥 קלט
```json
{
  "reportId": "uuid",
  "accountingEmail": "accounting@company.com",
  "pdfBase64": "JVBERi0xLjQ...",
  "pdfFileName": "report-london.pdf"
}
```

#### 📤 פלט
```json
{ "success": true, "emailId": "resend-email-id" }
```

#### 📬 תוכן המייל
- **פרטי העובד:** שם, מספר עובד, מחלקה
- **פרטי הנסיעה:** יעד, מטרה, תאריכים, הערות
- **סיכום כספי:** מספר הוצאות + סה"כ לתשלום בשקלים
- **מידע נוסף:** תאריכי הגשה ואישור
- **PDF מצורף** אם סופק

---

### 13. 📧 `send-report-email`
**קובץ:** `supabase/functions/send-report-email/index.ts`

#### 🎯 מטרה
שליחת דוח נסיעה (עם PDF) לכל כתובת מייל שמשתמש מוסיף – פונקציה ידנית שמשמשת לשליחה גמישה.

#### 📥 קלט
```json
{
  "recipientEmails": ["boss@company.com", "archive@company.com"],
  "reportId": "uuid",
  "pdfBase64": "JVBERi0xLjQ...",
  "reportData": {
    "report": { ... },
    "expenses": [ ... ],
    "profile": { ... }
  }
}
```

#### 📤 פלט
```json
{ "success": true, "data": { ... } }
```

#### 📬 הבדל מ-send-accounting-report
| | `send-report-email` | `send-accounting-report` |
|---|---|---|
| **נקרא מ** | ממשק המשתמש ידנית | `approve-report` אוטומטית |
| **נמענים** | רשימת נמענים גמישה | מייל הנה"ח בלבד |
| **PDF** | חובה | אופציונלי |
| **פרטי עובד** | כלולים ב-body | נשלפים מ-DB |

---

### 14. 📧 `notify-accounting-comment`
**קובץ:** `supabase/functions/notify-accounting-comment/index.ts`

#### 🎯 מטרה
כאשר מנהל הנהלת חשבונות מוסיף הערה לדוח – שולח מייל **לעובד ולמנהל שלו**.

#### 📥 קלט
```json
{
  "reportId": "uuid",
  "commentText": "חסרה קבלה מקורית לביטוח נסיעות",
  "commentAuthor": "מירי חן - הנה\"ח"
}
```

#### 📤 פלט
```json
{ "success": true }
```

#### 🔄 תהליך
1. שולף פרטי הדוח + פרופיל העובד + פרופיל המנהל שלו
2. **נמענים:** עובד + מנהל ישיר (אם קיים)
3. שולח מייל HTML מעוצב עם ההערה + פרטי הדוח + כפתור "צפה בדוח"

---

### 15. 📧 `notify-travel-request`
**קובץ:** `supabase/functions/notify-travel-request/index.ts`

#### 🎯 מטרה
כאשר עובד מגיש בקשת נסיעה – שולח מייל + Notification לאפליקציה למאשר הרלוונטי.

#### 📥 קלט
```json
{
  "travel_request_id": "uuid",
  "approver_id": "uuid",
  "requester_name": "שרה לוי",
  "destination": "ברלין, גרמניה",
  "start_date": "2025-04-10",
  "end_date": "2025-04-14",
  "purpose": "כנס פיתוח תוכנה",
  "estimated_total": 3500,
  "has_violations": true,
  "violation_count": 2
}
```

#### 📤 פלט
```json
{ "success": true }
```

#### ⚠️ התראת חריגות
אם `has_violations: true` – המייל מציג **אזהרה בולטת** עם מספר החריגות מהמדיניות

#### 📱 Notification בתוך-האפליקציה
נוצרת רשומה ב-`notifications` עבור המאשר עם:
- `type: "travel_request_pending"`
- `title: "בקשת נסיעה חדשה לאישור"`
- `travel_request_id` לניווט ישיר

---

### 16. 📧 `notify-travel-decision`
**קובץ:** `supabase/functions/notify-travel-decision/index.ts`

#### 🎯 מטרה
לאחר שהמאשר אישר/דחה/אישר-חלקית בקשת נסיעה – שולח מייל לעובד עם פרטי ההחלטה.

#### 📥 קלט
```json
{
  "employee_id": "uuid",
  "decision": "approved",
  "destination": "ברלין",
  "start_date": "2025-04-10",
  "end_date": "2025-04-14",
  "approver_name": "דני כהן",
  "comments": "אושר, אנא תאם עם מחלקת הנסיעות",
  "approved_budget": {
    "flights": 1200,
    "accommodation_per_night": 250,
    "meals_per_day": 80,
    "transport": 200,
    "total": 3100
  }
}
```

| שדה `decision` | תיאור |
|---|---|
| `approved` | אושרה במלואה – ✅ |
| `rejected` | נדחתה – ❌ |
| `partially_approved` | אושרה עם שינויים – ⚠️ |

#### 📬 תוכן המייל
- **כותרת צבעונית** לפי סטטוס (ירוק/אדום/צהוב)
- **פרטי הנסיעה** (יעד, תאריכים)
- **תקציב מאושר** (לא במקרה דחייה)
- **הערות המאשר**
- **כפתור** לצפייה בנסיעות המאושרות / בבקשות

#### ⚡ Resilience
אם שליחת המייל נכשלת – מחזיר `200 OK` עם `warning` במקום `500 Error` (כדי לא לשבור את תהליך האישור)

---

### 17. 📧 `notify-approval-skipped`
**קובץ:** `supabase/functions/notify-approval-skipped/index.ts`

#### 🎯 מטרה
כאשר שלב באישור נסיעה **מדולג אוטומטית** (למשל כי הסכום מתחת לסף שקבע מנהל הארגון) – מודיע לעובד.

#### 📥 קלט
```json
{
  "travel_request_id": "uuid",
  "requester_id": "uuid",
  "requester_name": "שרה לוי",
  "destination": "ברלין",
  "skipped_level": 1,
  "skipped_level_type": "direct_manager",
  "skip_reason": "הסכום נמוך מ-$500 – אין צורך באישור מנהל ישיר",
  "estimated_total": 350
}
```

| `skipped_level_type` | תרגום |
|---|---|
| `direct_manager` | מנהל ישיר |
| `org_admin` | מנהל ארגון |
| `accounting_manager` | הנהלת חשבונות |
| `specific_user` | משתמש ספציפי |

#### 📤 פלט
```json
{ "success": true }
```

#### 📱 פעולות
1. שולח **מייל** לעובד עם הסבר על הדילוג
2. יוצר **Notification** בתוך-האפליקציה עם `type: "approval_level_skipped"`

---

### 18. 📧 `notify-manager-new-employee`
**קובץ:** `supabase/functions/notify-manager-new-employee/index.ts`

#### 🎯 מטרה
כאשר עובד חדש נרשם ומציין מנהל ישיר – מודיע למנהל על העובד החדש שהוסף לצוות שלו.

#### 📥 קלט
```json
{
  "employeeName": "שרה לוי",
  "employeeEmail": "sarah@company.com",
  "employeeId": "EMP-456",
  "department": "שיווק",
  "managerId": "uuid-of-manager"
}
```

#### 📤 פלט
```json
{ "success": true, "emailResponse": { ... } }
```

#### 🔄 תהליך
1. שולף את שם ומייל המנהל מ-`profiles` לפי `managerId`
2. שולח מייל HTML בעברית עם:
   - שם ומייל העובד החדש
   - מחלקה ומספר עובד
   - הודעה שהעובד ניתן כעת לביצוע מעקב דרך המערכת

---

### 19. ⚠️ `notify-missing-grades`
**קובץ:** `supabase/functions/notify-missing-grades/index.ts`
**JWT:** ✅ נדרש אימות

#### 🎯 מטרה
סריקת כל ארגוני המערכת וזיהוי עובדים **ללא דרגה משויכת** – שליחת מייל אוטומטי לאדמין הארגון.

#### 📥 קלט
אין body נדרש – הפונקציה פועלת על כל הארגונים.

#### 📤 פלט
```json
{
  "success": true,
  "message": "Sent 3 notifications",
  "details": [
    { "org": "חברת ABC", "adminEmail": "admin@abc.com", "employeesCount": 5 }
  ]
}
```

#### 🔄 תהליך מפורט
```
לכל ארגון פעיל:
  1. מושך את כל מנהלי הארגון (org_admin)
  2. מושך עובדים שאין להם grade_id
  3. אם יש עובדים ללא דרגה:
     → שולח מייל לכל אדמין עם טבלת העובדים החסרים
```

#### 📬 תוכן המייל
- רשימת עובדים ללא דרגה (שם, מייל, מחלקה)
- הסבר על ההשפעה (רואים מדיניות ברירת מחדל)
- הנחיה לפעולה נדרשת

#### ⏱️ שימוש מומלץ
פונקציה זו נועדה להיקרא **כ-Cron Job תקופתי** (שבועי / חודשי) או ידנית מממשק ניהול.

---

## 🔑 Secrets הנדרשים

| Secret | שימוש |
|---|---|
| `RESEND_API_KEY` | שליחת כל המיילים (14 פונקציות) |
| `LOVABLE_API_KEY` | AI לניתוח קבלות ומדיניות (2 פונקציות) |
| `SUPABASE_URL` | חיבור ל-DB (כל הפונקציות) |
| `SUPABASE_SERVICE_ROLE_KEY` | פעולות אדמין ב-DB (כל הפונקציות) |
| `SUPABASE_ANON_KEY` | אימות JWT משתמשים (חלק מהפונקציות) |

---

## 📊 סטטיסטיקות

| קטגוריה | כמות |
|---|---|
| פונקציות AI | 2 |
| פונקציות שליחת מייל | 9 |
| פונקציות ניהול משתמשים | 3 |
| פונקציות Notification | 4 |
| פונקציות מידע/חישוב | 1 |
| **סה"כ** | **19** |

---

## 🔄 דיאגרמת זרימה – תהליך אישור דוח נסיעה

```
עובד מגיש דוח
      ↓
request-report-approval
  → DB: status=pending_approval
  → DB: manager_approval_token=uuid
  → DB: notifications (למנהל)
  → Email: מנהל מקבל מייל עם כפתור אישור
      ↓
מנהל מאשר/דוחה
      ↓
approve-report
  → DB: כל הוצאה מעודכנת (approved/rejected)
  → DB: report status (closed/open)
  → DB: report_history
  → DB: notifications (לעובד)
  → notify-employee-review → Email לעובד
  → [אם הכל אושר] send-accounting-report → Email להנה"ח
```

---

## 🔄 דיאגרמת זרימה – תהליך בקשת נסיעה

```
עובד מגיש בקשת נסיעה
      ↓
notify-travel-request
  → DB: notifications (למאשר)
  → Email: מאשר מקבל מייל
  → [אם יש דילוג] notify-approval-skipped
      ↓
מאשר מקבל החלטה (approved/rejected/partially_approved)
      ↓
notify-travel-decision
  → Email: עובד מקבל תוצאה + תקציב מאושר
```

---

*מסמך זה נוצר ב-18/02/2026 ומשקף את מצב המערכת הנוכחי.*
