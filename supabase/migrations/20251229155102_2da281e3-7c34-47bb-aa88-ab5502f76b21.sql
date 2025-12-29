-- Allow managers to create invitation codes for their team
CREATE POLICY "Managers can create invitation codes for their team"
ON public.invitation_codes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND manager_id = auth.uid()
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Allow managers to view their own invitation codes
CREATE POLICY "Managers can view their invitation codes"
ON public.invitation_codes
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND manager_id = auth.uid()
);

-- Allow managers to update their own invitation codes
CREATE POLICY "Managers can update their invitation codes"
ON public.invitation_codes
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND manager_id = auth.uid()
);