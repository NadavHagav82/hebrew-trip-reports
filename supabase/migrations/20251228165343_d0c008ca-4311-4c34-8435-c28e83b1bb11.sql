-- FIX 1: Remove public access to invitation codes
DROP POLICY IF EXISTS "Anyone can read valid unused codes" ON public.invitation_codes;

-- Create secure policy: Only org admins and accounting managers can view codes for their org
CREATE POLICY "Org admins can view valid codes for their org"
ON public.invitation_codes
FOR SELECT
USING (
  (has_role(auth.uid(), 'org_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
  OR has_role(auth.uid(), 'accounting_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- FIX 2: Remove the policy that allows managers to see all org reports
DROP POLICY IF EXISTS "Managers can view submitted reports in their org" ON public.reports;

-- Keep only direct reports visibility (the existing "Managers can view their team reports" policy handles this)