-- Allow org admins to manage user roles for their organization members
CREATE POLICY "Org admins can manage user_roles for org members"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.organization_id = p2.organization_id
    WHERE p1.id = auth.uid() 
    AND p2.id = user_roles.user_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.organization_id = p2.organization_id
    WHERE p1.id = auth.uid() 
    AND p2.id = user_roles.user_id
  )
);

-- Allow org admins to update profiles of their organization members
CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);