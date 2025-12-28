-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can view active organization names" ON public.organizations;

-- Create new secure policy: Authenticated users can only view their own organization
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
USING (
  id = get_user_organization_id(auth.uid())
);