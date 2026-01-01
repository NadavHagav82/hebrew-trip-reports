-- Add policy to allow the designated approver to update their approval records
-- This is the most important policy - it allows the approver_id to update their approvals
CREATE POLICY "Designated approver can update their approvals"
ON travel_request_approvals
FOR UPDATE
USING (
  auth.uid() = approver_id
);