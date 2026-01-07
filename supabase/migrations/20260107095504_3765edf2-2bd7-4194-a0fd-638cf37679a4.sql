-- Allow managers to write reviews (approval_status/manager_comment) on expenses belonging to their direct reports
DO $$
BEGIN
  -- Drop existing policy if exists
  DROP POLICY IF EXISTS "Managers can review team expenses" ON public.expenses;
  -- Create new policy
  CREATE POLICY "Managers can review team expenses"
  ON public.expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.reports r
      WHERE r.id = expenses.report_id
        AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
        AND r.status = 'pending_approval'::public.expense_status
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reports r
      WHERE r.id = expenses.report_id
        AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
        AND r.status = 'pending_approval'::public.expense_status
    )
  );
END $$;

-- Tighten manager attachment inserts to only team expenses
DROP POLICY IF EXISTS "Managers can insert attachments" ON public.manager_comment_attachments;
CREATE POLICY "Managers can insert attachments for team expenses"
ON public.manager_comment_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.reports r ON r.id = e.report_id
    WHERE e.id = manager_comment_attachments.expense_id
      AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
  )
);