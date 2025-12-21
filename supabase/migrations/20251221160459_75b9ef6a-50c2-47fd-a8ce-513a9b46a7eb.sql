-- Fix the "Managers can view submitted reports" policy to only show reports from their organization
-- The current policy allows managers to see ALL submitted/closed reports which is wrong

DROP POLICY IF EXISTS "Managers can view submitted reports" ON public.reports;

CREATE POLICY "Managers can view submitted reports in their org"
ON public.reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND status = ANY (ARRAY['pending_approval'::expense_status, 'closed'::expense_status])
  AND (
    -- Either the report is from the manager's team
    user_id IN (SELECT public.get_team_user_ids(auth.uid()))
    -- Or the manager and report owner are in the same organization
    OR public.same_organization(auth.uid(), user_id)
  )
);