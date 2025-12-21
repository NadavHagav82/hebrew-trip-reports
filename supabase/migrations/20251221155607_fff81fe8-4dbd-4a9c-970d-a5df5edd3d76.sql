-- Add RLS policy for org_admin to view reports only from users in their organization
CREATE POLICY "Org admins can view reports from their organization"
ON public.reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND user_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = public.get_org_id_for_policy(auth.uid())
  )
);

-- Also add policy for org_admin to view expenses from their organization
CREATE POLICY "Org admins can view expenses from their organization"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE r.id = expenses.report_id
    AND p.organization_id = public.get_org_id_for_policy(auth.uid())
  )
);

-- Add policy for org_admin to view receipts from their organization
CREATE POLICY "Org admins can view receipts from their organization"
ON public.receipts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.reports r ON e.report_id = r.id
    JOIN public.profiles p ON r.user_id = p.id
    WHERE e.id = receipts.expense_id
    AND p.organization_id = public.get_org_id_for_policy(auth.uid())
  )
);