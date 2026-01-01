-- Add RLS policy to allow managers to update approvals for their team members
CREATE POLICY "Managers can update team member request approvals"
ON travel_request_approvals
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  EXISTS (
    SELECT 1 FROM travel_requests tr
    WHERE tr.id = travel_request_approvals.travel_request_id
    AND tr.requested_by IN (SELECT get_team_user_ids(auth.uid()))
  )
);

-- Add policy to allow org_admins to update approvals in their organization
CREATE POLICY "Org admins can update org travel request approvals"
ON travel_request_approvals
FOR UPDATE
USING (
  has_role(auth.uid(), 'org_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM travel_requests tr
    WHERE tr.id = travel_request_approvals.travel_request_id
    AND tr.organization_id = get_org_id_for_policy(auth.uid())
  )
);

-- Add policy to allow accounting managers to update all approvals
CREATE POLICY "Accounting managers can update all travel request approvals"
ON travel_request_approvals
FOR UPDATE
USING (has_role(auth.uid(), 'accounting_manager'::app_role));