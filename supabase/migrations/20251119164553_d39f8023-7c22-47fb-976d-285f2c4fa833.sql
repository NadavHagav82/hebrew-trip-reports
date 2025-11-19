-- הוספת עמודת הערות לדוחות והוצאות

-- הוסף עמודה להערה כללית על הדוח
ALTER TABLE reports ADD COLUMN notes TEXT;

-- הוסף עמודה להערה לכל הוצאה
ALTER TABLE expenses ADD COLUMN notes TEXT;

-- הוסף הערה לעמודות
COMMENT ON COLUMN reports.notes IS 'הערות כלליות על הדוח - לדוגמה: הסברים מיוחדים, פרטים נוספים';
COMMENT ON COLUMN expenses.notes IS 'הערות על ההוצאה הספציפית - לדוגמה: סיבת ההוצאה, פרטים נוספים';