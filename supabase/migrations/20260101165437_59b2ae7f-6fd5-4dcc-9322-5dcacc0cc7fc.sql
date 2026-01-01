-- Add policy to allow approvers to update travel requests they're assigned to approve
CREATE POLICY "Approvers can update assigned travel requests"
ON public.travel_requests
FOR UPDATE
USING (
  public.is_travel_request_approver(auth.uid(), id)
);