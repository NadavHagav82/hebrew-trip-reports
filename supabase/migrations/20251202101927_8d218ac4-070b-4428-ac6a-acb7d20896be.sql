-- Fix infinite recursion in RLS policy on profiles for org_admins

-- 1) Drop the problematic policy that self-selects from profiles
DROP POLICY IF EXISTS "Org admins can view users in their organization" ON public.profiles;

-- 2) Create helper function to get the current user's organization id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id;
$$;

-- 3) Recreate org_admin policy using the helper function (no self-recursion)
CREATE POLICY "Org admins can view users in their organization"
ON public.profiles
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'org_admin')
  AND organization_id = public.get_user_organization_id(auth.uid())
);
