-- Drop the problematic policy that exposes all managers in the organization
DROP POLICY IF EXISTS "Users can view managers in their org for assignment only" ON public.profiles;

-- Add policy for users to view their direct manager's profile (limited exposure)
CREATE POLICY "Users can view their direct manager profile"
ON public.profiles
FOR SELECT
USING (
  id = (SELECT manager_id FROM public.profiles WHERE id = auth.uid())
);

-- Add policy for managers to view limited subordinate profiles through the view
-- (existing policy "Managers can view their direct reports profiles" already handles this)