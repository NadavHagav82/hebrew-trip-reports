-- Allow approvers to view travel requests they are assigned to approve
CREATE POLICY "Approvers can view assigned travel requests"
ON public.travel_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.travel_request_approvals tra
    WHERE tra.travel_request_id = travel_requests.id
      AND tra.approver_id = auth.uid()
  )
);