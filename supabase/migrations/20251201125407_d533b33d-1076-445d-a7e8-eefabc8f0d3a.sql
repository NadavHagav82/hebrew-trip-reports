-- Create expense templates table
CREATE TABLE public.expense_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC,
  currency expense_currency NOT NULL DEFAULT 'ILS',
  country TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE public.expense_templates ENABLE ROW LEVEL SECURITY;

-- Accounting managers can view all templates
CREATE POLICY "Accounting managers can view all templates"
ON public.expense_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can create templates
CREATE POLICY "Accounting managers can create templates"
ON public.expense_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can update templates
CREATE POLICY "Accounting managers can update templates"
ON public.expense_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can delete templates
CREATE POLICY "Accounting managers can delete templates"
ON public.expense_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_expense_templates_updated_at
BEFORE UPDATE ON public.expense_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates based on Israeli tax authority rules
INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'טיסה כלכלית - מחיר מלא',
  'flights'::expense_category,
  'טיסה כלכלית - 100% ממחיר הרכישוע',
  0,
  'USD'::expense_currency,
  NULL,
  'מוכרת לפי רשות המיסים - מחלקה כלכלית 100% ממחיר הרכישוע',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'טיסה עסקים - ראשונה',
  'flights'::expense_category,
  'טיסה במחלקה עסקית או ראשונה - 100% ממחיר הרכישוע',
  0,
  'USD'::expense_currency,
  NULL,
  'מוכרת לפי רשות המיסים - מחלקה עסקית/ראשונה 100%',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'לינה - לילות 1-7',
  'accommodation'::expense_category,
  'לינה ללילות 1-7',
  355,
  'USD'::expense_currency,
  NULL,
  '7 לילות ראשונים - עד 355$ ללילה',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'לינה - לילות 8-90 (מינימום)',
  'accommodation'::expense_category,
  'לינה ללילות 8-90',
  156,
  'USD'::expense_currency,
  NULL,
  'לילות 8-90: 75% הנחה או לא פחות מ-156$ ללילה',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'לינה - לילות 8-90 (מקסימום)',
  'accommodation'::expense_category,
  'לינה ללילות 8-90',
  266,
  'USD'::expense_currency,
  NULL,
  'לילות 8-90: 75% הנחה או לא יותר מ-266$ ללילה',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'לינה - מעל 90 לילות',
  'accommodation'::expense_category,
  'לינה למעל 90 לילות',
  156,
  'USD'::expense_currency,
  NULL,
  'מעל 90 לילות - 156$ ללילה (חודל מחלילות הראשון)',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'אשל עם לינה',
  'food'::expense_category,
  'הוצאות אשל כאשר נדרשו הוצאות לינה',
  100,
  'USD'::expense_currency,
  NULL,
  'אם נדרשו הוצאות לינה - עד 100$ ליום',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'אשל ללא לינה',
  'food'::expense_category,
  'הוצאות אשל כאשר לא נדרשו הוצאות לינה',
  167,
  'USD'::expense_currency,
  NULL,
  'אם לא נדרשו הוצאות לינה - עד 167$ ליום',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;

INSERT INTO public.expense_templates (template_name, category, description, amount, currency, country, notes, created_by) 
SELECT 
  'שכירות רכב',
  'transportation'::expense_category,
  'שכירות רכב',
  78,
  'USD'::expense_currency,
  NULL,
  'עד 78$ ליום',
  id
FROM profiles 
WHERE accounting_manager_email IS NOT NULL 
LIMIT 1;