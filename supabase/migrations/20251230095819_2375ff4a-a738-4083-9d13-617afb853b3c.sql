-- Fix reports table RLS policies to require authentication
-- Drop existing SELECT policies and recreate with explicit auth check

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Managers can view their team reports" ON public.reports;
DROP POLICY IF EXISTS "Org admins can view reports from their organization" ON public.reports;

-- Recreate with explicit authentication requirement
CREATE POLICY "Users can view their own reports" 
ON public.reports 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view their team reports" 
ON public.reports 
FOR SELECT 
TO authenticated
USING (user_id IN (SELECT get_team_user_ids(auth.uid())));

CREATE POLICY "Org admins can view reports from their organization" 
ON public.reports 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin') 
  AND user_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.organization_id = get_org_id_for_policy(auth.uid())
  )
);

-- Also add accounting managers policy to view all reports
CREATE POLICY "Accounting managers can view all reports" 
ON public.reports 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'));