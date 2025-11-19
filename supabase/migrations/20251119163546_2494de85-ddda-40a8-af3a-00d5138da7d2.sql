-- עדכון enum של סטטוס דוחות - להשאיר רק 3 סטטוסים

-- שלב 1: הסרת policy שתלויים בעמודת status
DROP POLICY IF EXISTS "Users can delete their own draft reports" ON reports;

-- שלב 2: הסרת ברירת מחדל זמנית
ALTER TABLE reports ALTER COLUMN status DROP DEFAULT;

-- שלב 3: שינוי שם הטייפ הישן
ALTER TYPE expense_status RENAME TO expense_status_old;

-- שלב 4: יצירת טייפ חדש עם 3 סטטוסים בלבד
CREATE TYPE expense_status AS ENUM ('draft', 'open', 'closed');

-- שלב 5: עדכון כל הדוחות הקיימים למבנה החדש
UPDATE reports 
SET status = CASE 
  WHEN status::text = 'pending' THEN 'open'::text
  WHEN status::text = 'approved' THEN 'closed'::text
  WHEN status::text = 'rejected' THEN 'open'::text
  ELSE status::text
END::expense_status_old;

-- שלב 6: שינוי הטבלה לעבוד עם הטייפ החדש
ALTER TABLE reports 
  ALTER COLUMN status TYPE expense_status 
  USING status::text::expense_status;

-- שלב 7: מחיקת הטייפ הישן
DROP TYPE expense_status_old;

-- שלב 8: הגדרת ברירת מחדל חדשה - 'open' (לא 'draft')
ALTER TABLE reports ALTER COLUMN status SET DEFAULT 'open';

-- שלב 9: יצירת מחדש של ה-policy (רק טיוטות ניתן למחוק)
CREATE POLICY "Users can delete their own draft reports" 
ON reports 
FOR DELETE 
USING (auth.uid() = user_id AND status = 'draft'::expense_status);