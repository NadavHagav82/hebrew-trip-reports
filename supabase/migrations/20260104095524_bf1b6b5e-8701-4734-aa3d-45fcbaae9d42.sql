-- Allow request owners to create approval rows for their own travel requests (needed to route to approvers)
CREATE POLICY "Request owners can create approval records"
ON public.travel_request_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.travel_requests tr
    WHERE tr.id = travel_request_approvals.travel_request_id
      AND tr.requested_by = auth.uid()
  )
  AND travel_request_approvals.status IN ('pending'::public.approval_status, 'skipped'::public.approval_status)
);
