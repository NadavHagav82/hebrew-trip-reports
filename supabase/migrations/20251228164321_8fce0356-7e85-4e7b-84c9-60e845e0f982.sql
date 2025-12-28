-- Drop the overly permissive policy that exposes manager data to everyone
DROP POLICY IF EXISTS "Anyone can view manager profiles" ON public.profiles;

-- Create new secure policy: Only authenticated users in the same organization can view managers
CREATE POLICY "Users can view managers in their organization"
ON public.profiles
FOR SELECT
USING (
  is_manager = true 
  AND organization_id = get_user_organization_id(auth.uid())
);