-- Allow accounting managers to add expenses to any report
CREATE POLICY "Accounting managers can create expenses for any report"
ON public.expenses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Allow accounting managers to view all expenses
CREATE POLICY "Accounting managers can view all expenses"
ON public.expenses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Allow accounting managers to update all expenses
CREATE POLICY "Accounting managers can update all expenses"
ON public.expenses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Allow accounting managers to delete all expenses
CREATE POLICY "Accounting managers can delete all expenses"
ON public.expenses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Allow accounting managers to create receipts for any expense
CREATE POLICY "Accounting managers can create receipts for any expense"
ON public.receipts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Allow accounting managers to view all receipts
CREATE POLICY "Accounting managers can view all receipts"
ON public.receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);