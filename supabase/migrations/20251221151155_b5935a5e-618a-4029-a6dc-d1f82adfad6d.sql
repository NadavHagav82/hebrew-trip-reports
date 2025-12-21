-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;

-- Create a function to get organization_id without causing recursion
CREATE OR REPLACE FUNCTION public.get_org_id_for_policy(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);