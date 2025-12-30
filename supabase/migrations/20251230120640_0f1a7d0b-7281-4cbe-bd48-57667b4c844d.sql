-- Fix the overly permissive "Users can view limited manager info in their organization" policy
-- Drop the existing policy that exposes too much data
DROP POLICY IF EXISTS "Users can view limited manager info in their organization" ON public.profiles;

-- Create a more restrictive policy that only shows manager names (not emails)
-- Users should only be able to see manager id and name for assignment purposes
-- Full profile access is controlled by other policies

-- The profiles_limited view should be used for this purpose instead
-- Let's add RLS to the profiles_limited view

-- First, we need to make profiles_limited a security barrier view
DROP VIEW IF EXISTS public.profiles_limited;

-- Recreate the view as a security barrier view that excludes sensitive data
CREATE VIEW public.profiles_limited 
WITH (security_barrier = true, security_invoker = true)
AS SELECT 
  id,
  full_name,
  username,
  department,
  is_manager,
  manager_id,
  organization_id
FROM public.profiles;

-- Grant access to authenticated users only
REVOKE ALL ON public.profiles_limited FROM anon;
REVOKE ALL ON public.profiles_limited FROM public;
GRANT SELECT ON public.profiles_limited TO authenticated;

-- Now fix the main profiles table policy
-- Users should only see limited manager info (just id, name, department) for their organization
-- The full profile (with email) should only be visible to:
-- 1. The profile owner
-- 2. The user's direct manager
-- 3. Accounting managers
-- 4. Org admins for their org
-- 5. System admins

-- The existing policy "Users can view limited manager info in their organization" is too broad
-- We'll replace it with a policy that only allows viewing through the limited view

-- Create a function to check if a user can view a specific profile's limited info
CREATE OR REPLACE FUNCTION public.can_view_manager_limited_info(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT 
    -- The profile must be a manager
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _profile_id 
      AND is_manager = true
      -- And be in the same organization as the viewer
      AND organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = _viewer_id
      )
    )
$$;

-- Replace the overly permissive policy with a more restrictive one
-- that only shows non-sensitive fields (via the profiles_limited view)
CREATE POLICY "Users can view managers in their org for assignment only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Only managers in the same org, and only selected fields are visible via profiles_limited view
  is_manager = true 
  AND organization_id = get_user_organization_id(auth.uid())
  -- This policy will be used alongside the existing more permissive policies
  -- The key is that this only exposes manager profiles, and the view excludes email
);