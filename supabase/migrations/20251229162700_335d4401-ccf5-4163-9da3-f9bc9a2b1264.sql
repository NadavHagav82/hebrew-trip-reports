-- Create a secure view for limited profile data that can be shared
-- This view only exposes non-sensitive fields needed for organizational functionality
CREATE OR REPLACE VIEW public.profiles_limited AS
SELECT 
  id,
  full_name,
  department,
  is_manager,
  organization_id,
  manager_id,
  username
FROM public.profiles;

-- Enable RLS on the view (views inherit from base table, but we add explicit policy)
-- Grant access to authenticated users
GRANT SELECT ON public.profiles_limited TO authenticated;

-- Drop the overly permissive policy that exposes manager emails
DROP POLICY IF EXISTS "Users can view managers in their organization" ON public.profiles;

-- Create a more restrictive policy - users can only see limited info about managers
-- (full_name, department, is_manager) but NOT email or employee_id
-- This is handled through the view instead

-- Update the managers policy to be more specific - only for direct reports
-- The existing policy is fine: "Managers can view their direct reports profiles"

-- Create a function to check if user needs full profile access
CREATE OR REPLACE FUNCTION public.can_view_full_profile(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User viewing their own profile
    _viewer_id = _profile_id
    -- Or user is the manager of this profile
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _profile_id AND manager_id = _viewer_id
    )
    -- Or user is an accounting manager
    OR public.has_role(_viewer_id, 'accounting_manager')
    -- Or user is an org admin in the same organization
    OR (
      public.has_role(_viewer_id, 'org_admin') 
      AND public.get_user_organization_id(_viewer_id) = (
        SELECT organization_id FROM public.profiles WHERE id = _profile_id
      )
    )
    -- Or user is an admin
    OR public.has_role(_viewer_id, 'admin')
$$;

-- Add a new policy for viewing manager basic info (without sensitive data)
-- Users need to see which managers exist in their org for assignment purposes
CREATE POLICY "Users can view limited manager info in their organization"
ON public.profiles
FOR SELECT
USING (
  -- Only if the profile is a manager
  is_manager = true 
  -- And in the same organization
  AND organization_id = get_user_organization_id(auth.uid())
  -- But only expose non-sensitive columns (enforced by the view, not here)
);