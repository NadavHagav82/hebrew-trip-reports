-- Drop and recreate the problematic SELECT policy for org admins
DROP POLICY IF EXISTS "Org admins can view users in their organization" ON public.profiles;

-- Recreate using the security definer function that avoids recursion
CREATE POLICY "Org admins can view users in their organization"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);